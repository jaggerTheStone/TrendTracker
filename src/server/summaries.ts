import { inArray } from "drizzle-orm";
import type { RepoSummary } from "@/lib/types";
import { getDb } from "./db/client";
import { repos } from "./db/schema";
import { getOverview, getScoreReference, loadScoringInputs, summarize } from "./overview";

/**
 * Summaries for any repositories: taken from the overview when ranked there, else scored
 * against the same active pool so momentum and status mean the same thing everywhere.
 */
export async function summariesFor(keys: string[]): Promise<RepoSummary[]> {
  if (keys.length === 0) return [];
  const overview = await getOverview();
  const known = new Map(overview.repos.map((r) => [r.key, r]));
  const missing = keys.filter((k) => !known.has(k));
  if (missing.length > 0) {
    const db = await getDb();
    const rows = await db.select().from(repos).where(inArray(repos.key, missing));
    const reference = await getScoreReference();
    for (const s of summarize(await loadScoringInputs(rows), { reference })) known.set(s.key, s);
  }
  return keys.map((k) => known.get(k)).filter((r): r is RepoSummary => Boolean(r));
}
