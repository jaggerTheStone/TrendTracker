"use client";

import { Building2, Globe, Hash, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { formatCompact, formatDate } from "@/lib/format";
import type { RepoSummary } from "@/lib/types";
import type { DeveloperPage, TopicPage } from "@/server/explore";
import { useOverview } from "../app-provider";
import { SourceGlyph } from "../glyphs";
import { avatarSrc, MentionRow, RepoRow } from "../repo-views";
import { Empty, Figure, List, LiveFigure, SectionTitle, Stats } from "../ui";

/** Last 24 h: the one window known for every repository we watch, so totals add up. */
const dayGain = (r: RepoSummary) => r.gained.day ?? 0;
const IGNORED = new Set(["hacktoberfest", "awesome", "awesome-list", "github", "open-source", "opensource"]);

export const topicHref = (topic: string) => `/sujets/${encodeURIComponent(topic)}`;
export const devHref = (owner: string) => `/dev/${encodeURIComponent(owner)}`;

/* ───────────── Topics ───────────── */

export function TopicsIndex() {
  const { repos } = useOverview();
  const topics = useMemo(() => {
    const byTopic = new Map<string, { count: number; gained: number; avatars: string[] }>();
    for (const r of repos) {
      for (const t of r.topics) {
        if (IGNORED.has(t)) continue;
        const e = byTopic.get(t) ?? { count: 0, gained: 0, avatars: [] };
        e.count += 1;
        e.gained += dayGain(r);
        if (e.avatars.length < 4 && !e.avatars.includes(r.avatar)) e.avatars.push(r.avatar);
        byTopic.set(t, e);
      }
    }
    return [...byTopic].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].gained - a[1].gained);
  }, [repos]);

  if (topics.length === 0) return <Empty icon={Hash} title="Aucun sujet pour l'instant" />;
  return (
    <List>
      {topics.map(([topic, v], i) => (
        <Link
          key={topic}
          href={topicHref(topic)}
          className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
        >
          <span className="w-6 shrink-0 text-right text-[13px] text-faint tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-accent">#{topic}</span>
            <span className="block text-[12.5px] text-muted">{v.count} dépôts en vue</span>
          </span>
          <span className="hidden -space-x-1.5 sm:flex">
            {v.avatars.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a}
                src={avatarSrc(a, 24)}
                alt=""
                className="size-6 rounded-full border-2 border-canvas"
                referrerPolicy="no-referrer"
              />
            ))}
          </span>
          <span className="w-[86px] shrink-0 text-right text-[14px] font-semibold text-success tabular-nums">
            +{formatCompact(v.gained)} ★ <span className="text-[11.5px] font-normal text-faint">24 h</span>
          </span>
        </Link>
      ))}
    </List>
  );
}

export function TopicView({ data }: { data: TopicPage }) {
  return (
    <div className="flex min-w-0 flex-col">
      <Stats
        items={[
          { label: "Dépôts en vue", value: data.rising.length },
          { label: "Étoiles · 24 h", value: <LiveFigure value={data.gainedDay} prefix="+" /> },
          { label: "Mentions · 14 j", value: data.mentions.length },
        ]}
      />

      {data.related.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {data.related.map((r) => (
            <Link
              key={r.topic}
              href={topicHref(r.topic)}
              className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-medium text-accent hover:bg-accent hover:text-white"
            >
              #{r.topic}
            </Link>
          ))}
        </div>
      )}

      {data.rising.length > 0 && (
        <>
          <SectionTitle>En vue aujourd&apos;hui</SectionTitle>
          <List>
            {data.rising.map((repo, i) => (
              <RepoRow key={repo.key} repo={repo} period="day" rank={i + 1} />
            ))}
          </List>
        </>
      )}

      {data.popular.length > 0 && (
        <>
          <SectionTitle>Les plus étoilés</SectionTitle>
          <List>
            {data.popular.map((repo, i) => (
              <RepoRow key={repo.key} repo={repo} period="day" rank={i + 1} />
            ))}
          </List>
        </>
      )}

      {data.mentions.length > 0 && (
        <>
          <SectionTitle>On en parle</SectionTitle>
          <List>
            {data.mentions.map((m) => (
              <MentionRow key={m.id} mention={m} />
            ))}
          </List>
        </>
      )}

      {data.rising.length === 0 && data.popular.length === 0 && <Empty icon={Hash} title="Aucun dépôt pour ce sujet" />}
    </div>
  );
}

/* ───────────── Developers ───────────── */

export function DevelopersIndex({ appearances }: { appearances: Record<string, number> }) {
  const { repos } = useOverview();
  const developers = useMemo(() => {
    const byOwner = new Map<string, { owner: string; avatar: string; repos: number; gained: number }>();
    for (const r of repos) {
      const key = r.owner.toLowerCase();
      const e = byOwner.get(key) ?? { owner: r.owner, avatar: r.avatar, repos: 0, gained: 0 };
      e.repos += 1;
      e.gained += dayGain(r);
      byOwner.set(key, e);
    }
    return [...byOwner.values()]
      .filter((d) => d.gained > 0)
      .sort((a, b) => b.gained - a.gained)
      .slice(0, 60);
  }, [repos]);

  return (
    <List>
      {developers.map((d, i) => {
        const days = appearances[d.owner.toLowerCase()] ?? 0;
        return (
          <Link
            key={d.owner}
            href={devHref(d.owner)}
            className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
          >
            <span className="w-6 shrink-0 text-right text-[13px] text-faint tabular-nums">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.avatar}
              alt=""
              className="size-9 shrink-0 rounded-full border border-line-muted"
              referrerPolicy="no-referrer"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{d.owner}</span>
              <span className="block text-[12.5px] text-muted">
                {d.repos} dépôt{d.repos > 1 ? "s" : ""} en vue
                {days > 0 && ` · ${days} jour${days > 1 ? "s" : ""} dans le Trending`}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold text-success tabular-nums">
              +{formatCompact(d.gained)} ★ <span className="text-[11.5px] font-normal text-faint">24 h</span>
            </span>
          </Link>
        );
      })}
    </List>
  );
}

export function DeveloperView({ data }: { data: DeveloperPage }) {
  const { profile } = data;
  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex flex-col gap-4 border-b border-line-muted pt-6 pb-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatar_url}
          alt=""
          className={`size-20 shrink-0 border border-line ${profile.type === "Organization" ? "rounded-xl" : "rounded-full"}`}
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-tight font-semibold break-words">{profile.name ?? profile.login}</h1>
          <p className="text-[16px] text-muted">
            {profile.login}
            {profile.type === "Organization" && " · organisation"}
          </p>
          {profile.bio && <p className="mt-2 max-w-[70ch] text-[15px]">{profile.bio}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {formatCompact(profile.followers)} abonnés
            </span>
            {profile.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {profile.company}
              </span>
            )}
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {profile.location}
              </span>
            )}
            {profile.blog && (
              <a
                href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 text-accent hover:underline"
              >
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{profile.blog.replace(/^https?:\/\//, "")}</span>
              </a>
            )}
            <span>sur GitHub depuis {formatDate(profile.created_at)}</span>
          </div>
        </div>
        <a href={profile.html_url} target="_blank" rel="noreferrer" className="btn self-start">
          <SourceGlyph source="github" size={16} />
          Profil GitHub
        </a>
      </header>

      <div className="mt-6">
        <Stats
          items={[
            { label: "Dépôts publics", value: formatCompact(profile.public_repos) },
            { label: "Étoiles (top dépôts)", value: <Figure value={data.totalStars} /> },
            { label: "En vue maintenant", value: data.rising.length },
            { label: "Jours dans le Trending", value: data.trendingDays },
          ]}
        />
      </div>

      {data.rising.length > 0 && (
        <>
          <SectionTitle>En vue maintenant</SectionTitle>
          <List>
            {data.rising.map((repo) => (
              <RepoRow key={repo.key} repo={repo} period="day" />
            ))}
          </List>
        </>
      )}

      {data.popular.length > 0 && (
        <>
          <SectionTitle>Dépôts populaires</SectionTitle>
          <List>
            {data.popular.map((repo) => (
              <RepoRow key={repo.key} repo={repo} period="day" />
            ))}
          </List>
        </>
      )}

      {data.mentions.length > 0 && (
        <>
          <SectionTitle>On en parle</SectionTitle>
          <List>
            {data.mentions.map((m) => (
              <MentionRow key={m.id} mention={m} />
            ))}
          </List>
        </>
      )}
    </div>
  );
}
