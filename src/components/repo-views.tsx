"use client";

import { Flame, Minus, Sparkles, Star, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { languageColor } from "@/lib/domains";
import { formatCompact, formatRelative } from "@/lib/format";
import type { Mention, Period, RepoStatus, RepoSummary } from "@/lib/types";
import { useApp, useNow, useRepoLookup } from "./app-provider";
import { SOURCE_LABEL, SourceGlyph } from "./glyphs";
import { Sparkline } from "./micro";
import { LiveFigure } from "./ui";

export const repoHref = (repo: { owner: string; name: string }) => `/r/${repo.owner}/${repo.name}`;

export const STATUS: Record<RepoStatus, { label: string; icon: LucideIcon; className: string }> = {
  new: { label: "Nouveau", icon: Sparkles, className: "text-done" },
  hot: { label: "En feu", icon: Flame, className: "text-danger" },
  rising: { label: "Accélère", icon: TrendingUp, className: "text-success" },
  steady: { label: "Stable", icon: Minus, className: "text-muted" },
  cooling: { label: "Ralentit", icon: TrendingDown, className: "text-attention" },
};

export const PERIOD_UNIT: Record<Period, string> = { day: "24 h", week: "7 j", month: "30 j" };

/**
 * Stars gained over the period. Only when that period is unknown (not watched long enough) does
 * it fall back to the closest known one, whose unit is then shown next to the number.
 */
export function gainOf(repo: RepoSummary, period: Period): { value: number; period: Period } | null {
  const order: Period[] =
    period === "day"
      ? ["day", "week", "month"]
      : period === "week"
        ? ["week", "day", "month"]
        : ["month", "week", "day"];
  for (const p of order) {
    const v = repo.gained[p];
    if (v !== null) return { value: v, period: p };
  }
  return null;
}

/** For sorting: the gain over exactly this period, unknown ones last. */
export const gainIn = (repo: RepoSummary, period: Period) => repo.gained[period] ?? -1;

/** GitHub serves avatars at any size: ask for what is drawn (×2 for sharp screens). */
export function avatarSrc(url: string, size: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === "avatars.githubusercontent.com") u.searchParams.set("s", String(size * 2));
    else if (u.hostname === "github.com" && u.pathname.endsWith(".png")) u.searchParams.set("size", String(size * 2));
    return u.toString();
  } catch {
    return url;
  }
}

export function RepoAvatar({ repo, size = 40 }: { repo: { avatar: string }; size?: number }) {
  return (
    // GitHub avatars come from a CDN with its own sizing; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(repo.avatar, size)}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="shrink-0 border border-line-muted bg-subtle object-cover"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
    />
  );
}

export function StatusTag({ status }: { status: RepoStatus }) {
  if (status === "steady") return null;
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium whitespace-nowrap ${className}`}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}

export function LangDot({ language }: { language: string | null }) {
  if (!language) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] whitespace-nowrap text-muted">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: languageColor(language) }} />
      <span className="truncate">{language}</span>
    </span>
  );
}

/** Icons of the platforms where the repository was mentioned recently. */
export function MentionedOn({ repo }: { repo: RepoSummary }) {
  const sources = (Object.keys(repo.buzz) as (keyof RepoSummary["buzz"])[]).filter((s) => repo.buzz[s] > 0);
  if (sources.length === 0) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-faint"
      title={`Mentionné sur ${sources.map((s) => SOURCE_LABEL[s]).join(", ")}`}
    >
      {sources.map((s) => (
        <SourceGlyph key={s} source={s} size={13} />
      ))}
    </span>
  );
}

/** GitHub-style "Star" button: bookmark the repository in your first board. */
export function FollowButton({ repo, compact }: { repo: RepoSummary; compact?: boolean }) {
  const { isFollowed, follow, unfollow } = useApp();
  const on = isFollowed(repo.key);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) unfollow(repo.key);
        else follow(repo);
      }}
      aria-pressed={on}
      aria-label={on ? "Ne plus suivre" : "Suivre"}
      className={`btn ${compact ? "btn-icon" : ""}`}
    >
      <Star className={`size-4 ${on ? "fill-attention text-attention" : "text-muted"}`} strokeWidth={1.8} />
      {!compact && (on ? "Suivi" : "Suivre")}
    </button>
  );
}

/** One line of a list: avatar, name, a few words, gain. */
export function RepoRow({
  repo,
  period = "day",
  rank,
  note,
}: {
  repo: RepoSummary;
  period?: Period;
  rank?: number;
  note?: string | null;
}) {
  const gain = gainOf(repo, period);
  const text = note || repo.description;
  return (
    <Link href={repoHref(repo)} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover">
      {rank !== undefined && (
        <span className="w-5 shrink-0 text-right text-[13px] text-faint tabular-nums">{rank}</span>
      )}
      <RepoAvatar repo={repo} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-snug">
          <span className="text-muted">{repo.owner} / </span>
          <span className="font-semibold text-accent">{repo.name}</span>
        </span>
        {text && <span className="mt-0.5 block truncate text-[13.5px] text-muted">{text}</span>}
        <span className="mt-1 flex min-w-0 items-center gap-3 overflow-hidden">
          <LangDot language={repo.language} />
          <MentionedOn repo={repo} />
          <span className="hidden items-center gap-1 text-[12.5px] text-muted sm:inline-flex">
            <Star className="size-3.5" strokeWidth={1.8} />
            {formatCompact(repo.stars)}
          </span>
          <StatusTag status={repo.status} />
        </span>
      </span>
      {new Set(repo.spark).size >= 3 && (
        <span className="hidden shrink-0 text-success lg:block" title="Étoiles sur 48 h">
          <Sparkline values={repo.spark} />
        </span>
      )}
      <span className="flex w-[76px] shrink-0 flex-col items-end tabular-nums">
        {gain ? (
          <>
            <LiveFigure value={gain.value} prefix="+" className="text-[15px] font-semibold text-success" />
            <span className="text-[11.5px] text-faint">★ {PERIOD_UNIT[gain.period]}</span>
          </>
        ) : (
          <>
            <span className="text-[15px] font-semibold">{formatCompact(repo.stars)}</span>
            <span className="text-[11.5px] text-faint">★ au total</span>
          </>
        )}
      </span>
    </Link>
  );
}

/** Card for carousels: the essentials of one repository. */
export function RepoCard({ repo, period = "day" }: { repo: RepoSummary; period?: Period }) {
  const gain = gainOf(repo, period);
  return (
    <Link
      href={repoHref(repo)}
      className="box flex w-[260px] shrink-0 snap-start flex-col gap-3 p-4 transition-colors hover:border-faint sm:w-[280px]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <RepoAvatar repo={repo} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-accent">{repo.name}</span>
          <span className="block truncate text-[12.5px] text-muted">{repo.owner}</span>
        </span>
      </span>
      <span className="line-clamp-2 min-h-[2.6em] text-[13.5px] leading-snug text-muted">
        {repo.description ?? "—"}
      </span>
      <span className="mt-auto flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-3">
          <LangDot language={repo.language} />
          <MentionedOn repo={repo} />
          <StatusTag status={repo.status} />
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-success tabular-nums">
          {gain ? `+${formatCompact(gain.value)} ★` : `${formatCompact(repo.stars)} ★`}
        </span>
      </span>
    </Link>
  );
}

export function RepoChip({ repoKey }: { repoKey: string }) {
  const lookup = useRepoLookup();
  const r = lookup(repoKey);
  const [owner, name] = repoKey.split("/");
  return (
    <Link
      href={r ? repoHref(r) : `/r/${owner}/${name}`}
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-line bg-subtle py-0.5 pr-2.5 pl-0.5 text-[12.5px] font-medium transition-colors hover:border-faint"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(r?.avatar ?? `https://github.com/${owner}.png`, 20)}
        alt=""
        className="size-5 shrink-0 rounded-full"
        referrerPolicy="no-referrer"
      />
      <span className="truncate">{r?.name ?? name}</span>
    </Link>
  );
}

const SCORE_UNIT: Record<Mention["source"], string> = {
  youtube: "vue",
  hackernews: "pts",
  lobsters: "pts",
  mastodon: "partage",
  bluesky: "inter.",
};

function MentionMeta({ mention }: { mention: Mention }) {
  const now = useNow();
  const plural = mention.score > 1 && (mention.source === "youtube" || mention.source === "mastodon") ? "s" : "";
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
      <SourceGlyph source={mention.source} size={14} />
      <span className="truncate">{mention.author ?? SOURCE_LABEL[mention.source]}</span>
      {now !== null && <span className="shrink-0">· {formatRelative(mention.publishedAt, now)}</span>}
      {mention.score > 0 && (
        <span className="hidden shrink-0 sm:inline">
          · {formatCompact(mention.score)} {SCORE_UNIT[mention.source]}
          {plural}
        </span>
      )}
    </span>
  );
}

function MentionRepos({ mention, max = 4 }: { mention: Mention; max?: number }) {
  if (mention.repos.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1.5">
      {mention.repos.slice(0, max).map((key) => (
        <RepoChip key={key} repoKey={key} />
      ))}
      {mention.repos.length > max && (
        <span className="rounded-full border border-line px-2 py-0.5 text-[12.5px] text-muted">
          +{mention.repos.length - max}
        </span>
      )}
    </span>
  );
}

/** A video, story or post, as a list row. */
export function MentionRow({ mention }: { mention: Mention }) {
  return (
    <article className="flex min-w-0 gap-3 px-4 py-3">
      {mention.image && (
        <a href={mention.url} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mention.image}
            alt=""
            loading="lazy"
            className={`${mention.source === "youtube" ? "aspect-video w-[104px] sm:w-[128px]" : "size-16"} rounded-lg border border-line-muted bg-subtle object-cover`}
          />
        </a>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <MentionMeta mention={mention} />
        <a
          href={mention.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[14.5px] leading-snug font-semibold hover:text-accent"
        >
          {mention.title}
        </a>
        <MentionRepos mention={mention} max={3} />
      </div>
    </article>
  );
}

/** A video for carousels. */
export function VideoCard({ mention }: { mention: Mention }) {
  return (
    <article className="box flex w-[260px] shrink-0 snap-start flex-col sm:w-[280px]">
      <a
        href={mention.url}
        target="_blank"
        rel="noreferrer"
        className="group block aspect-video overflow-hidden border-b border-line-muted bg-subtle"
      >
        {mention.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mention.image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <MentionMeta mention={mention} />
        <a
          href={mention.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[14px] leading-snug font-semibold hover:text-accent"
        >
          {mention.title}
        </a>
        <div className="mt-auto pt-1">
          <MentionRepos mention={mention} max={2} />
        </div>
      </div>
    </article>
  );
}
