import { extractRepos } from "@/lib/links";
import { daysAgo, fetchJson, type MentionInput, type SourceAdapter } from "./types";

interface Post {
  uri: string;
  record: {
    text: string;
    createdAt?: string;
    facets?: { features: { uri?: string }[] }[];
  };
  author: { handle: string };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
  embed?: {
    external?: { uri?: string; thumb?: string };
    images?: { thumb?: string }[];
  };
}

/** Public Bluesky search for GitHub links: no account or token needed. */
export const blueskySource: SourceAdapter = {
  id: "bluesky",
  async fetch(signal) {
    const since = daysAgo(7);
    const params = new URLSearchParams({
      q: "github.com",
      domain: "github.com",
      sort: "latest",
      since: since.toISOString(),
      limit: "100",
    });
    const data = await fetchJson<{ posts: Post[] }>(
      `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`,
      signal,
    );
    const mentions: MentionInput[] = [];
    const seen = new Set<string>();

    for (const post of data.posts) {
      if (seen.has(post.uri)) continue;
      seen.add(post.uri);

      const text = post.record.text;
      const links = [
        text,
        post.embed?.external?.uri ?? "",
        ...(post.record.facets ?? []).flatMap((facet) => facet.features.map((feature) => feature.uri ?? "")),
      ];
      const repos = extractRepos(links.join(" "));
      if (repos.length === 0) continue;

      const publishedAt = new Date(post.record.createdAt ?? post.indexedAt);
      if (Number.isNaN(publishedAt.getTime()) || publishedAt < since) continue;
      const rkey = post.uri.split("/").at(-1);
      if (!rkey) continue;

      mentions.push({
        source: "bluesky",
        externalId: post.uri,
        title: text.length > 220 ? `${text.slice(0, 218)}…` : text || repos[0],
        url: `https://bsky.app/profile/${encodeURIComponent(post.author.handle)}/post/${encodeURIComponent(rkey)}`,
        author: post.author.handle,
        score: (post.likeCount ?? 0) + (post.repostCount ?? 0),
        comments: post.replyCount ?? 0,
        image: post.embed?.external?.thumb ?? post.embed?.images?.[0]?.thumb ?? null,
        publishedAt,
        repos: repos.slice(0, 3),
      });
    }

    return { repos: [], mentions };
  },
};
