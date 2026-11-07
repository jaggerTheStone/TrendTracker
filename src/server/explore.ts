import { getDb } from "./db/client";
import { getUser, searchRepos, type ApiUser } from "./github/api";
import { getOverview } from "./overview";
import { mergeObservations, upsertRepos } from "./repos";
import { fromApi } from "./sources/types";
import { summariesFor } from "./summaries";
import { trendingAppearancesByOwner } from "./trending";
import type { Mention, RepoSummary } from "@/lib/types";

const TTL = 6 * 60 * 60_000;
const cache = globalThis as unknown as { __trendtrackerExplore?: Map<string, { at: number; value: unknown }> };
cache.__trendtrackerExplore ??= new Map();

/** Remembers a GitHub answer for a few hours: topic and profile pages are browsed a lot, and change slowly. */
async function remember<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.__trendtrackerExplore!.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.__trendtrackerExplore!.set(key, { at: Date.now(), value });
  return value;
}

/** Searches GitHub and stores the results without making them "active" in the trending pool. */
async function searchAndStore(query: string, perPage: number): Promise<string[]> {
  const items = await searchRepos(query, AbortSignal.timeout(10_000), perPage);
  const merged = mergeObservations(items.map(fromApi));
  await upsertRepos(await getDb(), merged, new Date(), new Date(0));
  return [...merged.keys()];
}

/** Last 24 h: the one window known for every repository we watch, so totals add up. */
const dayGain = (r: RepoSummary) => r.gained.day ?? 0;

function mentionsOf(mentions: Mention[], keys: Set<string>, limit = 8): Mention[] {
  return mentions.filter((m) => m.repos.some((k) => keys.has(k))).slice(0, limit);
}

export interface TopicPage {
  topic: string;
  rising: RepoSummary[];
  popular: RepoSummary[];
  related: { topic: string; count: number }[];
  mentions: Mention[];
  gainedDay: number;
}

export async function getTopic(topic: string): Promise<TopicPage> {
  const overview = await getOverview();
  const rising = overview.repos.filter((r) => r.topics.includes(topic)).sort((a, b) => dayGain(b) - dayGain(a));

  let popular: RepoSummary[] = [];
  try {
    const keys = await remember(`topic:${topic}`, () => searchAndStore(`topic:${topic} fork:false`, 20));
    popular = await summariesFor(keys);
  } catch {
    // Quota or network: the page still shows what we track.
  }

  const counts = new Map<string, number>();
  for (const r of [...rising, ...popular]) {
    for (const t of r.topics) if (t !== topic) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const keys = new Set(rising.map((r) => r.key));
  return {
    topic,
    rising: rising.slice(0, 20),
    popular: popular.sort((a, b) => b.stars - a.stars),
    related: [...counts]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t, count]) => ({ topic: t, count })),
    mentions: mentionsOf(overview.mentions, keys),
    gainedDay: rising.reduce((sum, r) => sum + dayGain(r), 0),
  };
}

export interface DeveloperPage {
  profile: Pick<
    ApiUser,
    | "login"
    | "name"
    | "type"
    | "avatar_url"
    | "html_url"
    | "bio"
    | "blog"
    | "location"
    | "company"
    | "followers"
    | "public_repos"
    | "created_at"
  >;
  rising: RepoSummary[];
  popular: RepoSummary[];
  mentions: Mention[];
  trendingDays: number;
  totalStars: number;
}

export async function getDeveloper(login: string): Promise<DeveloperPage | null> {
  const profile = await remember(`user:${login.toLowerCase()}`, () => getUser(login, AbortSignal.timeout(10_000)));
  if (!profile) return null;

  const overview = await getOverview();
  const rising = overview.repos
    .filter((r) => r.owner.toLowerCase() === profile.login.toLowerCase())
    .sort((a, b) => dayGain(b) - dayGain(a));

  let popular: RepoSummary[] = [];
  try {
    const keys = await remember(`user-repos:${profile.login.toLowerCase()}`, () =>
      searchAndStore(`user:${profile.login} fork:false`, 12),
    );
    popular = (await summariesFor(keys)).sort((a, b) => b.stars - a.stars);
  } catch {
    // Quota or network: the page still shows what we track.
  }

  const appearances = await trendingAppearancesByOwner();
  return {
    profile: {
      login: profile.login,
      name: profile.name,
      type: profile.type,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      bio: profile.bio,
      blog: profile.blog,
      location: profile.location,
      company: profile.company,
      followers: profile.followers,
      public_repos: profile.public_repos,
      created_at: profile.created_at,
    },
    rising,
    popular,
    mentions: mentionsOf(overview.mentions, new Set(rising.map((r) => r.key))),
    trendingDays: appearances.get(profile.login.toLowerCase()) ?? 0,
    totalStars: popular.reduce((sum, r) => sum + r.stars, 0),
  };
}
