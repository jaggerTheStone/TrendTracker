import { extractRepos } from "@/lib/links";
import { daysAgo, fetchJson, stripHtml, type MentionInput, type SourceAdapter } from "./types";

interface Hit {
  objectID: string;
  title: string;
  url: string | null;
  story_text: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at_i: number;
}

/** Hacker News stories of the past week that point to a repository (Show HN, launches, discussions). */
export const hackernewsSource: SourceAdapter = {
  id: "hackernews",
  async fetch(signal) {
    const since = Math.floor(daysAgo(7).getTime() / 1000);
    const data = await fetchJson<{ hits: Hit[] }>(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=github.com&restrictSearchableAttributes=url` +
        `&numericFilters=created_at_i>${since},points>2&hitsPerPage=500`,
      signal,
    );
    const mentions: MentionInput[] = [];
    for (const hit of data.hits) {
      const repos = extractRepos(`${hit.url ?? ""} ${hit.story_text ? stripHtml(hit.story_text) : ""}`);
      if (repos.length === 0) continue;
      mentions.push({
        source: "hackernews",
        externalId: hit.objectID,
        title: hit.title,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        author: hit.author,
        score: hit.points ?? 0,
        comments: hit.num_comments ?? 0,
        publishedAt: new Date(hit.created_at_i * 1000),
        repos: repos.slice(0, 3),
      });
    }
    return { repos: [], mentions };
  },
};
