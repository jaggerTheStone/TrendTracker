"use client";

import { ChevronLeft, ChevronRight, History, Loader2 } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState, useTransition } from "react";
import { formatCompact } from "@/lib/format";
import type { Period } from "@/lib/types";
import type { TrendingList } from "@/server/trending";
import { FollowButton, LangDot, MentionedOn, repoHref, RepoAvatar, StatusTag } from "../repo-views";
import { useApp } from "../app-provider";
import { Empty, List, LiveFigure, Pill, PillRow, Segmented } from "../ui";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Aujourd'hui" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "", label: "Tous les langages" },
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "c++", label: "C++" },
  { value: "swift", label: "Swift" },
];

const UNIT: Record<Period, string> = { day: "aujourd'hui", week: "cette semaine", month: "ce mois" };

const MEDAL = ["bg-[#d4a72c] text-white", "bg-[#9aa4b0] text-white", "bg-[#b0753f] text-white"];

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });

export function TrendingView({ initial }: { initial: Promise<TrendingList> }) {
  const first = use(initial);
  const [list, setList] = useState(first);
  const [query, setQuery] = useState({ period: first.period, language: first.language, day: first.day });
  const [order, setOrder] = useState<"github" | "stars">("github");
  const [pending, startTransition] = useTransition();
  // Every collection or live refresh reloads the list shown, unless it is an archived day.
  const { latest } = useApp();
  const build = query.day ? null : (latest?.lastIngestAt ?? null);

  useEffect(() => {
    const params = new URLSearchParams({ p: query.period });
    if (query.language) params.set("lang", query.language);
    if (query.day) params.set("day", query.day);
    window.history.replaceState(null, "", `?${params}`);
    const controller = new AbortController();
    fetch(`/api/trending?${params}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<TrendingList>)
      .then((next) => startTransition(() => setList(next)))
      .catch(() => {});
    return () => controller.abort();
  }, [query, build]);

  const entries =
    order === "stars" ? [...list.entries].sort((a, b) => b.gained - a.gained || a.rank - b.rank) : list.entries;

  const today = new Date().toISOString().slice(0, 10);
  const pastDays = list.days.filter((d) => d !== today);
  const showing = query.day ?? today;
  const index = pastDays.indexOf(showing);
  const canBrowse = query.period === "day" && !query.language;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2">
          <Segmented
            id="trending-period"
            value={query.period}
            options={PERIODS}
            onChange={(period) => setQuery({ period, language: period === "day" ? query.language : "", day: null })}
          />
          {canBrowse && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Jour précédent"
                disabled={index === pastDays.length - 1 || pastDays.length === 0}
                onClick={() => setQuery({ ...query, day: query.day ? pastDays[index + 1] : pastDays[0] })}
                className="btn btn-icon"
              >
                <ChevronLeft className="size-4" />
              </button>
              <label className="btn relative gap-1.5 pr-3">
                <History className="size-4 text-muted" />
                <span>{query.day ? dayLabel(query.day) : "En direct"}</span>
                <select
                  aria-label="Choisir un jour"
                  value={query.day ?? ""}
                  onChange={(e) => setQuery({ ...query, day: e.target.value || null })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="">En direct</option>
                  {pastDays.map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label="Jour suivant"
                disabled={!query.day}
                onClick={() => setQuery({ ...query, day: index > 0 ? pastDays[index - 1] : null })}
                className="btn btn-icon"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
          <Segmented
            id="trending-order"
            value={order}
            onChange={setOrder}
            options={[
              { value: "github", label: "Rang GitHub" },
              { value: "stars", label: "Étoiles gagnées" },
            ]}
          />
          {pending && <Loader2 className="size-4 animate-spin text-muted" />}
        </div>
      </div>

      {query.period === "day" && !query.day && (
        <PillRow>
          {LANGUAGES.map((l) => (
            <Pill
              key={l.value}
              active={query.language === l.value}
              onClick={() => setQuery({ ...query, language: l.value })}
            >
              {l.label}
            </Pill>
          ))}
        </PillRow>
      )}

      {list.entries.length === 0 ? (
        <Empty icon={History} title={query.day ? "Pas d'archive pour ce jour" : "Liste en cours de collecte"} />
      ) : (
        <List className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {entries.map(({ rank, gained, repo }) => (
            <div
              key={repo.key}
              className="flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-hover"
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold tabular-nums ${
                  MEDAL[rank - 1] ?? "bg-subtle text-muted"
                }`}
              >
                {rank}
              </span>
              <Link href={repoHref(repo)} className="flex min-w-0 flex-1 items-start gap-3">
                <RepoAvatar repo={repo} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] leading-snug">
                    <span className="text-muted">{repo.owner} / </span>
                    <span className="font-semibold text-accent">{repo.name}</span>
                  </span>
                  {repo.description && (
                    <span className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-muted">
                      {repo.description}
                    </span>
                  )}
                  <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                    <LangDot language={repo.language} />
                    <span className="tabular-nums">
                      ★ <LiveFigure value={repo.stars} />
                    </span>
                    <MentionedOn repo={repo} />
                    <StatusTag status={repo.status} />
                  </span>
                </span>
              </Link>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-right tabular-nums">
                  <span className="block text-[15px] font-semibold text-success">+{formatCompact(gained)} ★</span>
                  <span className="block text-[11.5px] text-faint">{query.day ? "ce jour-là" : UNIT[list.period]}</span>
                </span>
                <span className="hidden sm:block">
                  <FollowButton repo={repo} compact />
                </span>
              </span>
            </div>
          ))}
        </List>
      )}
      <p className="text-center text-[12.5px] text-faint">
        Classement et étoiles gagnées : github.com/trending, relevé toutes les 5 minutes. Totaux d&apos;étoiles en
        direct.
      </p>
    </div>
  );
}
