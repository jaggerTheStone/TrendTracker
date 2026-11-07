import { env } from "../env";

export const USER_AGENT = "TrendTracker/0.3 (GitHub repository tracker)";

type Resource = "core" | "search" | "graphql";

/** Remaining calls per GitHub rate-limit bucket, shared by every caller in the process. */
const state = globalThis as unknown as {
  __trendtrackerGithub?: { token: string | undefined; buckets: Record<Resource, { remaining: number; reset: number }> };
};

/** Quotas belong to the credential: adding or changing GITHUB_TOKEN starts from fresh buckets. */
function buckets(): Record<Resource, { remaining: number; reset: number }> {
  const token = env().GITHUB_TOKEN;
  if (!state.__trendtrackerGithub || state.__trendtrackerGithub.token !== token) {
    state.__trendtrackerGithub = {
      token,
      buckets: {
        core: { remaining: token ? 5000 : 60, reset: 0 },
        search: { remaining: token ? 30 : 10, reset: 0 },
        graphql: { remaining: token ? 5000 : 0, reset: 0 },
      },
    };
  }
  return state.__trendtrackerGithub.buckets;
}

export class RateLimitedError extends Error {
  constructor(
    resource: Resource,
    readonly resetAt: number,
  ) {
    super(`Quota GitHub (${resource}) épuisé jusqu'à ${new Date(resetAt).toLocaleTimeString("fr-FR")}`);
    this.name = "RateLimitedError";
  }
}

export function hasToken(): boolean {
  return Boolean(env().GITHUB_TOKEN);
}

/** Calls still available in a bucket; a bucket whose window has passed is considered full again. */
export function budget(resource: Resource): number {
  const b = buckets()[resource];
  return b.reset && Date.now() > b.reset ? Infinity : b.remaining;
}

async function gh(
  path: string,
  {
    signal,
    accept = "application/vnd.github+json",
    resource = "core",
  }: {
    signal: AbortSignal;
    accept?: string;
    resource?: Resource;
  },
): Promise<Response> {
  const b = buckets()[resource];
  if (b.remaining <= 0 && Date.now() < b.reset) throw new RateLimitedError(resource, b.reset);

  const token = env().GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com${path}`, {
    signal,
    cache: "no-store",
    headers: {
      Accept: accept,
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (remaining !== null && reset !== null) {
    b.remaining = Number(remaining);
    b.reset = Number(reset) * 1000;
  }
  if ((res.status === 403 || res.status === 429) && b.remaining === 0) {
    throw new RateLimitedError(resource, b.reset);
  }
  return res;
}

async function json<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) throw new Error(`GitHub ${res.status} sur ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export interface ApiRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  license: { spdx_id: string | null; name: string } | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  created_at: string;
  pushed_at: string | null;
}

export async function searchRepos(query: string, signal: AbortSignal, perPage = 100): Promise<ApiRepo[]> {
  const path = `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;
  const data = await json<{ items: ApiRepo[] }>(await gh(path, { signal, resource: "search" }), path);
  return data.items;
}

/** Follows renames (GitHub answers with a redirect). Null when the repository does not exist or is private. */
export async function getRepo(owner: string, name: string, signal: AbortSignal): Promise<ApiRepo | null> {
  const path = `/repos/${owner}/${name}`;
  const res = await gh(path, { signal });
  if (res.status === 404 || res.status === 451) return null;
  return json<ApiRepo>(res, path);
}

/** README rendered to HTML by GitHub itself. */
export async function getReadmeHtml(owner: string, name: string, signal: AbortSignal): Promise<string | null> {
  const res = await gh(`/repos/${owner}/${name}/readme`, { signal, accept: "application/vnd.github.html+json" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} sur readme`);
  return res.text();
}

export async function getLanguages(owner: string, name: string, signal: AbortSignal) {
  const path = `/repos/${owner}/${name}/languages`;
  const data = await json<Record<string, number>>(await gh(path, { signal }), path);
  return Object.entries(data)
    .map(([lang, bytes]) => ({ name: lang, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

export async function getReleases(owner: string, name: string, signal: AbortSignal) {
  const path = `/repos/${owner}/${name}/releases?per_page=6`;
  const data = await json<
    { tag_name: string; name: string | null; html_url: string; published_at: string | null; draft: boolean }[]
  >(await gh(path, { signal }), path);
  return data
    .filter((r) => !r.draft)
    .map((r) => ({ tag: r.tag_name, name: r.name, url: r.html_url, publishedAt: r.published_at }));
}

/** Commits per week over the last year. GitHub computes it lazily: null while it answers 202. */
export async function getCommitActivity(owner: string, name: string, signal: AbortSignal): Promise<number[] | null> {
  const path = `/repos/${owner}/${name}/stats/commit_activity`;
  const res = await gh(path, { signal });
  if (res.status === 202 || res.status === 204) return null;
  const data = await json<{ total: number }[]>(res, path);
  return Array.isArray(data) ? data.map((w) => w.total) : null;
}

/** Number of contributors, read from the last page number of a one-per-page listing. */
export async function getContributorsCount(owner: string, name: string, signal: AbortSignal): Promise<number | null> {
  const res = await gh(`/repos/${owner}/${name}/contributors?per_page=1&anon=true`, { signal });
  if (!res.ok) return null;
  const last = /[?&]page=(\d+)>; rel="last"/.exec(res.headers.get("link") ?? "");
  if (last) return Number(last[1]);
  const body = (await res.json()) as unknown[];
  return body.length;
}

export interface ApiUser {
  login: string;
  name: string | null;
  type: "User" | "Organization";
  avatar_url: string;
  html_url: string;
  bio: string | null;
  blog: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  public_repos: number;
  created_at: string;
}

/** A user or organisation profile. Null when the login does not exist. */
export async function getUser(login: string, signal: AbortSignal): Promise<ApiUser | null> {
  const path = `/users/${encodeURIComponent(login)}`;
  const res = await gh(path, { signal });
  if (res.status === 404) return null;
  return json<ApiUser>(res, path);
}

/** Pull requests merged per day since `since` (YYYY-MM-DD), from the search API (first 100). */
export async function getMergedPrs(
  owner: string,
  name: string,
  since: string,
  signal: AbortSignal,
): Promise<{ day: string; count: number }[]> {
  const q = encodeURIComponent(`repo:${owner}/${name} is:pr is:merged merged:>=${since}`);
  const path = `/search/issues?q=${q}&per_page=100&sort=updated&order=desc`;
  const data = await json<{ items: { pull_request?: { merged_at: string | null }; closed_at: string | null }[] }>(
    await gh(path, { signal, resource: "search" }),
    path,
  );
  const byDay = new Map<string, number>();
  for (const item of data.items) {
    const at = item.pull_request?.merged_at ?? item.closed_at;
    if (!at) continue;
    const day = at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));
}

const GRAPHQL_FIELDS = {
  light: "databaseId nameWithOwner stargazerCount forkCount isArchived pushedAt",
  full: `databaseId nameWithOwner name owner { login avatarUrl } description homepageUrl
    primaryLanguage { name } repositoryTopics(first: 20) { nodes { topic { name } } }
    licenseInfo { spdxId name } stargazerCount forkCount isArchived createdAt pushedAt
    issues(states: OPEN) { totalCount } pullRequests(states: OPEN) { totalCount }`,
};

interface GraphqlRepo {
  databaseId: number;
  nameWithOwner: string;
  name?: string;
  owner?: { login: string; avatarUrl: string };
  description?: string | null;
  homepageUrl?: string | null;
  primaryLanguage?: { name: string } | null;
  repositoryTopics?: { nodes: { topic: { name: string } }[] };
  licenseInfo?: { spdxId: string | null; name: string } | null;
  stargazerCount: number;
  forkCount: number;
  isArchived: boolean;
  createdAt?: string;
  pushedAt: string | null;
  issues?: { totalCount: number };
  pullRequests?: { totalCount: number };
}

/** Light: counts only (live refresh). Full: everything the REST repository object gives us. */
export type GraphqlDepth = keyof typeof GRAPHQL_FIELDS;

function toApiRepo(repo: GraphqlRepo): ApiRepo {
  const [owner, name] = repo.nameWithOwner.split("/");
  return {
    id: repo.databaseId,
    name: repo.name ?? name,
    full_name: repo.nameWithOwner,
    owner: {
      login: repo.owner?.login ?? owner,
      avatar_url: repo.owner?.avatarUrl ?? `https://github.com/${owner}.png`,
    },
    description: repo.description ?? null,
    homepage: repo.homepageUrl ?? null,
    language: repo.primaryLanguage?.name ?? null,
    topics: repo.repositoryTopics?.nodes.map((n) => n.topic.name),
    license: repo.licenseInfo ? { spdx_id: repo.licenseInfo.spdxId, name: repo.licenseInfo.name } : null,
    stargazers_count: repo.stargazerCount,
    forks_count: repo.forkCount,
    open_issues_count: (repo.issues?.totalCount ?? 0) + (repo.pullRequests?.totalCount ?? 0),
    archived: repo.isArchived,
    created_at: repo.createdAt ?? "",
    pushed_at: repo.pushedAt,
  };
}

/**
 * Up to 100 repositories per request through the GraphQL API (needs a token): about one
 * point of the 5,000-point hourly budget per request. Unknown or private repositories are
 * returned in `missing`; renamed ones come back under their new name.
 */
export async function graphqlRepos(
  keys: string[],
  depth: GraphqlDepth,
  signal: AbortSignal,
): Promise<{ repos: Map<string, ApiRepo>; missing: string[] }> {
  const token = env().GITHUB_TOKEN;
  if (!token) throw new Error("GraphQL demande un GITHUB_TOKEN");
  const b = buckets().graphql;
  if (b.remaining <= 10 && Date.now() < b.reset) throw new RateLimitedError("graphql", b.reset);

  const repos = new Map<string, ApiRepo>();
  const missing: string[] = [];
  // Small batches sent side by side: a 100-repository query takes GitHub 3-4 s, 40 about 1.5 s.
  const size = depth === "full" ? 25 : 40;
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += size) batches.push(keys.slice(i, i + size));
  const run = async (batch: string[]) => {
    const fields = batch
      .map((key, j) => {
        const [owner, name] = key.split("/");
        return `r${j}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${GRAPHQL_FIELDS[depth]} }`;
      })
      .join("\n");
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      signal,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ ${fields} }` }),
    });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining !== null && reset !== null) {
      b.remaining = Number(remaining);
      b.reset = Number(reset) * 1000;
    }
    if ((res.status === 403 || res.status === 429) && b.remaining === 0) throw new RateLimitedError("graphql", b.reset);
    if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
    const body = (await res.json()) as {
      data?: Record<string, GraphqlRepo | null> | null;
      errors?: { type?: string; message: string }[];
    };
    if (!body.data) throw new Error(`GitHub GraphQL : ${body.errors?.[0]?.message ?? "réponse vide"}`);
    batch.forEach((key, j) => {
      const repo = body.data![`r${j}`];
      if (repo) repos.set(key, toApiRepo(repo));
      else missing.push(key);
    });
  };
  for (let i = 0; i < batches.length; i += 6) await Promise.all(batches.slice(i, i + 6).map(run));
  return { repos, missing };
}
