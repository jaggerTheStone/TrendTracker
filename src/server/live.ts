import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { boardRepos, repos, sourceRuns, trending } from "./db/schema";
import { graphqlRepos, hasToken, RateLimitedError } from "./github/api";
import { getOverview } from "./overview";
import { snapshotStars, upsertRepos } from "./repos";
import type { RepoObservation } from "./sources/types";

/** Ranked, followed and trending repositories: everything a screen can show. */
const MAX_LIVE = 600;

const state = globalThis as unknown as { __trendtrackerLive?: { running?: Promise<number> } };
state.__trendtrackerLive ??= {};

/**
 * Refreshes the star and fork counts of every repository on screen, a few GraphQL points per
 * run, so gains and rankings move between two full collections. Needs GITHUB_TOKEN.
 * Returns the number of repositories updated.
 */
export function refreshLive(): Promise<number> {
  const live = state.__trendtrackerLive!;
  if (!hasToken()) return Promise.resolve(0);
  live.running ??= run().finally(() => {
    live.running = undefined;
  });
  return live.running;
}

async function run(): Promise<number> {
  const began = new Date();
  const db = await getDb();
  const overview = await getOverview();
  const [followed, listed] = await Promise.all([
    db.selectDistinct({ key: repos.key }).from(boardRepos).innerJoin(repos, eq(repos.id, boardRepos.repoId)),
    db.selectDistinct({ key: repos.key }).from(trending).innerJoin(repos, eq(repos.id, trending.repoId)),
  ]);
  const keys = [
    ...new Set([...overview.repos.map((r) => r.key), ...followed.map((f) => f.key), ...listed.map((l) => l.key)]),
  ].slice(0, MAX_LIVE);
  if (keys.length === 0) return 0;

  const listedAt = Date.now();
  let found: Awaited<ReturnType<typeof graphqlRepos>>["repos"];
  try {
    found = (await graphqlRepos(keys, "light", AbortSignal.timeout(20_000))).repos;
  } catch (error) {
    if (!(error instanceof RateLimitedError)) console.warn("[live]", error instanceof Error ? error.message : error);
    return 0;
  }

  const fetchedAt = Date.now();
  const now = new Date();
  const observations = new Map<string, RepoObservation>();
  for (const [key, api] of found) {
    const [owner, name] = key.split("/");
    observations.set(key, {
      owner,
      name,
      stars: api.stargazers_count,
      forks: api.forks_count,
      pushedAt: api.pushed_at ? new Date(api.pushed_at) : null,
    });
  }
  // A refresh is not a sighting: last-seen dates stay as they are (epoch never wins `greatest`).
  const ids = await upsertRepos(db, observations, now, new Date(0));
  const snapshots = await snapshotStars(db, observations, ids, now);
  await db.insert(sourceRuns).values({
    source: "github",
    startedAt: began,
    finishedAt: new Date(),
    status: "ok",
    itemCount: observations.size,
    error: null,
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[live] ${observations.size} dépôts, ${snapshots} relevés · liste ${listedAt - began.getTime()} ms, GitHub ${fetchedAt - listedAt} ms, base ${Date.now() - fetchedAt} ms`,
    );
  }
  return observations.size;
}
