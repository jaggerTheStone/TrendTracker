import { and, desc, eq, gt, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import type { Badge, Mention, MentionSource, RepoDetail, RepoSummary } from "@/lib/types";
import { getDb } from "./db/client";
import { mentionRepos, mentions, repoCache, repoSnapshots, trendingDays, type repos } from "./db/schema";
import {
  budget,
  getCommitActivity,
  getContributorsCount,
  getLanguages,
  getReadmeHtml,
  getReleases,
  getRepo,
  getMergedPrs,
} from "./github/api";
import { formatCompact } from "@/lib/format";
import { getOverview, getScoreReference, loadScoringInputs, summarize } from "./overview";
import { findRepo, mergeObservations, snapshotStars, upsertRepos } from "./repos";
import { fromApi } from "./sources/types";

const METADATA_TTL = 60 * 60_000;
const CACHE_TTL = 6 * 60 * 60_000;

type RepoRow = typeof repos.$inferSelect;

/**
 * Loads a repository by "owner/name", fetching it from GitHub when we do not know it yet
 * or our copy is more than an hour old. Null when it does not exist on GitHub.
 */
export async function resolveRepo(owner: string, name: string): Promise<RepoRow | null> {
  const db = await getDb();
  const key = `${owner}/${name}`.toLowerCase();
  const existing = await findRepo(db, key);
  const fresh = existing?.enrichedAt && Date.now() - existing.enrichedAt.getTime() < METADATA_TTL;
  if (existing && (fresh || budget("core") < 3)) return existing;

  try {
    const api = await getRepo(owner, name, AbortSignal.timeout(10_000));
    if (!api) return existing && existing.stars !== null ? existing : null;
    const now = new Date();
    const merged = mergeObservations([fromApi(api)]);
    // Opening a page does not make a repository "active": keep its last-seen date.
    const ids = await upsertRepos(db, merged, now, existing?.lastSeenAt ?? new Date(0));
    await snapshotStars(db, merged, ids, now);
    // A repository renamed on GitHub comes back under its new name.
    return findRepo(db, api.full_name);
  } catch (error) {
    if (existing && existing.stars !== null) return existing;
    throw error;
  }
}

/** README links and images point to the repository, not to us. */
function cleanReadme(html: string, owner: string, name: string): string {
  const raw = `https://raw.githubusercontent.com/${owner}/${name}/HEAD/`;
  const blob = `https://github.com/${owner}/${name}/blob/HEAD/`;
  const absolute = (url: string, base: string) => {
    if (/^(https?:|mailto:|#|data:)/i.test(url)) return url;
    try {
      return new URL(url.replace(/^\.?\//, ""), base).toString();
    } catch {
      return url;
    }
  };
  return sanitizeHtml(html.length > 400_000 ? html.slice(0, 400_000) : html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "picture",
      "source",
      "details",
      "summary",
      "h1",
      "h2",
      "kbd",
      "sup",
      "sub",
      "del",
      "input",
    ]),
    allowedAttributes: {
      a: ["href", "name", "id"],
      img: ["src", "alt", "width", "height", "align"],
      source: ["srcset", "media", "type"],
      input: ["type", "checked", "disabled"],
      "*": ["align", "id"],
      td: ["align", "colspan", "rowspan"],
      th: ["align", "colspan", "rowspan"],
      code: ["class"],
      pre: ["lang"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.href ? { href: absolute(attribs.href, blob), target: "_blank", rel: "noreferrer" } : {}),
        },
      }),
      img: (tag, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, ...(attribs.src ? { src: absolute(attribs.src, raw), loading: "lazy" } : {}) },
      }),
      source: (tag, attribs) => ({
        tagName: "source",
        attribs: { ...attribs, ...(attribs.srcset ? { srcset: absolute(attribs.srcset.split(" ")[0], raw) } : {}) },
      }),
    },
  });
}

async function loadCache(row: RepoRow) {
  const db = await getDb();
  const [cached] = await db.select().from(repoCache).where(eq(repoCache.repoId, row.id)).limit(1);
  const complete = cached && cached.commits !== null && cached.mergedPrs !== null;
  if (cached && Date.now() - cached.fetchedAt.getTime() < (complete ? CACHE_TTL : 10 * 60_000)) return cached;
  if (budget("core") < 8) return cached ?? null;

  const signal = AbortSignal.timeout(15_000);
  const { owner, name } = row;
  const settle = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [readme, languages, releases, commits, contributors, mergedPrs] = await Promise.all([
    settle(getReadmeHtml(owner, name, signal), cached?.readmeHtml ?? null),
    settle(getLanguages(owner, name, signal), cached?.languages ?? []),
    settle(getReleases(owner, name, signal), cached?.releases ?? []),
    settle(getCommitActivity(owner, name, signal), cached?.commits ?? null),
    settle(getContributorsCount(owner, name, signal), cached?.contributors ?? null),
    budget("search") > 3
      ? settle(getMergedPrs(owner, name, since, signal), cached?.mergedPrs ?? null)
      : Promise.resolve(cached?.mergedPrs ?? null),
  ]);

  const value = {
    repoId: row.id,
    readmeHtml: readme ? cleanReadme(readme, owner, name) : null,
    languages,
    releases,
    // GitHub no longer lists stargazers (404 with any token, empty in GraphQL): the curve
    // comes from our own snapshots; samples taken before that change are kept.
    starHistory: cached?.starHistory ?? [],
    commits,
    contributors,
    mergedPrs,
    fetchedAt: new Date(),
  };
  await db.insert(repoCache).values(value).onConflictDoUpdate({ target: repoCache.repoId, set: value });
  return value;
}

export async function getRepoDetail(owner: string, name: string): Promise<RepoDetail | null> {
  const row = await resolveRepo(owner, name);
  if (!row) return null;
  const db = await getDb();

  const [cached, inputs, overview, linked] = await Promise.all([
    loadCache(row),
    loadScoringInputs([row]),
    getOverview(),
    db
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
      })
      .from(mentionRepos)
      .innerJoin(mentions, eq(mentions.id, mentionRepos.mentionId))
      .where(eq(mentionRepos.repoId, row.id))
      .orderBy(desc(mentions.publishedAt))
      .limit(30),
  ]);

  // Scored against the active pool, from the freshest counts: same momentum as in the lists.
  const base: RepoSummary = summarize(inputs, { reference: await getScoreReference() })[0];
  // Summaries shorten descriptions for lists; the page shows it in full.
  const repo: RepoSummary = { ...base, description: row.description, topics: row.topics };

  const topics = new Set(row.topics);
  const similar = overview.repos
    .filter((r) => r.key !== row.key)
    .map((r) => {
      const shared = r.topics.filter((t) => topics.has(t)).length;
      return { r, score: shared * 2 + (r.domain === repo.domain ? 1 : 0) + (r.language === row.language ? 0.5 : 0) };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || b.r.momentum - a.r.momentum)
    .slice(0, 6)
    .map((x) => x.r);

  const DAY = 86_400_000;
  const now = Date.now();
  // Our own snapshots, hourly (thinned out further back), extend the sampled history to today.
  const ownHistory = (
    await db
      .select({
        t: sql<string>`max(${repoSnapshots.capturedAt})`,
        stars: sql<number>`max(${repoSnapshots.stars})`,
        forks: sql<number | null>`max(${repoSnapshots.forks})`,
      })
      .from(repoSnapshots)
      .where(eq(repoSnapshots.repoId, row.id))
      .groupBy(sql`date_trunc('hour', ${repoSnapshots.capturedAt})`)
      .orderBy(sql`1`)
  ).map((p) => ({
    t: new Date(p.t).getTime(),
    stars: Number(p.stars),
    forks: p.forks === null ? null : Number(p.forks),
  }));
  const current = { t: now, stars: row.stars ?? ownHistory.at(-1)?.stars ?? 0, forks: row.forks };

  const sampled = cached?.starHistory ?? [];
  const firstOwn = ownHistory[0]?.t ?? Infinity;
  const starHistory = [
    ...sampled.filter((p) => new Date(p.t).getTime() < firstOwn),
    ...ownHistory.filter((p) => p.t < now - 60_000).map((p) => ({ t: new Date(p.t).toISOString(), stars: p.stars })),
    { t: new Date(now).toISOString(), stars: current.stars },
  ];

  const days = await db
    .select({ day: trendingDays.day, rank: trendingDays.rank, gained: trendingDays.gained })
    .from(trendingDays)
    .where(
      and(eq(trendingDays.repoId, row.id), gt(trendingDays.day, new Date(now - 60 * DAY).toISOString().slice(0, 10))),
    )
    .orderBy(trendingDays.day);

  // Per UTC day, midnight to midnight (to now for today): the count at each boundary is read
  // between the snapshots around it. Days we did not watch from their start stay empty.
  const perDay = (points: { t: number; value: number }[]) => {
    const out: { day: string; gained: number }[] = [];
    const at = (t: number) => {
      const i = points.findLastIndex((p) => p.t <= t);
      if (i < 0) return null;
      const a = points[i];
      const b = points[i + 1] ?? a;
      return b.t <= a.t ? a.value : a.value + ((b.value - a.value) * (t - a.t)) / (b.t - a.t);
    };
    const date = new Date(now);
    const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    for (let d = today - 29 * DAY; d <= today; d += DAY) {
      const start = at(d);
      const end = at(Math.min(d + DAY, now));
      if (start === null || end === null) continue;
      out.push({ day: new Date(d).toISOString().slice(0, 10), gained: Math.max(0, Math.round(end - start)) });
    }
    return out;
  };
  const dailyStars = perDay([...ownHistory.map((p) => ({ t: p.t, value: p.stars })), { t: now, value: current.stars }]);
  const forkPoints = ownHistory.filter((p) => p.forks !== null).map((p) => ({ t: p.t, value: p.forks! }));
  const dailyForks = perDay(current.forks !== null ? [...forkPoints, { t: now, value: current.forks }] : forkPoints);

  return {
    repo,
    homepage: row.homepage,
    license: row.license,
    openIssues: row.openIssues,
    pushedAt: row.pushedAt?.toISOString() ?? null,
    archived: row.archived,
    readmeHtml: cached?.readmeHtml ?? null,
    languages: cached?.languages ?? [],
    releases: cached?.releases ?? [],
    starHistory,
    commits: cached?.commits ?? null,
    contributors: cached?.contributors ?? null,
    mentions: linked.map((m): Mention => ({
      ...m,
      source: m.source as MentionSource,
      publishedAt: m.publishedAt.toISOString(),
      repos: [row.key],
    })),
    similar,
    trendingDays: days,
    dailyStars,
    dailyForks,
    dailyPrs: (cached?.mergedPrs ?? []).map((p) => ({ day: p.day, gained: p.count })),
    badges: badgesFor(row, days, linked),
  };
}

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Achievements, from our Trending archive (only the days we collected) and from where the
 * repository was talked about. Each label states exactly what was observed.
 */
function badgesFor(
  row: RepoRow,
  days: { day: string; rank: number }[],
  linked: { source: string; score: number }[],
): Badge[] {
  const badges: Badge[] = [];
  const firsts = days.filter((d) => d.rank === 1);
  const best = days.length > 0 ? Math.min(...days.map((d) => d.rank)) : Infinity;
  if (firsts.length > 1) badges.push({ kind: "first", label: `N°1 du Trending · ${firsts.length} jours` });
  else if (firsts.length === 1) badges.push({ kind: "first", label: `N°1 du Trending le ${dayLabel(firsts[0].day)}` });
  else if (best <= 10) {
    const on = days.find((d) => d.rank === best)!;
    badges.push({ kind: "top10", label: `N°${best} du Trending le ${dayLabel(on.day)}` });
  }

  // Consecutive days up to today (or yesterday, before today's list has picked it up).
  const DAY = 86_400_000;
  const listed = new Set(days.map((d) => d.day));
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  let cursor = Date.now();
  if (!listed.has(iso(cursor))) cursor -= DAY;
  let streak = 0;
  while (listed.has(iso(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  if (streak >= 2) badges.push({ kind: "streak", label: `${streak} jours d'affilée dans le Trending` });
  else if (days.length >= 3) badges.push({ kind: "streak", label: `${days.length} jours dans le Trending (60 j)` });

  const age = row.ghCreatedAt ? (Date.now() - row.ghCreatedAt.getTime()) / DAY : Infinity;
  if (age <= 30 && (row.stars ?? 0) >= 1000) {
    const n = Math.max(1, Math.ceil(age));
    badges.push({ kind: "rocket", label: `${formatCompact(row.stars ?? 0)} ★ en ${n} jour${n > 1 ? "s" : ""}` });
  }
  const videos = linked.filter((m) => m.source === "youtube").length;
  if (videos > 0) badges.push({ kind: "youtube", label: videos > 1 ? `${videos} vidéos YouTube` : "1 vidéo YouTube" });
  const hn = Math.max(0, ...linked.filter((m) => m.source === "hackernews").map((m) => m.score));
  if (hn >= 100) badges.push({ kind: "hackernews", label: `${hn} points sur Hacker News` });
  return badges;
}
