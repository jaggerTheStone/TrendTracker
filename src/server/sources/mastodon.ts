import { extractRepos } from "@/lib/links";
import { daysAgo, fetchJson, stripHtml, type MentionInput, type SourceAdapter } from "./types";

const TAGS = ["github", "opensource", "foss", "selfhosted", "rustlang", "python", "programming"];

interface Status {
  id: string;
  url: string;
  content: string;
  created_at: string;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  account: { acct: string; bot?: boolean };
  card?: { url?: string; image?: string | null } | null;
  media_attachments?: { type: string; preview_url?: string }[];
}

/** Public hashtag timelines of mastodon.social: no account needed. */
export const mastodonSource: SourceAdapter = {
  id: "mastodon",
  async fetch(signal) {
    const since = daysAgo(7);
    const timelines = await Promise.all(
      TAGS.map((tag) => fetchJson<Status[]>(`https://mastodon.social/api/v1/timelines/tag/${tag}?limit=40`, signal)),
    );
    const mentions: MentionInput[] = [];
    const seen = new Set<string>();
    for (const status of timelines.flat()) {
      if (seen.has(status.id) || status.account.bot) continue;
      seen.add(status.id);
      const publishedAt = new Date(status.created_at);
      if (publishedAt < since) continue;
      const repos = extractRepos(`${status.content} ${status.card?.url ?? ""}`);
      if (repos.length === 0) continue;
      const text = stripHtml(status.content);
      mentions.push({
        source: "mastodon",
        externalId: status.id,
        title: text.length > 220 ? `${text.slice(0, 218)}…` : text,
        url: status.url,
        author: status.account.acct,
        score: status.reblogs_count + status.favourites_count,
        comments: status.replies_count,
        image: status.card?.image ?? status.media_attachments?.find((m) => m.type === "image")?.preview_url ?? null,
        publishedAt,
        repos: repos.slice(0, 3),
      });
    }
    return { repos: [], mentions };
  },
};
