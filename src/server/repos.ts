import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { repoSnapshots, repos } from "./db/schema";
import type { RepoObservation } from "./sources/types";

type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Merges several observations of the same repository: API data wins, then any non-empty value. */
export function mergeObservations(observations: RepoObservation[]): Map<string, RepoObservation> {
  const merged = new Map<string, RepoObservation>();
  for (const obs of observations) {
    const key = `${obs.owner}/${obs.name}`.toLowerCase();
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...obs, trending: undefined });
      continue;
    }
    const [base, extra] = obs.complete && !current.complete ? [obs, current] : [current, obs];
    const next: RepoObservation = { ...base };
    for (const [field, value] of Object.entries(extra) as [keyof RepoObservation, unknown][]) {
      if (field === "trending") continue;
      if ((next[field] === undefined || next[field] === null) && value !== undefined && value !== null) {
        (next as unknown as Record<string, unknown>)[field] = value;
      }
    }
    merged.set(key, next);
  }
  return merged;
}

const keep = (column: string) => sql.raw(`coalesce(excluded.${column}, "repos"."${column}")`);

/** Inserts or updates repositories, returning their ids by key. */
export async function upsertRepos(
  db: Executor,
  observations: Map<string, RepoObservation>,
  seenAt: Date,
  lastSeenAt: Date = seenAt,
): Promise<Map<string, number>> {
  if (observations.size === 0) return new Map();
  const rows = [...observations].map(([key, o]) => ({
    key,
    owner: o.owner,
    name: o.name,
    githubId: o.githubId ?? null,
    description: o.description ?? null,
    homepage: o.homepage ?? null,
    language: o.language ?? null,
    topics: o.topics ?? [],
    license: o.license ?? null,
    avatar: o.avatar ?? null,
    stars: o.stars ?? null,
    forks: o.forks ?? null,
    openIssues: o.openIssues ?? null,
    archived: o.archived ?? false,
    ghCreatedAt: o.createdAt ?? null,
    pushedAt: o.pushedAt ?? null,
    enrichedAt: o.complete ? seenAt : null,
    misses: 0,
    firstSeenAt: seenAt,
    lastSeenAt,
  }));

  const ids = new Map<string, number>();
  // Chunked: a single statement with thousands of parameters is slow on PGlite.
  for (let i = 0; i < rows.length; i += 200) {
    const result = await db
      .insert(repos)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: repos.key,
        set: {
          owner: sql.raw(`case when excluded.enriched_at is not null then excluded.owner else "repos"."owner" end`),
          name: sql.raw(`case when excluded.enriched_at is not null then excluded.name else "repos"."name" end`),
          githubId: keep("github_id"),
          description: keep("description"),
          homepage: keep("homepage"),
          language: keep("language"),
          topics: sql.raw(`case when excluded.enriched_at is not null then excluded.topics else "repos"."topics" end`),
          license: keep("license"),
          avatar: keep("avatar"),
          stars: keep("stars"),
          forks: keep("forks"),
          openIssues: keep("open_issues"),
          archived: sql.raw(
            `case when excluded.enriched_at is not null then excluded.archived else "repos"."archived" end`,
          ),
          ghCreatedAt: keep("gh_created_at"),
          pushedAt: keep("pushed_at"),
          enrichedAt: keep("enriched_at"),
          misses: sql.raw(`case when excluded.enriched_at is not null then 0 else "repos"."misses" end`),
          lastSeenAt: sql.raw(`greatest(excluded.last_seen_at, "repos"."last_seen_at")`),
        },
      })
      .returning({ id: repos.id, key: repos.key });
    for (const row of result) ids.set(row.key, row.id);
  }
  return ids;
}

/** Snapshots closer than this add nothing: gains are computed from the live count anyway. */
export const SNAPSHOT_SPACING_MS = 4 * 60_000;

/**
 * Records star counts. A repository gets a new snapshot only when its count moved and its
 * last snapshot is at least SNAPSHOT_SPACING_MS old (the live count is kept on the row).
 */
export async function snapshotStars(
  db: Executor,
  observations: Map<string, RepoObservation>,
  ids: Map<string, number>,
  capturedAt: Date,
): Promise<number> {
  const counted = [...observations].filter(([, o]) => typeof o.stars === "number");
  if (counted.length === 0) return 0;
  const repoIds = counted.map(([key]) => ids.get(key)!).filter(Boolean);
  const latest = await db
    .selectDistinctOn([repoSnapshots.repoId], {
      repoId: repoSnapshots.repoId,
      stars: repoSnapshots.stars,
      capturedAt: repoSnapshots.capturedAt,
    })
    .from(repoSnapshots)
    .where(inArray(repoSnapshots.repoId, repoIds))
    .orderBy(repoSnapshots.repoId, desc(repoSnapshots.capturedAt));
  const last = new Map(latest.map((row) => [row.repoId, row]));
  const values = counted
    .map(([key, o]) => ({ repoId: ids.get(key)!, capturedAt, stars: o.stars!, forks: o.forks ?? null }))
    .filter((v) => {
      if (!v.repoId) return false;
      const previous = last.get(v.repoId);
      if (!previous) return true;
      return (
        previous.stars !== v.stars &&
        capturedAt.getTime() - new Date(previous.capturedAt).getTime() >= SNAPSHOT_SPACING_MS
      );
    });
  for (let i = 0; i < values.length; i += 500) await db.insert(repoSnapshots).values(values.slice(i, i + 500));
  return values.length;
}

/** Makes sure a repository row exists for a key seen in a link, without overwriting anything. */
export async function ensureRepos(db: Executor, keys: string[], seenAt: Date): Promise<Map<string, number>> {
  const unique = [...new Map(keys.map((k) => [k.toLowerCase(), k])).entries()];
  if (unique.length === 0) return new Map();
  const ids = new Map<string, number>();
  for (let i = 0; i < unique.length; i += 200) {
    const rows = await db
      .insert(repos)
      .values(
        unique.slice(i, i + 200).map(([key, original]) => {
          const [owner, name] = original.split("/");
          return {
            key,
            owner,
            name,
            avatar: `https://github.com/${owner}.png?size=96`,
            firstSeenAt: seenAt,
            lastSeenAt: seenAt,
          };
        }),
      )
      .onConflictDoUpdate({
        target: repos.key,
        set: { lastSeenAt: sql`greatest("repos"."last_seen_at", excluded.last_seen_at)` },
      })
      .returning({ id: repos.id, key: repos.key });
    for (const row of rows) ids.set(row.key, row.id);
  }
  return ids;
}

export async function findRepo(db: Executor, key: string) {
  const [row] = await db.select().from(repos).where(eq(repos.key, key.toLowerCase())).limit(1);
  return row ?? null;
}

export async function markMissing(db: Executor, keys: string[]) {
  if (keys.length === 0) return;
  await db
    .update(repos)
    .set({ misses: sql`${repos.misses} + 1` })
    .where(and(inArray(repos.key, keys)));
}
