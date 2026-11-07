/** First path segments of github.com that are site pages, not users or organisations. */
const RESERVED_OWNERS = new Set([
  "about",
  "apps",
  "blog",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "issues",
  "join",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "organizations",
  "pricing",
  "pulls",
  "readme",
  "search",
  "security",
  "settings",
  "site",
  "sponsors",
  "topics",
  "trending",
  "users",
  "codespaces",
  "copilot",
  "resources",
  "solutions",
  "team",
  "premium-support",
  "signup",
  "logout",
  "dashboard",
  "stars",
  "watching",
  "account",
]);

const OWNER = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const NAME = /^[\w.-]{1,100}$/;
const LINK = /github\.com\/([\w-]{1,39})\/([\w.-]{1,100})/gi;

/** Normalised "owner/name" when both parts look like a repository, else null. */
export function repoKey(owner: string, name: string): string | null {
  const repo = name.replace(/\.git$/i, "").replace(/[.]+$/, "");
  if (!OWNER.test(owner) || !NAME.test(repo) || repo === "." || repo === "..") return null;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  return `${owner}/${repo}`;
}

/** Every github.com repository linked in a block of text, as "Owner/name" (original case, deduplicated). */
export function extractRepos(text: string): string[] {
  const found = new Map<string, string>();
  for (const match of text.matchAll(LINK)) {
    const key = repoKey(match[1], match[2]);
    if (key && !found.has(key.toLowerCase())) found.set(key.toLowerCase(), key);
  }
  return [...found.values()];
}

/** "owner/name", a github.com URL or a git remote → "owner/name", else null. */
export function parseRepoInput(input: string): string | null {
  const text = input.trim();
  const fromUrl = extractRepos(text.startsWith("http") || text.includes("github.com") ? text : "");
  if (fromUrl.length > 0) return fromUrl[0];
  const match = /^([\w-]{1,39})\/([\w.-]{1,100})$/.exec(text);
  return match ? repoKey(match[1], match[2]) : null;
}
