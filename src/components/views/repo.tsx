"use client";

import {
  CalendarDays,
  ChevronDown,
  Copy,
  GitCompareArrows,
  Medal,
  Rocket,
  Trophy,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  PackageOpen,
  Scale,
  SearchX,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useEffect, useState, useSyncExternalStore } from "react";
import { DOMAINS, languageColor } from "@/lib/domains";
import { formatCompact, formatRelative } from "@/lib/format";
import type { Analysis, Badge, BadgeKind, RepoDetail, RepoSummary } from "@/lib/types";
import { useApp, useNow, useOverview, useRepoLookup } from "../app-provider";
import { SourceGlyph } from "../glyphs";
import { devHref, topicHref } from "./explore";
import { AreaChart, CommitGraph, DayBars, RankStrip } from "../micro";
import { FollowButton, LangDot, MentionRow, RepoAvatar, RepoCard, StatusTag } from "../repo-views";
import { Box, Carousel, Empty, List, LiveFigure, Segmented, SectionTitle, Skeleton, Stats } from "../ui";

export type DetailResult = { detail: RepoDetail | null; error?: string };

export function RepoView({ owner, name, detail }: { owner: string; name: string; detail: Promise<DetailResult> }) {
  const lookup = useRepoLookup();
  const known = lookup(`${owner}/${name}`);
  return (
    <Suspense
      fallback={
        <>
          {known ? <RepoHeader repo={known} /> : <HeaderSkeleton />}
          <DetailSkeleton />
        </>
      }
    >
      <DetailBody detail={detail} />
    </Suspense>
  );
}

function Actions({ repo }: { repo: RepoSummary }) {
  const { toast, openBoardPicker } = useApp();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <FollowButton repo={repo} />
      <button type="button" className="btn" onClick={() => openBoardPicker(repo)}>
        <Layers className="size-4 text-muted" />
        <span className="hidden sm:inline">Tableau</span>
      </button>
      <Link href={`/comparer?r=${repo.owner}/${repo.name}`} className="btn" aria-label="Comparer">
        <GitCompareArrows className="size-4 text-muted" />
        <span className="hidden sm:inline">Comparer</span>
      </Link>
      <button
        type="button"
        aria-label="Partager"
        className="btn btn-icon"
        onClick={async () => {
          const url = window.location.href;
          if (navigator.share) await navigator.share({ title: `${repo.owner}/${repo.name}`, url }).catch(() => {});
          else {
            await navigator.clipboard?.writeText(url).catch(() => {});
            toast("Lien copié");
          }
        }}
      >
        <Share2 className="size-4 text-muted" />
      </button>
      <a href={`https://github.com/${repo.owner}/${repo.name}`} target="_blank" rel="noreferrer" className="btn">
        <SourceGlyph source="github" size={16} />
        <span className="hidden sm:inline">GitHub</span>
        <ExternalLink className="size-3.5 text-muted" />
      </a>
    </div>
  );
}

function RepoHeader({ repo, detail }: { repo: RepoSummary; detail?: RepoDetail }) {
  const now = useNow();
  const router = useRouter();
  return (
    <header className="border-b border-line-muted pt-6 pb-5">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="mb-4 text-[13.5px] text-accent hover:underline"
      >
        ← Retour
      </button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <RepoAvatar repo={repo} size={44} />
          <h1 className="min-w-0 text-[20px] leading-tight break-words sm:text-[24px]">
            <Link href={devHref(repo.owner)} className="text-muted hover:text-accent hover:underline">
              {repo.owner}
            </Link>
            <span className="text-muted"> / </span>
            <span className="font-semibold">{repo.name}</span>
          </h1>
        </div>
        <Actions repo={repo} />
      </div>
      {repo.description && <p className="mt-4 max-w-[75ch] text-[15.5px] leading-relaxed">{repo.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <LangDot language={repo.language} />
        <StatusTag status={repo.status} />
        <span>{DOMAINS[repo.domain].label}</span>
        {detail?.license && (
          <span className="inline-flex items-center gap-1">
            <Scale className="size-3.5" />
            {detail.license}
          </span>
        )}
        {repo.createdAt && now !== null && <span>créé il y a {formatRelative(repo.createdAt, now)}</span>}
        {detail?.homepage && (
          <a
            href={detail.homepage}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-accent hover:underline"
          >
            <Globe className="size-3.5 shrink-0" />
            <span className="truncate">{detail.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
          </a>
        )}
        {detail?.archived && (
          <span className="rounded-full border border-attention/50 px-2 text-attention">Archivé</span>
        )}
      </div>
      {detail && detail.badges.length > 0 && <Badges badges={detail.badges} />}
      {repo.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 10).map((t) => (
            <Link
              key={t}
              href={topicHref(t)}
              className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent hover:bg-accent hover:text-white"
            >
              {t}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

const BADGE: Record<BadgeKind, { icon: LucideIcon | "youtube" | "hackernews"; className: string }> = {
  first: { icon: Trophy, className: "border-attention/50 text-attention" },
  top10: { icon: Medal, className: "border-attention/50 text-attention" },
  streak: { icon: CalendarDays, className: "border-accent/50 text-accent" },
  rocket: { icon: Rocket, className: "border-done/50 text-done" },
  youtube: { icon: "youtube", className: "border-danger/50 text-danger" },
  hackernews: { icon: "hackernews", className: "border-attention/50 text-attention" },
};

function Badges({ badges }: { badges: Badge[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const { icon: Icon, className } = BADGE[b.kind];
        return (
          <span
            key={b.kind}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold ${className}`}
          >
            {typeof Icon === "string" ? (
              <SourceGlyph source={Icon} size={13} />
            ) : (
              <Icon className="size-3.5" strokeWidth={2} />
            )}
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

function DetailBody({ detail: promise }: { detail: Promise<DetailResult> }) {
  const { detail: initial, error } = use(promise);
  const { remember, latest } = useApp();
  const { features } = useOverview();
  const now = useNow();
  const [fresh, setFresh] = useState<RepoDetail | null>(null);
  const detail = fresh ?? initial;

  useEffect(() => {
    if (initial) remember([initial.repo, ...initial.similar]);
  }, [initial, remember]);

  // Live page: every collection or live refresh brings new counts, charts and badges.
  const build = latest?.lastIngestAt ?? null;
  const owner = initial?.repo.owner;
  const name = initial?.repo.name;
  useEffect(() => {
    if (!build || !owner || !name) return;
    const controller = new AbortController();
    fetch(`/api/repo/${owner}/${name}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RepoDetail>) : null))
      .then((next) => {
        if (next) setFresh(next);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [build, owner, name]);

  if (!detail) {
    return (
      <div className="pt-6">
        <Empty icon={SearchX} title={error ?? "Dépôt introuvable"} />
      </div>
    );
  }
  const { repo } = detail;
  const readmeHtml = initial?.readmeHtml ?? null;
  const gain = (value: number | null) =>
    value !== null ? (
      <span className="text-success">
        <LiveFigure value={value} prefix="+" />
      </span>
    ) : (
      <span className="text-faint">—</span>
    );

  return (
    <div className="flex min-w-0 flex-col">
      <RepoHeader repo={repo} detail={detail} />

      <div className="mt-6">
        <Stats
          items={[
            {
              label: "Étoiles",
              value: <LiveFigure value={repo.stars} />,
              hint: `${formatCompact(repo.forks)} forks${detail.contributors ? ` · ${formatCompact(detail.contributors)} contrib.` : ""}`,
            },
            {
              label: "Gagnées · 24 h",
              value: gain(repo.gained.day),
              hint:
                repo.acceleration !== null
                  ? `×${repo.acceleration.toFixed(1)} son rythme habituel`
                  : repo.rank !== null
                    ? `N°${repo.rank} du Trending`
                    : undefined,
            },
            repo.gained.week === null && detail.dailyStars.length > 0
              ? {
                  // Not watched for a full week yet: say what we did see, and over how long.
                  label: `Gagnées · ${detail.dailyStars.length} j relevé${detail.dailyStars.length > 1 ? "s" : ""}`,
                  value: gain(detail.dailyStars.reduce((a, d) => a + d.gained, 0)),
                  hint: "semaine complète bientôt",
                }
              : {
                  label: "Gagnées · 7 j",
                  value: gain(repo.gained.week),
                  hint: repo.gained.month !== null ? `+${formatCompact(repo.gained.month)} sur 30 j` : undefined,
                },
            {
              label: "Momentum",
              value: `${repo.momentum}/100`,
              hint: "vitesse · croissance · buzz",
            },
          ]}
        />
      </div>

      {(detail.dailyStars.length > 0 ||
        detail.dailyForks.length > 0 ||
        detail.dailyPrs.length > 0 ||
        detail.trendingDays.length > 0) && (
        <>
          <SectionTitle>30 derniers jours</SectionTitle>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Activity detail={detail} />
            {detail.trendingDays.length > 0 && (
              <Box className="flex min-w-0 flex-col gap-3 p-4">
                <span className="text-[15px] font-semibold">Classement GitHub Trending</span>
                <RankStrip days={detail.trendingDays} />
              </Box>
            )}
          </div>
        </>
      )}

      {detail.starHistory.length > 1 && (
        <>
          <StarHistory points={detail.starHistory} />
        </>
      )}

      {(detail.commits?.some((c) => c > 0) || detail.languages.length > 0) && (
        <div className="mt-9 grid min-w-0 gap-4 lg:grid-cols-2">
          {detail.commits && detail.commits.some((c) => c > 0) && (
            <Box className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[15px] font-semibold">Commits sur un an</span>
                <span className="text-[12.5px] text-muted">
                  {formatCompact(detail.commits.reduce((a, b) => a + b, 0))} commits
                  {detail.pushedAt && now !== null && ` · dernier push il y a ${formatRelative(detail.pushedAt, now)}`}
                </span>
              </div>
              <CommitGraph values={detail.commits} />
            </Box>
          )}
          {detail.languages.length > 0 && <Languages languages={detail.languages} />}
        </div>
      )}

      {features.ai && <AiCard repoKey={repo.key} />}

      {detail.releases.length > 0 && (
        <>
          <SectionTitle>Versions</SectionTitle>
          <List>
            {detail.releases.map((r, i) => (
              <a
                key={r.tag}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
              >
                <PackageOpen className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[14.5px]">
                  <span className="font-semibold">{r.tag}</span>
                  {r.name && r.name !== r.tag && <span className="text-muted"> · {r.name}</span>}
                </span>
                {i === 0 && (
                  <span className="rounded-full border border-success/50 px-2 text-[12px] font-medium text-success">
                    Dernière
                  </span>
                )}
                {r.publishedAt && now !== null && (
                  <span className="shrink-0 text-[12.5px] text-muted">{formatRelative(r.publishedAt, now)}</span>
                )}
              </a>
            ))}
          </List>
        </>
      )}

      {detail.mentions.length > 0 && (
        <>
          <SectionTitle>On en parle</SectionTitle>
          <List>
            {detail.mentions.slice(0, 8).map((m) => (
              <MentionRow key={m.id} mention={{ ...m, repos: [] }} />
            ))}
          </List>
        </>
      )}

      {detail.similar.length > 0 && (
        <>
          <SectionTitle>Similaires</SectionTitle>
          <Carousel label="Dépôts similaires">
            {detail.similar.map((r) => (
              <RepoCard key={r.key} repo={r} />
            ))}
          </Carousel>
        </>
      )}

      <BadgeEmbed owner={repo.owner} name={repo.name} />

      {readmeHtml && <Readme html={readmeHtml} />}
    </div>
  );
}

function Languages({ languages }: { languages: { name: string; bytes: number }[] }) {
  const total = languages.reduce((a, l) => a + l.bytes, 0) || 1;
  const top = languages.slice(0, 6);
  return (
    <Box className="flex min-w-0 flex-col gap-3 p-4">
      <span className="text-[15px] font-semibold">Langages</span>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {top.map((l) => (
          <span key={l.name} style={{ width: `${(l.bytes / total) * 100}%`, background: languageColor(l.name) }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {top.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: languageColor(l.name) }} />
            <span className="font-semibold">{l.name}</span>
            <span className="text-muted tabular-nums">
              {((l.bytes / total) * 100).toFixed(l.bytes / total < 0.1 ? 1 : 0)} %
            </span>
          </span>
        ))}
      </div>
    </Box>
  );
}

const VERDICT: Record<Analysis["verdict"], { label: string; className: string }> = {
  essayer: { label: "À essayer", className: "border-success/50 text-success" },
  surveiller: { label: "À surveiller", className: "border-attention/50 text-attention" },
  passer: { label: "Effet de mode", className: "border-danger/50 text-danger" },
};

function AiCard({ repoKey }: { repoKey: string }) {
  const [state, setState] = useState<
    { status: "idle" | "loading" } | { status: "done"; analysis: Analysis } | { status: "error"; message: string }
  >({ status: "idle" });

  const run = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: repoKey }),
      });
      const body = (await res.json()) as Analysis & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Analyse indisponible.");
      setState({ status: "done", analysis: body });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  };

  return (
    <>
      <SectionTitle>Analyse IA</SectionTitle>
      <Box className="p-4">
        {state.status === "done" ? (
          <div className="flex flex-col gap-3">
            <span
              className={`self-start rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold ${VERDICT[state.analysis.verdict].className}`}
            >
              {VERDICT[state.analysis.verdict].label}
            </span>
            <p className="text-[16px] leading-snug font-semibold">{state.analysis.pitch}</p>
            <dl className="grid gap-3 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="text-[12.5px] font-semibold text-muted">Pourquoi maintenant</dt>
                <dd className="mt-0.5">{state.analysis.why}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold text-muted">Pour qui</dt>
                <dd className="mt-0.5">{state.analysis.audience}</dd>
              </div>
            </dl>
            {state.analysis.alternatives.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="mr-1 font-semibold text-muted">Alternatives</span>
                {state.analysis.alternatives.map((a) => (
                  <Link
                    key={a}
                    href={`/explorer?q=${encodeURIComponent(a)}`}
                    className="rounded-full border border-line px-2.5 py-0.5 hover:bg-hover"
                  >
                    {a}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Sparkles className="size-5 shrink-0 text-done" />
            <span className="min-w-0 flex-1 text-[14px] text-muted">
              {state.status === "error" ? state.message : "Ce que c'est, pourquoi ça monte, pour qui."}
            </span>
            <button type="button" onClick={run} disabled={state.status === "loading"} className="btn">
              {state.status === "loading" && <Loader2 className="size-4 animate-spin" />}
              Analyser
            </button>
          </div>
        )}
      </Box>
    </>
  );
}

const RANGES = [
  { value: "2d", label: "48 h", ms: 2 * 86_400_000 },
  { value: "7d", label: "7 j", ms: 7 * 86_400_000 },
  { value: "30d", label: "30 j", ms: 30 * 86_400_000 },
  { value: "all", label: "Tout", ms: Infinity },
] as const;

/** Star curve from our snapshots, over a chosen range (only ranges we have data for). */
function StarHistory({ points }: { points: { t: string; stars: number }[] }) {
  const first = new Date(points[0].t).getTime();
  const last = new Date(points.at(-1)!.t).getTime();
  const covered = RANGES.filter((r) => r.ms === Infinity || last - first > r.ms * 0.6);
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>(covered.length > 2 ? "30d" : "all");
  const ms = RANGES.find((r) => r.value === range)!.ms;
  const shown = ms === Infinity ? points : points.filter((p) => new Date(p.t).getTime() >= last - ms);
  return (
    <>
      <SectionTitle
        action={
          covered.length > 1 ? (
            <Segmented
              id="star-range"
              value={range}
              onChange={setRange}
              options={covered.map((r) => ({ value: r.value, label: r.label }))}
            />
          ) : undefined
        }
      >
        Historique des étoiles
      </SectionTitle>
      <Box className="p-4">
        <AreaChart points={shown.length > 1 ? shown : points} />
      </Box>
    </>
  );
}

const ACTIVITY = {
  stars: { label: "Étoiles", unit: "★", bar: "bg-success", text: "text-success" },
  forks: { label: "Forks", unit: "forks", bar: "bg-accent", text: "text-accent" },
  prs: { label: "PR fusionnées", unit: "PR", bar: "bg-done", text: "text-done" },
} as const;

/** Stars, forks and merged pull requests per day, one tab each. */
function Activity({ detail }: { detail: RepoDetail }) {
  const data = { stars: detail.dailyStars, forks: detail.dailyForks, prs: detail.dailyPrs };
  const [tab, setTab] = useState<keyof typeof ACTIVITY>("stars");
  const values = data[tab];
  const meta = ACTIVITY[tab];
  return (
    <Box className="flex min-w-0 flex-col gap-3 p-4">
      <Segmented
        id="activity"
        value={tab}
        onChange={setTab}
        options={(Object.keys(ACTIVITY) as (keyof typeof ACTIVITY)[]).map((k) => ({
          value: k,
          label: ACTIVITY[k].label,
        }))}
      />
      {values.length > 0 ? (
        <DayBars values={values} barClass={meta.bar} unit={meta.unit} />
      ) : (
        <p className="grid h-[150px] place-items-center text-center text-[13px] text-muted">
          {tab === "prs" ? "Aucune PR fusionnée sur 30 jours" : "Relevés en cours : revenez demain"}
        </p>
      )}
    </Box>
  );
}

const noopSubscribe = () => () => {};

/** README badge for maintainers: a live image linking back to this page. */
function BadgeEmbed({ owner, name }: { owner: string; name: string }) {
  const { toast } = useApp();
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const src = `/api/badge/${owner}/${name}`;
  const markdown = `[![TrendTracker](${origin}${src})](${origin}/r/${owner}/${name})`;
  return (
    <>
      <SectionTitle>Badge pour le README</SectionTitle>
      <Box className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Badge TrendTracker" className="h-[22px] self-start sm:self-center" />
        <code className="min-w-0 flex-1 truncate rounded-md bg-subtle px-3 py-2 font-mono text-[12.5px] text-muted">
          {markdown}
        </code>
        <button
          type="button"
          className="btn shrink-0"
          onClick={async () => {
            await navigator.clipboard?.writeText(markdown).catch(() => {});
            toast("Markdown copié");
          }}
        >
          <Copy className="size-4 text-muted" />
          Copier
        </button>
      </Box>
    </>
  );
}

function Readme({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SectionTitle>README</SectionTitle>
      <Box className="p-4 sm:p-6">
        <div
          className={`readme ${open ? "" : "fade-bottom max-h-[560px] overflow-hidden"}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!open && (
          <div className="mt-2 flex justify-center">
            <button type="button" onClick={() => setOpen(true)} className="btn">
              Lire tout
              <ChevronDown className="size-4" />
            </button>
          </div>
        )}
      </Box>
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-line-muted pt-6 pb-5">
      <Skeleton className="h-4 w-16 rounded-full" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <Skeleton className="h-6 w-56 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-full" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <Skeleton className="h-[84px]" />
      <Skeleton className="h-[220px]" />
    </div>
  );
}

export { HeaderSkeleton };
