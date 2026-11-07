import { and, desc, eq, gt, inArray, isNotNull, lte, max, or, sql } from "drizzle-orm";
import type { Domain } from "@/lib/domains";
import {
  MENTION_SOURCES,
  SOURCE_IDS,
  type Mention,
  type MentionSource,
  type Overview,
  type Period,
  type PulseEvent,
  type RepoStatus,
  type RepoSummary,
  type SourceStatus,
} from "@/lib/types";
import { analystEnabled } from "./analyst";
import { classify } from "./classify";
import { getDb } from "./db/client";
import { boardRepos, mentionRepos, mentions, repoSnapshots, repos, sourceRuns, trending } from "./db/schema";
import { env, googleEnabled, mailTransport } from "./env";
import { hasToken } from "./github/api";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ACTIVE_DAYS = 7;
const MAX_REPOS = 320;
const MAX_MENTIONS = 160;

type RepoRow = typeof repos.$inferSelect;
/** A star count at a time (ms). */
type Point = { t: number; stars: number };

const WINDOWS: Record<Period, number> = { day: DAY, week: 7 * DAY, month: 30 * DAY };
const PERIODS = ["day", "week", "month"] as const;
/** "prev" (48 h ago) gives the day before the last 24 h, a baseline when the week is unknown. */
const ANCHOR_WINDOWS = { ...WINDOWS, prev: 2 * DAY };
type AnchorId = keyof typeof ANCHOR_WINDOWS;
const ANCHOR_IDS = Object.keys(ANCHOR_WINDOWS) as AnchorId[];

/** Our snapshots around the start of each window: the last one before it, the first one after. */
type Anchors = Record<AnchorId, { before: Point | null; after: Point | null }>;

/** Sorted positive values of the whole active pool: percentiles are always taken against it. */
export interface ScoreReference {
  velocity: number[];
  growth: number[];
}

/** Share of the reference at or below `v` (0 for zero or negative values). */
function percentile(sorted: number[], v: number): number {
  if (v <= 0 || sorted.length === 0) return 0;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

/** Star count at time t, linear between the snapshots that surround it. */
function valueAt(before: Point, after: Point, t: number): number {
  if (after.t <= before.t) return before.stars;
  const f = Math.min(1, Math.max(0, (t - before.t) / (after.t - before.t)));
  return before.stars + (after.stars - before.stars) * f;
}

/**
 * Stars gained over the window ending now. Exact when a snapshot predates the window start
 * (interpolated between the snapshots around it); extrapolated from our first snapshot inside
 * the window when we have watched at least half of it; unknown otherwise.
 */
function measuredGain(
  anchors: { before: Point | null; after: Point | null },
  current: Point,
  ms: number,
): { value: number; exact: boolean } | null {
  const start = current.t - ms;
  const { before, after } = anchors;
  if (before) {
    return { value: Math.max(0, Math.round(current.stars - valueAt(before, after ?? current, start))), exact: true };
  }
  if (after && current.t - after.t >= ms / 2) {
    const rate = (current.stars - after.stars) / (current.t - after.t);
    return { value: Math.max(0, Math.round(rate * ms)), exact: false };
  }
  return null;
}

/** 25 points over the last 48 hours (every 2 h), only where our snapshots cover it. */
function sparkline(series: Point[], current: Point): number[] {
  const points = [...series.filter((p) => p.t < current.t), current];
  if (points.length < 2) return [];
  const out: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = current.t - (24 - i) * 2 * HOUR;
    if (t < points[0].t) continue;
    const j = points.findLastIndex((p) => p.t <= t);
    out.push(Math.round(valueAt(points[j], points[Math.min(j + 1, points.length - 1)], t)));
  }
  return out.length >= 4 ? out : [];
}

const BUZZ_WEIGHT: Record<MentionSource, (score: number) => number> = {
  youtube: (views) => 1.5 + Math.min(Math.log10(1 + views) / 3, 1.5),
  hackernews: (points) => 1 + Math.min(points / 100, 3),
  lobsters: (points) => 0.8 + Math.min(points / 40, 1),
  mastodon: (boosts) => 0.4 + Math.min(boosts / 50, 0.6),
  bluesky: (interactions) => 0.4 + Math.min(interactions / 50, 0.6),
};

export interface ScoringInput {
  row: RepoRow;
  /** Hourly star counts over the last 50 hours, oldest first. */
  series: Point[];
  anchors: Anchors;
  trend: Partial<Record<Period, number>>;
  rank: number | null;
  mentions: { source: MentionSource; score: number }[];
}

/**
 * Turns raw rows into scored summaries. Percentiles are taken against `reference` (the active
 * pool, see getScoreReference) so that a repository scored alone gets the same momentum as in
 * the overview; without it, the inputs are their own reference.
 */
export function summarize(
  inputs: ScoringInput[],
  { now = Date.now(), reference }: { now?: number; reference?: ScoreReference } = {},
): RepoSummary[] {
  const base = inputs.map(({ row, series, anchors, trend, rank, mentions: linked }) => {
    const stars = row.stars ?? series.at(-1)?.stars ?? 0;
    const current: Point = { t: now, stars };
    const created = row.ghCreatedAt?.getTime() ?? null;
    const age = created === null ? Infinity : now - created;

    const gained = {} as Record<Period, number | null>;
    for (const period of PERIODS) {
      const ms = WINDOWS[period];
      // Created inside the window: every star it has was gained inside it.
      if (age <= ms) {
        gained[period] = stars;
        continue;
      }
      const measured = measuredGain(anchors[period], current, ms);
      gained[period] = measured?.exact ? measured.value : (trend[period] ?? measured?.value ?? null);
    }
    // A longer window never holds fewer stars than a shorter one, nor more than the total.
    if (gained.day !== null) gained.day = Math.min(gained.day, stars);
    if (gained.week !== null) gained.week = Math.min(Math.max(gained.week, gained.day ?? 0), stars);
    if (gained.month !== null) gained.month = Math.min(Math.max(gained.month, gained.week ?? 0), stars);

    const velocity =
      gained.day ?? (gained.week !== null ? gained.week / 7 : gained.month !== null ? gained.month / 30 : 0);
    const growth = age > 7 * DAY && gained.week !== null ? gained.week / Math.max(stars - gained.week, 25) : null;

    // Today against the daily average of the days before (up to six, fewer for a young
    // repository), or against the previous 24 hours when the week is not known.
    const baselineDays = Math.min(6, Math.floor(age / DAY) - 1);
    const countAt = (id: AnchorId) => {
      const { before, after } = anchors[id];
      return before ? valueAt(before, after ?? current, now - ANCHOR_WINDOWS[id]) : null;
    };
    const dayAgo = countAt("day");
    const twoDaysAgo = countAt("prev");
    const previousDay =
      dayAgo !== null && twoDaysAgo !== null && age > 2 * DAY ? Math.max(0, dayAgo - twoDaysAgo) : null;
    const baseline =
      gained.day !== null && gained.week !== null && baselineDays >= 1
        ? (gained.week - gained.day) / baselineDays
        : previousDay;
    // Under one star a day the baseline says more about gaps in our snapshots than about the
    // repository: no ratio rather than a meaningless ×50.
    const acceleration =
      baseline !== null && baseline >= 1 && gained.day !== null ? Math.min(gained.day / baseline, 20) : null;

    const buzz = Object.fromEntries(MENTION_SOURCES.map((s) => [s, 0])) as Record<MentionSource, number>;
    let buzzScore = 0;
    for (const m of linked) {
      buzz[m.source] += 1;
      buzzScore += BUZZ_WEIGHT[m.source](m.score);
    }
    return {
      row,
      stars,
      age,
      gained,
      velocity,
      growth,
      baseline,
      acceleration,
      buzz,
      buzzScore,
      rank,
      spark: sparkline(series, current),
    };
  });

  const ref = reference ?? scoreReferenceOf(base);

  return base.map((b): RepoSummary => {
    const pVelocity = percentile(ref.velocity, b.velocity);
    const pGrowth = b.growth !== null ? percentile(ref.growth, b.growth) : b.age <= 14 * DAY ? 0.9 : 0;
    // 0.5 = usual pace, 1 = three times faster, 0 = stalled.
    const pAcceleration = b.acceleration === null ? 0.5 : Math.min(1, Math.max(0, (b.acceleration - 1) / 4 + 0.5));
    const buzz = Math.min(1, b.buzzScore / 6);
    const momentum = Math.round(100 * (0.6 * pVelocity + 0.15 * pGrowth + 0.1 * pAcceleration + 0.15 * buzz));

    let status: RepoStatus = "steady";
    const day = b.gained.day ?? 0;
    if (pVelocity >= 0.95 && b.velocity >= 100) status = "hot";
    else if (b.acceleration !== null && day >= 20 && b.acceleration >= 1.4) status = "rising";
    else if (b.acceleration !== null && b.baseline !== null && b.baseline >= 10 && b.acceleration <= 0.6)
      status = "cooling";
    else if (b.age <= 7 * DAY) status = "new";

    const { row } = b;
    const description =
      row.description && row.description.length > 180 ? `${row.description.slice(0, 178)}…` : row.description;
    return {
      key: row.key,
      owner: row.owner,
      name: row.name,
      description,
      language: row.language,
      topics: row.topics.slice(0, 8),
      domain: classify(row) as Domain,
      avatar: row.avatar ?? `https://github.com/${row.owner}.png?size=96`,
      stars: b.stars,
      forks: row.forks ?? 0,
      createdAt: row.ghCreatedAt?.toISOString() ?? null,
      gained: b.gained,
      growth: b.growth,
      acceleration: b.acceleration === null ? null : Math.round(b.acceleration * 100) / 100,
      momentum,
      status,
      rank: b.rank,
      buzz: b.buzz,
      spark: b.spark,
    };
  });
}

function scoreReferenceOf(base: { velocity: number; growth: number | null }[]): ScoreReference {
  const positive = (values: number[]) => values.filter((v) => v > 0).sort((a, b) => a - b);
  return {
    velocity: positive(base.map((b) => b.velocity)),
    growth: positive(base.map((b) => b.growth ?? 0)),
  };
}

const asTime = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string).getTime());

/** Everything needed to score a set of repositories. */
export async function loadScoringInputs(rows: RepoRow[], now = Date.now()): Promise<ScoringInput[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const c = repoSnapshots.capturedAt;
  const s = repoSnapshots.stars;

  // Last snapshot before, and first after, the start of each window: one scan over 32 days.
  const anchorColumns = Object.fromEntries(
    ANCHOR_IDS.flatMap((period) => {
      const t = new Date(now - ANCHOR_WINDOWS[period]).toISOString();
      return [
        [`${period}BeforeT`, sql<string | null>`max(${c}) filter (where ${c} <= ${t})`],
        [`${period}BeforeS`, sql<number | null>`(array_agg(${s} order by ${c} desc) filter (where ${c} <= ${t}))[1]`],
        [`${period}AfterT`, sql<string | null>`min(${c}) filter (where ${c} > ${t})`],
        [`${period}AfterS`, sql<number | null>`(array_agg(${s} order by ${c}) filter (where ${c} > ${t}))[1]`],
      ];
    }),
  ) as Record<string, ReturnType<typeof sql<unknown>>>;

  const [hourly, anchorRows, trend, linked] = await Promise.all([
    db
      .select({ repoId: repoSnapshots.repoId, t: sql<string>`max(${c})`, stars: sql<number>`max(${s})` })
      .from(repoSnapshots)
      .where(and(inArray(repoSnapshots.repoId, ids), gt(c, new Date(now - 50 * HOUR))))
      .groupBy(repoSnapshots.repoId, sql`date_trunc('hour', ${c})`),
    db
      .select({ repoId: repoSnapshots.repoId, ...anchorColumns })
      .from(repoSnapshots)
      .where(and(inArray(repoSnapshots.repoId, ids), gt(c, new Date(now - 32 * DAY))))
      .groupBy(repoSnapshots.repoId),
    db.select().from(trending).where(inArray(trending.repoId, ids)),
    db
      .select({ repoId: mentionRepos.repoId, source: mentions.source, score: mentions.score })
      .from(mentionRepos)
      .innerJoin(mentions, eq(mentions.id, mentionRepos.mentionId))
      .where(and(inArray(mentionRepos.repoId, ids), gt(mentions.publishedAt, new Date(now - 14 * DAY)))),
  ]);

  const seriesBy = new Map<number, Point[]>();
  for (const row of hourly) {
    const list = seriesBy.get(row.repoId) ?? [];
    list.push({ t: asTime(row.t)!, stars: Number(row.stars) });
    seriesBy.set(row.repoId, list);
  }
  for (const list of seriesBy.values()) list.sort((a, b) => a.t - b.t);

  const point = (t: unknown, stars: unknown): Point | null => {
    const time = asTime(t);
    return time === null ? null : { t: time, stars: Number(stars) };
  };
  const anchorsBy = new Map<number, Anchors>();
  for (const a of anchorRows as unknown as Record<string, unknown>[]) {
    const anchors = {} as Anchors;
    for (const period of ANCHOR_IDS) {
      anchors[period] = {
        before: point(a[`${period}BeforeT`], a[`${period}BeforeS`]),
        after: point(a[`${period}AfterT`], a[`${period}AfterS`]),
      };
    }
    anchorsBy.set(Number(a.repoId), anchors);
  }
  const none = Object.fromEntries(ANCHOR_IDS.map((id) => [id, { before: null, after: null }])) as Anchors;

  const trendBy = new Map<number, Partial<Record<Period, number>>>();
  const rankBy = new Map<number, number>();
  for (const t of trend) {
    const entry = trendBy.get(t.repoId) ?? {};
    const period = t.period as Period;
    entry[period] = Math.max(entry[period] ?? 0, t.gained);
    trendBy.set(t.repoId, entry);
    if (t.period === "day" && t.language === "") rankBy.set(t.repoId, t.rank);
  }
  const mentionsBy = new Map<number, { source: MentionSource; score: number }[]>();
  for (const m of linked) {
    const list = mentionsBy.get(m.repoId) ?? [];
    list.push({ source: m.source as MentionSource, score: m.score });
    mentionsBy.set(m.repoId, list);
  }

  return rows.map((row) => ({
    row,
    series: seriesBy.get(row.id) ?? [],
    anchors: anchorsBy.get(row.id) ?? none,
    trend: trendBy.get(row.id) ?? {},
    rank: rankBy.get(row.id) ?? null,
    mentions: mentionsBy.get(row.id) ?? [],
  }));
}

/** Identifier of the latest collection: changes whenever new data lands. */
export async function getLatestBuild(): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ at: max(sourceRuns.finishedAt) }).from(sourceRuns);
  return row?.at ? new Date(row.at).toISOString() : null;
}

const cache = globalThis as unknown as {
  __trendtrackerOverview?: { build: string; value: Overview; reference: ScoreReference };
};

/** Bumped when scoring changes, so a hot reload never serves numbers from the old formula. */
const SCORING_VERSION = 6;

export async function getOverview(): Promise<Overview> {
  const latest = await getLatestBuild();
  const build = `${latest}#${SCORING_VERSION}`;
  if (cache.__trendtrackerOverview && cache.__trendtrackerOverview.build === build) {
    return cache.__trendtrackerOverview.value;
  }
  const { value, reference } = await computeOverview(latest);
  cache.__trendtrackerOverview = { build, value, reference };
  return value;
}

/** The active pool's distribution, to score repositories outside the overview consistently. */
export async function getScoreReference(): Promise<ScoreReference> {
  await getOverview();
  return cache.__trendtrackerOverview!.reference;
}

async function computeOverview(build: string | null): Promise<{ value: Overview; reference: ScoreReference }> {
  const db = await getDb();
  const now = Date.now();
  const followed = db.select({ id: boardRepos.repoId }).from(boardRepos);

  const rows = await db
    .select()
    .from(repos)
    .where(
      and(
        isNotNull(repos.stars),
        lte(repos.misses, 2),
        or(gt(repos.lastSeenAt, new Date(now - ACTIVE_DAYS * DAY)), inArray(repos.id, followed)),
      ),
    );

  const all = summarize(await loadScoringInputs(rows, now), { now });
  const reference = scoreReferenceOf(
    all.map((r) => ({
      velocity:
        r.gained.day ??
        (r.gained.week !== null ? r.gained.week / 7 : r.gained.month !== null ? r.gained.month / 30 : 0),
      growth: r.growth,
    })),
  );
  const summaries = all.sort((a, b) => b.momentum - a.momentum || b.stars - a.stars).slice(0, MAX_REPOS);
  const keep = new Set(summaries.map((s) => s.key));

  const recentMentions = await db
    .select({
      id: mentions.id,
      source: mentions.source,
      title: mentions.title,
      url: mentions.url,
      author: mentions.author,
      score: mentions.score,
      comments: mentions.comments,
      image: mentions.image,
      publishedAt: mentions.publishedAt,
      key: repos.key,
    })
    .from(mentions)
    .innerJoin(mentionRepos, eq(mentionRepos.mentionId, mentions.id))
    .innerJoin(repos, eq(repos.id, mentionRepos.repoId))
    .where(gt(mentions.publishedAt, new Date(now - 14 * DAY)))
    .orderBy(desc(mentions.publishedAt));

  const byId = new Map<number, Mention>();
  for (const m of recentMentions) {
    if (!keep.has(m.key)) continue;
    const existing = byId.get(m.id);
    if (existing) {
      existing.repos.push(m.key);
      continue;
    }
    if (byId.size >= MAX_MENTIONS) continue;
    byId.set(m.id, {
      id: m.id,
      source: m.source as MentionSource,
      title: m.title,
      url: m.url,
      author: m.author,
      score: m.score,
      comments: m.comments,
      image: m.image,
      publishedAt: m.publishedAt.toISOString(),
      repos: [m.key],
    });
  }

  const value: Overview = {
    generatedAt: new Date(now).toISOString(),
    lastIngestAt: build,
    repos: summaries,
    mentions: [...byId.values()],
    pulse: await recentPulse(keep, now),
    sources: await sourceStatuses(),
    features: {
      ai: analystEnabled(),
      google: googleEnabled(),
      githubToken: hasToken(),
      devMail: mailTransport() === null && process.env.NODE_ENV !== "production",
      live: hasToken() && env().LIVE_INTERVAL_SECONDS > 0,
    },
  };
  return { value, reference };
}

/**
 * Stars gained over the last 30 minutes, one entry per repository (sum of the steps between
 * consecutive snapshots, time of the latest), biggest first.
 */
async function recentPulse(keep: Set<string>, now: number): Promise<PulseEvent[]> {
  const db = await getDb();
  const window = db
    .select({
      key: repos.key,
      at: repoSnapshots.capturedAt,
      delta: sql<
        number | null
      >`${repoSnapshots.stars} - lag(${repoSnapshots.stars}) over (partition by ${repoSnapshots.repoId} order by ${repoSnapshots.capturedAt})`.as(
        "delta",
      ),
    })
    .from(repoSnapshots)
    .innerJoin(repos, eq(repos.id, repoSnapshots.repoId))
    .where(gt(repoSnapshots.capturedAt, new Date(now - 45 * 60_000)))
    .as("w");
  const rows = await db
    .select()
    .from(window)
    .where(and(gt(window.at, new Date(now - 30 * 60_000)), gt(window.delta, 0)))
    .orderBy(desc(window.at))
    .limit(5000);
  const byKey = new Map<string, PulseEvent>();
  for (const r of rows) {
    if (!keep.has(r.key)) continue;
    const at = new Date(r.at).toISOString();
    const entry = byKey.get(r.key);
    if (entry) {
      entry.delta += Number(r.delta);
      if (at > entry.at) entry.at = at;
    } else byKey.set(r.key, { key: r.key, delta: Number(r.delta), at });
  }
  return [...byKey.values()].sort((a, b) => b.delta - a.delta || b.at.localeCompare(a.at)).slice(0, 60);
}

async function sourceStatuses(): Promise<SourceStatus[]> {
  const db = await getDb();
  const runs = await db
    .selectDistinctOn([sourceRuns.source])
    .from(sourceRuns)
    .orderBy(sourceRuns.source, desc(sourceRuns.finishedAt));
  return SOURCE_IDS.map((id) => {
    const run = runs.find((r) => r.source === id);
    return {
      id,
      ok: run?.status === "ok",
      at: run?.finishedAt.toISOString() ?? null,
      count: run?.itemCount ?? 0,
      error: run?.error ?? null,
    };
  });
}
