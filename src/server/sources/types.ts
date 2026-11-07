import { XMLParser } from "fast-xml-parser";
import type { MentionSource, Period, SourceId } from "@/lib/types";
import type { ApiRepo } from "../github/api";
import { USER_AGENT } from "../github/api";

/** What a source knows about a repository. Only `owner` and `name` are guaranteed. */
export interface RepoObservation {
  owner: string;
  name: string;
  githubId?: number | null;
  description?: string | null;
  homepage?: string | null;
  language?: string | null;
  topics?: string[];
  license?: string | null;
  avatar?: string | null;
  stars?: number | null;
  forks?: number | null;
  openIssues?: number | null;
  archived?: boolean;
  createdAt?: Date | null;
  pushedAt?: Date | null;
  /** Full metadata straight from the API (as opposed to scraped). */
  complete?: boolean;
  trending?: { period: Period; language: string; rank: number; gained: number };
}

/** A video, story or post linking to repositories ("Owner/name"). */
export interface MentionInput {
  source: MentionSource;
  externalId: string;
  title: string;
  url: string;
  author?: string | null;
  score: number;
  comments?: number | null;
  image?: string | null;
  publishedAt: Date;
  repos: string[];
}

export interface SourceResult {
  repos: RepoObservation[];
  mentions: MentionInput[];
}

export interface SourceAdapter {
  id: Exclude<SourceId, "github">;
  fetch(signal: AbortSignal): Promise<SourceResult>;
}

export function fromApi(repo: ApiRepo): RepoObservation {
  return {
    owner: repo.owner.login,
    name: repo.name,
    githubId: repo.id,
    description: repo.description,
    homepage: repo.homepage || null,
    language: repo.language,
    topics: repo.topics ?? [],
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
    avatar: repo.owner.avatar_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    archived: repo.archived,
    createdAt: new Date(repo.created_at),
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
    complete: true,
  };
}

async function request(url: string, signal: AbortSignal, accept: string): Promise<Response> {
  const res = await fetch(url, { signal, cache: "no-store", headers: { "User-Agent": USER_AGENT, Accept: accept } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${new URL(url).host}`);
  return res;
}

export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  return (await (await request(url, signal, "application/json")).json()) as T;
}

export async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  return (await request(url, signal, "text/html,application/xhtml+xml,*/*")).text();
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text" });

export async function fetchXml<T>(url: string, signal: AbortSignal): Promise<T> {
  return xml.parse(await (await request(url, signal, "application/atom+xml, application/xml")).text()) as T;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>|<\/p>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
