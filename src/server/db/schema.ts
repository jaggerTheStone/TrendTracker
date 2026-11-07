import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ───────────────────────── GitHub data ───────────────────────── */

/** One row per repository we have seen anywhere (trending, search, a video, a post…). */
export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    /** Lowercased "owner/name": GitHub names are case-insensitive. */
    key: text("key").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    githubId: bigint("github_id", { mode: "number" }),
    description: text("description"),
    homepage: text("homepage"),
    language: text("language"),
    topics: text("topics").array().notNull().default([]),
    license: text("license"),
    avatar: text("avatar"),
    stars: integer("stars"),
    forks: integer("forks"),
    openIssues: integer("open_issues"),
    archived: boolean("archived").notNull().default(false),
    ghCreatedAt: timestamp("gh_created_at", { withTimezone: true }),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    /** Last time full metadata came from the GitHub API. */
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    /** Consecutive lookups that did not find the repository (renamed, deleted, private). */
    misses: integer("misses").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("repos_key_idx").on(t.key), index("repos_last_seen_idx").on(t.lastSeenAt)],
);

/** Star counts over time: our own measure of velocity. */
export const repoSnapshots = pgTable(
  "repo_snapshots",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    stars: integer("stars").notNull(),
    forks: integer("forks"),
  },
  (t) => [index("repo_snapshots_repo_idx").on(t.repoId, t.capturedAt)],
);

/** The latest github.com/trending lists, replaced on every collection. */
export const trending = pgTable(
  "trending",
  {
    period: text("period").notNull(), // day | week | month
    language: text("language").notNull(), // "" = all languages
    rank: integer("rank").notNull(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    gained: integer("gained").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.period, t.language, t.rank] })],
);

/** Best daily position on github.com/trending (all languages), kept for the rank history and badges. */
export const trendingDays = pgTable(
  "trending_days",
  {
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    gained: integer("gained").notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.repoId] }), index("trending_days_repo_idx").on(t.repoId)],
);

/** A video, story or post that links to one or more repositories. */
export const mentions = pgTable(
  "mentions",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    author: text("author"),
    score: integer("score").notNull().default(0),
    comments: integer("comments"),
    image: text("image"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("mentions_source_ext_idx").on(t.source, t.externalId),
    index("mentions_pub_idx").on(t.publishedAt),
  ],
);

export const mentionRepos = pgTable(
  "mention_repos",
  {
    mentionId: integer("mention_id")
      .notNull()
      .references(() => mentions.id, { onDelete: "cascade" }),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.mentionId, t.repoId] }), index("mention_repos_repo_idx").on(t.repoId)],
);

export interface CachedRelease {
  tag: string;
  name: string | null;
  url: string;
  publishedAt: string | null;
}

/** Expensive per-repository data, fetched when someone opens the repository page. */
export const repoCache = pgTable("repo_cache", {
  repoId: integer("repo_id")
    .primaryKey()
    .references(() => repos.id, { onDelete: "cascade" }),
  readmeHtml: text("readme_html"),
  languages: jsonb("languages").$type<{ name: string; bytes: number }[]>(),
  releases: jsonb("releases").$type<CachedRelease[]>(),
  starHistory: jsonb("star_history").$type<{ t: string; stars: number }[]>(),
  commits: jsonb("commits").$type<number[]>(),
  mergedPrs: jsonb("merged_prs").$type<{ day: string; count: number }[]>(),
  contributors: integer("contributors"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const analyses = pgTable("analyses", {
  repoId: integer("repo_id")
    .primaryKey()
    .references(() => repos.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("source_runs_source_idx").on(t.source, t.finishedAt)],
);

/* ───────────────────────── Accounts (Better Auth) ───────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────────────────── Boards ───────────────────────── */

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    /** Set when the board is shared: anyone with /b/<shareId> can read it. */
    shareId: text("share_id").unique(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("boards_user_idx").on(t.userId)],
);

export const boardRepos = pgTable(
  "board_repos",
  {
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    note: text("note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.repoId] }), index("board_repos_repo_idx").on(t.repoId)],
);

/* ───────────────────────── E-mail alerts ───────────────────────── */

export const alertPrefs = pgTable("alert_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** A followed repository enters GitHub Trending. */
  trending: boolean("trending").notNull().default(false),
  /** A followed repository gains stars much faster than usual. */
  spikes: boolean("spikes").notNull().default(false),
  /** A weekly summary of followed repositories. */
  weekly: boolean("weekly").notNull().default(false),
  lastWeeklyAt: timestamp("last_weekly_at", { withTimezone: true }),
});

/** What was already sent, so an event is never mailed twice. */
export const alertLog = pgTable(
  "alert_log",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    day: text("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.repoId, t.kind, t.day] })],
);
