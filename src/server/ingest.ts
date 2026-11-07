import { and, asc, desc, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { SourceId } from "@/lib/types";
import { runAlerts } from "./alerts";
import { getDb } from "./db/client";
import {
  boardRepos,
  mentionRepos,
  mentions,
  repoSnapshots,
  repos,
  sourceRuns,
  trending,
  trendingDays,
} from "./db/schema";
import { budget, getRepo, graphqlRepos, hasToken, RateLimitedError, searchRepos, type ApiRepo } from "./github/api";
import { ensureRepos, markMissing, mergeObservations, snapshotStars, upsertRepos } from "./repos";
import { adapters } from "./sources";
import { fromApi, type MentionInput, type RepoObservation, type SourceAdapter } from "./sources/types";

const SOURCE_TIMEOUT_MS = 25_000;
/** Two runs closer than this are pointless: star counts barely move in a minute. */
const MIN_INTERVAL_MS = 2 * 60_000;
/** Older snapshots are thinned out (see compactSnapshots); beyond this they are dropped. */
const SNAPSHOT_RETENTION_DAYS = 400;
const MENTION_RETENTION_DAYS = 60;

export interface SourceRunResult {
  source: SourceId;
  status: "ok" | "error";
  itemCount: number;
  error?: string;
}

export interface IngestResult {
  skipped: boolean;
  startedAt: string;
  results: SourceRunResult[];
}

const state = globalThis as unknown as {
  __trendtrackerIngest?: { running?: Promise<IngestResult>; lastFinishedAt?: number };
};
state.__trendtrackerIngest ??= {};

export function isIngesting(): boolean {
  return Boolean(state.__trendtrackerIngest?.running);
}

/** Collects every source once. Concurrent calls share the run in progress. */
export function runIngestion({ force = false } = {}): Promise<IngestResult> {
  const ingest = state.__trendtrackerIngest!;
  if (ingest.running) return ingest.running;

  if (!force && ingest.lastFinishedAt && Date.now() - ingest.lastFinishedAt < MIN_INTERVAL_MS) {
    return Promise.resolve({ skipped: true, startedAt: new Date().toISOString(), results: [] });
  }

  ingest.running = ingestAll().finally(() => {
    ingest.running = undefined;
    ingest.lastFinishedAt = Date.now();
  });
  return ingest.running;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError")
    return `Pas de réponse après ${SOURCE_TIMEOUT_MS / 1000} s`;
  return error instanceof Error ? error.message : String(error);
}

async function ingestAll(): Promise<IngestResult> {
  const startedAt = new Date();
  const db = await getDb();

  const outcomes = await Promise.all(
    adapters.map(async (adapter: SourceAdapter) => {
      const began = new Date();
      try {
        const result = await adapter.fetch(AbortSignal.timeout(SOURCE_TIMEOUT_MS));
        return { adapter, began, result };
      } catch (error) {
        console.warn(`[ingest] ${adapter.id} failed: ${errorMessage(error)}`);
        return { adapter, began, error: errorMessage(error) };
      }
    }),
  );

  const capturedAt = new Date();
  const observations: RepoObservation[] = [];
  const mentionInputs: MentionInput[] = [];
  for (const o of outcomes) {
    if (o.result) {
      observations.push(...o.result.repos);
      mentionInputs.push(...o.result.mentions);
    }
  }

  const merged = mergeObservations(observations);
  await db.transaction(async (tx) => {
    const ids = await upsertRepos(tx, merged, capturedAt);
    await snapshotStars(tx, merged, ids, capturedAt);

    // Trending lists are replaced only when the page was read successfully.
    const listed = observations.filter((o) => o.trending);
    if (listed.length > 0) {
      await tx.delete(trending);
      await tx.insert(trending).values(
        [
          ...new Map(
            listed.map((o) => [`${o.trending!.period}:${o.trending!.language}:${o.trending!.rank}`, o]),
          ).values(),
        ].map((o) => ({
          period: o.trending!.period,
          language: o.trending!.language,
          rank: o.trending!.rank,
          repoId: ids.get(`${o.owner}/${o.name}`.toLowerCase())!,
          gained: o.trending!.gained,
          capturedAt,
        })),
      );

      // Keep the day's best rank on the main list: it feeds the rank history and badges.
      const today = capturedAt.toISOString().slice(0, 10);
      const daily = listed.filter((o) => o.trending!.period === "day" && o.trending!.language === "");
      if (daily.length > 0) {
        await tx
          .insert(trendingDays)
          .values(
            daily.map((o) => ({
              day: today,
              repoId: ids.get(`${o.owner}/${o.name}`.toLowerCase())!,
              rank: o.trending!.rank,
              gained: o.trending!.gained,
            })),
          )
          .onConflictDoUpdate({
            target: [trendingDays.day, trendingDays.repoId],
            set: {
              rank: sql.raw(`least("trending_days"."rank", excluded.rank)`),
              gained: sql.raw(`greatest("trending_days"."gained", excluded.gained)`),
            },
          });
      }
    }

    await saveMentions(tx, mentionInputs, capturedAt);

    for (const o of outcomes) {
      await tx.insert(sourceRuns).values({
        source: o.adapter.id,
        startedAt: o.began,
        finishedAt: new Date(),
        status: o.result ? "ok" : "error",
        itemCount: o.result ? o.result.repos.length + o.result.mentions.length : 0,
        error: o.error ?? null,
      });
    }
  });

  const enrichment = await enrich();
  // E-mails go out after the data they describe is saved; a failure never breaks collection.
  await runAlerts().catch((error) => console.error("[alerts]", error));

  await compactSnapshots().catch((error) => console.error("[ingest] compaction", error));
  await db
    .delete(repoSnapshots)
    .where(lt(repoSnapshots.capturedAt, new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86_400_000)));
  await db.delete(mentions).where(lt(mentions.publishedAt, new Date(Date.now() - MENTION_RETENTION_DAYS * 86_400_000)));
  // The live refresh logs a run every minute: two days of history is plenty.
  await db.delete(sourceRuns).where(lt(sourceRuns.finishedAt, new Date(Date.now() - 2 * 86_400_000)));

  const results: SourceRunResult[] = [
    ...outcomes.map((o) => ({
      source: o.adapter.id,
      status: o.result ? ("ok" as const) : ("error" as const),
      itemCount: o.result ? o.result.repos.length + o.result.mentions.length : 0,
      error: o.error,
    })),
    enrichment,
  ];
  const summary = results.map((r) => `${r.source}:${r.status === "ok" ? r.itemCount : "✗"}`).join(" ");
  console.log(`[ingest] ${summary} (${Date.now() - startedAt.getTime()} ms)`);
  return { skipped: false, startedAt: startedAt.toISOString(), results };
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

async function saveMentions(tx: Tx, inputs: MentionInput[], seenAt: Date) {
  const unique = [...new Map(inputs.map((m) => [`${m.source}:${m.externalId}`, m])).values()];
  if (unique.length === 0) return;

  const rows = await tx
    .insert(mentions)
    .values(
      unique.map((m) => ({
        source: m.source,
        externalId: m.externalId,
        title: m.title,
        url: m.url,
        author: m.author ?? null,
        score: Math.round(m.score),
        comments: m.comments ?? null,
        image: m.image ?? null,
        publishedAt: m.publishedAt,
        firstSeenAt: seenAt,
      })),
    )
    .onConflictDoUpdate({
      target: [mentions.source, mentions.externalId],
      set: {
        title: sql.raw("excluded.title"),
        score: sql.raw("excluded.score"),
        comments: sql.raw("excluded.comments"),
        image: sql.raw("coalesce(excluded.image, mentions.image)"),
      },
    })
    .returning({ id: mentions.id, source: mentions.source, externalId: mentions.externalId });

  const mentionIds = new Map(rows.map((r) => [`${r.source}:${r.externalId}`, r.id]));
  // A repository mentioned recently counts as seen now; an old video does not revive it.
  const recent = Date.now() - 7 * 86_400_000;
  const repoIds = await ensureRepos(
    tx,
    unique.filter((m) => m.publishedAt.getTime() > recent).flatMap((m) => m.repos),
    seenAt,
  );
  const older = await ensureRepos(
    tx,
    unique.filter((m) => m.publishedAt.getTime() <= recent).flatMap((m) => m.repos),
    new Date(0),
  );
  for (const [key, id] of older) if (!repoIds.has(key)) repoIds.set(key, id);

  const links = unique.flatMap((m) =>
    m.repos.map((key) => ({
      mentionId: mentionIds.get(`${m.source}:${m.externalId}`)!,
      repoId: repoIds.get(key.toLowerCase())!,
    })),
  );
  for (let i = 0; i < links.length; i += 500) {
    await tx
      .insert(mentionRepos)
      .values(links.slice(i, i + 500))
      .onConflictDoNothing();
  }
}

/**
 * Fills in metadata (stars, topics, language…) for repositories only known from a link or a
 * trending row, and refreshes followed ones. Uses the search API with several `repo:`
 * qualifiers per query: ten repositories per call.
 */
async function enrich(): Promise<SourceRunResult> {
  const db = await getDb();
  const began = new Date();
  // With a token, GraphQL takes 50 repositories per request; without, the search API takes 10.
  const graphql = hasToken() && budget("graphql") > 50;
  const queries = graphql
    ? 8
    : Math.min(hasToken() ? 20 : 6, Number.isFinite(budget("search")) ? budget("search") - 1 : 30);
  if (queries <= 0) return { source: "github", status: "ok", itemCount: 0 };

  const followed = db.select({ id: boardRepos.repoId }).from(boardRepos);
  const stale = new Date(Date.now() - 12 * 3_600_000);
  const candidates = await db
    .select({ key: repos.key, owner: repos.owner, name: repos.name })
    .from(repos)
    .where(
      and(
        lte(repos.misses, 2),
        or(isNull(repos.enrichedAt), lt(repos.enrichedAt, stale)),
        or(gt(repos.lastSeenAt, new Date(Date.now() - 7 * 86_400_000)), inArray(repos.id, followed)),
      ),
    )
    .orderBy(
      sql`${repos.id} in (${followed}) desc`,
      sql`${repos.enrichedAt} is null desc`,
      desc(repos.lastSeenAt),
      asc(repos.id),
    )
    .limit(queries * (graphql ? 50 : 10));

  let found = 0;
  let error: string | undefined;
  const save = async (items: ApiRepo[], batch: typeof candidates) => {
    const now = new Date();
    const merged = mergeObservations(items.map(fromApi));
    await upsertRepos(db, merged, now);
    const ids = new Map(
      (
        await db
          .select({ id: repos.id, key: repos.key })
          .from(repos)
          .where(inArray(repos.key, [...merged.keys()]))
      ).map((r) => [r.key, r.id]),
    );
    await snapshotStars(db, merged, ids, now);
    await markMissing(
      db,
      batch.map((c) => c.key).filter((key) => !merged.has(key)),
    );
    found += merged.size;
  };

  if (graphql && candidates.length > 0) {
    try {
      const { repos: found } = await graphqlRepos(
        candidates.map((c) => c.key),
        "full",
        AbortSignal.timeout(SOURCE_TIMEOUT_MS * 2),
      );
      await save([...found.values()], candidates);
    } catch (e) {
      error = errorMessage(e);
    }
    candidates.length = 0;
  }

  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    try {
      const items = await searchRepos(
        `${batch.map((c) => `repo:${c.owner}/${c.name}`).join(" ")} fork:true`,
        AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      );
      await save(items, batch);
    } catch (e) {
      // One deleted or renamed repository makes GitHub reject the whole search (422):
      // look this batch up one by one instead, renames included.
      if (!(e instanceof RateLimitedError) && budget("core") > batch.length + 5) {
        try {
          const items = await Promise.all(
            batch.map((c) => getRepo(c.owner, c.name, AbortSignal.timeout(SOURCE_TIMEOUT_MS)).catch(() => null)),
          );
          await save(
            items.filter((item): item is ApiRepo => item !== null),
            batch,
          );
          continue;
        } catch (inner) {
          e = inner;
        }
      }
      error = errorMessage(e);
      if (e instanceof RateLimitedError) break;
    }
  }

  await db.insert(sourceRuns).values({
    source: "github",
    startedAt: began,
    finishedAt: new Date(),
    status: error && found === 0 ? "error" : "ok",
    itemCount: found,
    error: error ?? null,
  });
  return { source: "github", status: error && found === 0 ? "error" : "ok", itemCount: found, error };
}

/**
 * Keeps the snapshot table small without losing the curve: every snapshot for six hours, then
 * one per half hour up to three days, one per four hours up to a month, one per day after.
 */
async function compactSnapshots() {
  const db = await getDb();
  const tiers: [fromHours: number, toHours: number, bucket: string][] = [
    [6, 72, "30 minutes"],
    [72, 24 * 31, "4 hours"],
    [24 * 31, 24 * SNAPSHOT_RETENTION_DAYS, "1 day"],
  ];
  for (const [fromHours, toHours, bucket] of tiers) {
    const newest = new Date(Date.now() - fromHours * 3_600_000).toISOString();
    const oldest = new Date(Date.now() - toHours * 3_600_000).toISOString();
    await db.execute(sql`
      delete from repo_snapshots where id in (
        select id from (
          select id, row_number() over (
            partition by repo_id, date_bin(${sql.raw(`'${bucket}'`)}::interval, captured_at, timestamptz '2000-01-01')
            order by captured_at desc
          ) as n
          from repo_snapshots
          where captured_at < ${newest} and captured_at >= ${oldest}
        ) ranked where n > 1
      )`);
  }
}
