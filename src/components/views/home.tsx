"use client";

import { Flame, Rocket, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { RepoSummary } from "@/lib/types";
import { useOverview } from "../app-provider";
import { devHref, topicHref } from "./explore";
import { avatarSrc, RepoCard, repoHref, RepoAvatar, RepoRow, VideoCard } from "../repo-views";
import { LiveFeed } from "../live-feed";
import { Carousel, List, ListSkeleton, LiveFigure, SectionTitle, Skeleton, Stats } from "../ui";

const DAY = 86_400_000;

export function HomeView() {
  const { repos, mentions } = useOverview();
  const { period } = useSettings();
  const [now] = useState(() => Date.now());

  const stats = useMemo(() => {
    const dayGain = repos.reduce((sum, r) => sum + (r.gained.day ?? 0), 0);
    const fresh = repos.filter((r) => r.createdAt && now - new Date(r.createdAt).getTime() < 7 * DAY).length;
    const videos = mentions.filter(
      (m) => m.source === "youtube" && now - new Date(m.publishedAt).getTime() < 7 * DAY,
    ).length;
    const byLanguage = new Map<string, number>();
    let total = 0;
    for (const r of repos) {
      const g = r.gained.day ?? 0;
      if (!r.language || g <= 0) continue;
      byLanguage.set(r.language, (byLanguage.get(r.language) ?? 0) + g);
      total += g;
    }
    const [language, value] = [...byLanguage].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return { dayGain, fresh, videos, language, share: total ? Math.round((value / total) * 100) : 0 };
  }, [repos, mentions, now]);

  const trendingToday = useMemo(
    () =>
      repos
        .filter((r) => r.rank !== null)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, 10),
    [repos],
  );
  const videos = useMemo(() => mentions.filter((m) => m.source === "youtube").slice(0, 12), [mentions]);
  const brief = useMemo(() => buildBrief(repos), [repos]);
  const developers = useMemo(() => {
    const byOwner = new Map<string, { owner: string; avatar: string; repos: number; gained: number }>();
    for (const r of repos) {
      const entry = byOwner.get(r.owner.toLowerCase()) ?? { owner: r.owner, avatar: r.avatar, repos: 0, gained: 0 };
      entry.repos += 1;
      entry.gained += r.gained.day ?? 0;
      byOwner.set(r.owner.toLowerCase(), entry);
    }
    return [...byOwner.values()]
      .filter((d) => d.gained > 0)
      .sort((a, b) => b.gained - a.gained)
      .slice(0, 6);
  }, [repos]);

  /** GitHub topics weighted by the stars their repositories gained this week. */
  const topics = useMemo(() => {
    const IGNORED = new Set(["hacktoberfest", "awesome", "awesome-list", "github", "open-source", "opensource"]);
    const byTopic = new Map<string, { repos: number; gained: number }>();
    for (const r of repos) {
      for (const t of r.topics) {
        if (IGNORED.has(t)) continue;
        const entry = byTopic.get(t) ?? { repos: 0, gained: 0 };
        entry.repos += 1;
        entry.gained += r.gained.day ?? 0;
        byTopic.set(t, entry);
      }
    }
    return [...byTopic]
      .filter(([, v]) => v.repos >= 2)
      .sort((a, b) => b[1].gained - a[1].gained)
      .slice(0, 16);
  }, [repos]);

  return (
    <div className="flex min-w-0 flex-col">
      <Stats
        items={[
          {
            label: "Étoiles gagnées · 24 h",
            value: <LiveFigure value={stats.dayGain} prefix="+" />,
            href: "/explorer?p=day&sort=stars",
          },
          { label: "Nouveaux · 7 j", value: stats.fresh, href: "/explorer?sort=new" },
          { label: "Vidéos · 7 j", value: stats.videos, href: "/buzz?s=youtube" },
          {
            label: "Langage en tête",
            value: stats.language ?? "—",
            hint: stats.language ? `${stats.share} % des étoiles du jour` : undefined,
            href: stats.language ? `/explorer?lang=${encodeURIComponent(stats.language)}` : "/explorer",
          },
        ]}
      />

      <SectionTitle href="/explorer">En ce moment</SectionTitle>
      <Carousel label="Dépôts du moment">
        {repos.slice(0, 12).map((repo) => (
          <RepoCard key={repo.key} repo={repo} period={period} />
        ))}
      </Carousel>

      <LiveFeed />

      {brief.length > 0 && (
        <>
          <SectionTitle>Le brief</SectionTitle>
          <List>
            {brief.map((item) => (
              <BriefRow key={item.label} {...item} />
            ))}
          </List>
        </>
      )}

      {trendingToday.length > 0 && (
        <>
          <SectionTitle href="/trending">Trending du jour</SectionTitle>
          <List>
            {trendingToday.map((repo) => (
              <RepoRow key={repo.key} repo={repo} rank={repo.rank!} period="day" />
            ))}
          </List>
        </>
      )}

      {videos.length > 0 && (
        <>
          <SectionTitle href="/buzz?s=youtube">Vu sur YouTube</SectionTitle>
          <Carousel label="Vidéos">
            {videos.map((m) => (
              <VideoCard key={m.id} mention={m} />
            ))}
          </Carousel>
        </>
      )}

      {developers.length > 0 && (
        <>
          <SectionTitle href="/dev">Développeurs en vue</SectionTitle>
          <List className="grid sm:grid-cols-2 sm:divide-y-0">
            {developers.map((d) => (
              <Link
                key={d.owner}
                href={devHref(d.owner)}
                className="flex min-w-0 items-center gap-3 border-line-muted px-4 py-3 transition-colors hover:bg-hover sm:border-b sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc(d.avatar, 32)}
                  alt=""
                  className="size-8 shrink-0 rounded-full border border-line-muted"
                  referrerPolicy="no-referrer"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{d.owner}</span>
                  <span className="block text-[12.5px] text-muted">
                    {d.repos} dépôt{d.repos > 1 ? "s" : ""} en vue
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block text-[13.5px] font-semibold text-success">+{formatCompact(d.gained)}</span>
                  <span className="block text-[11.5px] text-faint">★ 24 h</span>
                </span>
              </Link>
            ))}
          </List>
        </>
      )}

      {topics.length > 0 && (
        <>
          <SectionTitle href="/sujets">Sujets du moment</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {topics.map(([topic, v]) => (
              <Link
                key={topic}
                href={topicHref(topic)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] font-medium text-accent transition-colors hover:bg-accent hover:text-white"
              >
                {topic}
                <span className="tabular-nums opacity-70">{v.repos}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface BriefItem {
  label: string;
  icon: LucideIcon;
  tone: string;
  repo: RepoSummary;
  metric: string;
}

/** Three picks that summarise the day: what just arrived, what speeds up, what everyone talks about. */
function buildBrief(repos: RepoSummary[]): BriefItem[] {
  const items: BriefItem[] = [];
  const used = new Set<string>();
  const pick = (
    label: string,
    icon: LucideIcon,
    tone: string,
    list: RepoSummary[],
    metric: (r: RepoSummary) => string,
  ) => {
    const repo = list.find((r) => !used.has(r.key));
    if (!repo) return;
    used.add(repo.key);
    items.push({ label, icon, tone, repo, metric: metric(repo) });
  };

  pick(
    "Entrée",
    Rocket,
    "text-done",
    repos
      .filter((r) => r.createdAt && Date.now() - new Date(r.createdAt).getTime() <= 7 * DAY)
      .sort((a, b) => (b.gained.day ?? 0) - (a.gained.day ?? 0)),
    (r) =>
      `${formatCompact(r.stars)} ★ en ${Math.max(1, Math.round((Date.now() - new Date(r.createdAt!).getTime()) / DAY))} j`,
  );
  pick(
    "Accélère",
    TrendingUp,
    "text-success",
    repos
      .filter((r) => r.acceleration !== null && r.acceleration >= 1.4 && (r.gained.day ?? 0) >= 50)
      .sort((a, b) => b.acceleration! - a.acceleration!),
    (r) => `+${formatCompact(r.gained.day!)} ★ en 24 h · ×${r.acceleration!.toFixed(1)} son rythme`,
  );
  const sources = (r: RepoSummary) => Object.values(r.buzz).filter((n) => n > 0).length;
  pick(
    "On en parle",
    Flame,
    "text-danger",
    repos.filter((r) => sources(r) > 0).sort((a, b) => sources(b) - sources(a) || b.momentum - a.momentum),
    (r) => {
      const n = Object.values(r.buzz).reduce((a, b) => a + b, 0);
      return `${n} mention${n > 1 ? "s" : ""}`;
    },
  );
  return items;
}

function BriefRow({ label, icon: Icon, tone, repo, metric }: BriefItem) {
  return (
    <Link href={repoHref(repo)} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover">
      <span className={`flex w-[104px] shrink-0 items-center gap-2 text-[13px] font-semibold ${tone}`}>
        <Icon className="size-4" strokeWidth={2} />
        {label}
      </span>
      <RepoAvatar repo={repo} size={24} />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-accent">{repo.name}</span>
      <span className="hidden shrink-0 text-[13px] text-muted sm:inline">{metric}</span>
    </Link>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-[84px]" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[150px] w-[260px] shrink-0" />
        ))}
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}
