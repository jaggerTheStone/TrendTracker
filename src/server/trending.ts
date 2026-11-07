import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Period, RepoSummary } from "@/lib/types";
import { getDb } from "./db/client";
import { repos, trending, trendingDays } from "./db/schema";
import { summariesFor } from "./summaries";

/** Languages whose daily list is collected (see sources/trending.ts). */
export const TRENDING_LANGUAGES = ["python", "typescript", "rust", "go", "javascript", "c++", "swift"];

export interface TrendingEntry {
  rank: number;
  gained: number;
  repo: RepoSummary;
}

export interface TrendingList {
  period: Period;
  language: string;
  /** The day shown, null for the live list. */
  day: string | null;
  /** Days with an archived list, newest first. */
  days: string[];
  entries: TrendingEntry[];
}

/**
 * GitHub Trending as it stands now, or as it was on a past day (daily list, all
 * languages: that is the one we archive).
 */
export async function getTrending({
  period = "day",
  language = "",
  day = null,
}: {
  period?: Period;
  language?: string;
  day?: string | null;
}): Promise<TrendingList> {
  const db = await getDb();
  const archived = await db
    .selectDistinct({ day: trendingDays.day })
    .from(trendingDays)
    .orderBy(desc(trendingDays.day))
    .limit(120);
  const days = archived.map((d) => d.day);
  const today = new Date().toISOString().slice(0, 10);
  const past = period === "day" && !language && day && day !== today && days.includes(day) ? day : null;

  const rows = past
    ? await db
        .select({ rank: trendingDays.rank, gained: trendingDays.gained, key: repos.key })
        .from(trendingDays)
        .innerJoin(repos, eq(repos.id, trendingDays.repoId))
        .where(eq(trendingDays.day, past))
        .orderBy(asc(trendingDays.rank))
    : await db
        .select({ rank: trending.rank, gained: trending.gained, key: repos.key })
        .from(trending)
        .innerJoin(repos, eq(repos.id, trending.repoId))
        .where(and(eq(trending.period, period), eq(trending.language, period === "day" ? language : "")))
        .orderBy(asc(trending.rank));

  const summaries = new Map((await summariesFor(rows.map((r) => r.key))).map((s) => [s.key, s]));
  return {
    period,
    language: period === "day" ? language : "",
    day: past,
    days,
    entries: rows
      .filter((r) => summaries.has(r.key))
      .map((r) => ({ rank: r.rank, gained: r.gained, repo: summaries.get(r.key)! })),
  };
}

/** Times each owner appeared on the daily list, for the developers ranking. */
export async function trendingAppearancesByOwner(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ owner: sql<string>`lower(${repos.owner})`, count: sql<number>`count(*)` })
    .from(trendingDays)
    .innerJoin(repos, eq(repos.id, trendingDays.repoId))
    .groupBy(sql`1`);
  return new Map(rows.map((r) => [r.owner, Number(r.count)]));
}
