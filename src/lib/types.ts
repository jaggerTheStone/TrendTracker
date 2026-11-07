import type { Domain } from "./domains";

export type Period = "day" | "week" | "month";

export type RepoStatus = "new" | "hot" | "rising" | "steady" | "cooling";

export const MENTION_SOURCES = ["youtube", "hackernews", "lobsters", "mastodon"] as const;
export type MentionSource = (typeof MENTION_SOURCES)[number];

export const SOURCE_IDS = ["trending", "search", "youtube", "hackernews", "lobsters", "mastodon", "github"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export interface RepoSummary {
  /** Lowercased "owner/name". */
  key: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  domain: Domain;
  avatar: string;
  stars: number;
  forks: number;
  createdAt: string | null;
  /** Stars gained over each period, when known. */
  gained: Record<Period, number | null>;
  /** Weekly gain relative to the stars the repository had a week ago. */
  growth: number | null;
  /** Last 24 h against the daily average of the days before (1 = same pace). */
  acceleration: number | null;
  /** 0–100, percentile mix of velocity, growth and buzz among active repositories. */
  momentum: number;
  status: RepoStatus;
  /** Position on today's github.com/trending (all languages). */
  rank: number | null;
  buzz: Record<MentionSource, number>;
  /** Stars over the last 48 hours, from our own snapshots. */
  spark: number[];
}

export interface Mention {
  id: number;
  source: MentionSource;
  title: string;
  url: string;
  author: string | null;
  score: number;
  comments: number | null;
  image: string | null;
  publishedAt: string;
  repos: string[];
}

export interface SourceStatus {
  id: SourceId;
  ok: boolean;
  at: string | null;
  count: number;
  error: string | null;
}

/** Stars a repository just gained, between two of our snapshots. */
export interface PulseEvent {
  key: string;
  delta: number;
  at: string;
}

export interface Overview {
  generatedAt: string;
  lastIngestAt: string | null;
  repos: RepoSummary[];
  mentions: Mention[];
  /** Stars gained per repository over the last 30 minutes, biggest first. */
  pulse: PulseEvent[];
  sources: SourceStatus[];
  features: { ai: boolean; google: boolean; githubToken: boolean; devMail: boolean; live: boolean };
}

export interface Release {
  tag: string;
  name: string | null;
  url: string;
  publishedAt: string | null;
}

export interface RepoDetail {
  repo: RepoSummary;
  homepage: string | null;
  license: string | null;
  openIssues: number | null;
  pushedAt: string | null;
  archived: boolean;
  readmeHtml: string | null;
  languages: { name: string; bytes: number }[];
  releases: Release[];
  starHistory: { t: string; stars: number }[];
  commits: number[] | null;
  contributors: number | null;
  mentions: Mention[];
  similar: RepoSummary[];
  /** Best daily rank on GitHub Trending, last 60 days. */
  trendingDays: { day: string; rank: number; gained: number }[];
  /** Stars gained per UTC day, last 30 days, from our own snapshots (today is in progress). */
  dailyStars: { day: string; gained: number }[];
  /** Forks gained per day (our snapshots) and pull requests merged per day, last 30 days. */
  dailyForks: { day: string; gained: number }[];
  dailyPrs: { day: string; gained: number }[];
  badges: Badge[];
}

export type BadgeKind = "first" | "top10" | "streak" | "rocket" | "youtube" | "hackernews";

export interface Badge {
  kind: BadgeKind;
  label: string;
}

export interface BoardRepo {
  key: string;
  note: string | null;
  addedAt: string;
}

export interface Board {
  id: string;
  name: string;
  color: string;
  shareId: string | null;
  repos: BoardRepo[];
}

export interface Analysis {
  pitch: string;
  why: string;
  audience: string;
  alternatives: string[];
  verdict: "essayer" | "surveiller" | "passer";
}
