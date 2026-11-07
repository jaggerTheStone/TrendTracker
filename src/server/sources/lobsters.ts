import { extractRepos } from "@/lib/links";
import { fetchJson, type MentionInput, type SourceAdapter } from "./types";

interface Story {
  short_id: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  created_at: string;
  submitter_user: string | { username: string };
  comments_url: string;
}

export const lobstersSource: SourceAdapter = {
  id: "lobsters",
  async fetch(signal) {
    const lists = await Promise.all(
      ["hottest", "newest", "active"].map((list) => fetchJson<Story[]>(`https://lobste.rs/${list}.json`, signal)),
    );
    const mentions: MentionInput[] = [];
    const seen = new Set<string>();
    for (const story of lists.flat()) {
      if (seen.has(story.short_id)) continue;
      seen.add(story.short_id);
      const repos = extractRepos(story.url ?? "");
      if (repos.length === 0) continue;
      mentions.push({
        source: "lobsters",
        externalId: story.short_id,
        title: story.title,
        url: story.comments_url,
        author: typeof story.submitter_user === "string" ? story.submitter_user : story.submitter_user.username,
        score: story.score,
        comments: story.comment_count,
        publishedAt: new Date(story.created_at),
        repos,
      });
    }
    return { repos: [], mentions };
  },
};
