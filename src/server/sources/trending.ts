import type { Period } from "@/lib/types";
import { repoKey } from "@/lib/links";
import { decodeEntities, fetchText, stripHtml, type RepoObservation, type SourceAdapter } from "./types";

const SINCE: Record<Period, string> = { day: "daily", week: "weekly", month: "monthly" };

/** All languages for each period, plus today's list for the busiest languages. */
const LISTS: { period: Period; language: string }[] = [
  { period: "day", language: "" },
  { period: "week", language: "" },
  { period: "month", language: "" },
  ...["python", "typescript", "rust", "go", "javascript", "c++", "swift"].map((language) => ({
    period: "day" as const,
    language,
  })),
];

const toInt = (text: string | undefined) => (text ? Number(text.replace(/[^\d]/g, "")) : null);

/** Parses github.com/trending: the one public place that says how many stars a repository gained today. */
export function parseTrending(html: string, period: Period, language: string): RepoObservation[] {
  const rows = html.split('<article class="Box-row').slice(1);
  const out: RepoObservation[] = [];
  rows.forEach((row, index) => {
    const href = /<h2[^>]*>\s*<a[^>]*href="\/([^/"]+)\/([^/"]+)"/.exec(row);
    if (!href) return;
    const key = repoKey(href[1], href[2]);
    if (!key) return;
    const [owner, name] = key.split("/");
    const description = /<p class="col-9[^"]*">([\s\S]*?)<\/p>/.exec(row)?.[1];
    const stars = new RegExp(`href="/${owner}/${name}/stargazers"[\\s\\S]*?</svg>\\s*([\\d,]+)`, "i").exec(row)?.[1];
    const forks = new RegExp(`href="/${owner}/${name}/forks"[\\s\\S]*?</svg>\\s*([\\d,]+)`, "i").exec(row)?.[1];
    const gained = /([\d,]+)\s+stars?\s+(?:today|this week|this month)/.exec(row)?.[1];
    out.push({
      owner,
      name,
      githubId: toInt(/repository_id&quot;:(\d+)/.exec(row)?.[1]),
      description: description ? stripHtml(description) || null : undefined,
      language: decodeEntities(/itemprop="programmingLanguage">([^<]+)</.exec(row)?.[1] ?? "").trim() || null,
      stars: toInt(stars),
      forks: toInt(forks),
      trending: { period, language, rank: index + 1, gained: toInt(gained) ?? 0 },
    });
  });
  return out;
}

export const trendingSource: SourceAdapter = {
  id: "trending",
  async fetch(signal) {
    const lists = await Promise.all(
      LISTS.map(async ({ period, language }) => {
        const path = language ? `/${encodeURIComponent(language)}` : "";
        const html = await fetchText(`https://github.com/trending${path}?since=${SINCE[period]}`, signal);
        return parseTrending(html, period, language);
      }),
    );
    const repos = lists.flat();
    if (repos.length === 0) throw new Error("Page Trending vide ou format changé");
    return { repos, mentions: [] };
  },
};
