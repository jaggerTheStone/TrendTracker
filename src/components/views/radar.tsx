"use client";

import { ArrowRight, Radar, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOMAIN_IDS, DOMAINS, type Domain } from "@/lib/domains";
import { formatAgo, formatCompact } from "@/lib/format";
import type { RepoSummary } from "@/lib/types";
import { useApp, useNow, useOverview, useRepoLookup } from "../app-provider";
import { LiveBadge, useMovers } from "../live-feed";
import { Sparkline } from "../micro";
import { FollowButton, LangDot, repoHref, RepoAvatar, StatusTag } from "../repo-views";
import { Box, Empty, List, LiveFigure, Segmented, Skeleton } from "../ui";

/* Geometry, in viewBox units. Each repository is a spoke drawn along +x, then rotated. */
const SIZE = 1100;
const C = SIZE / 2;
const R0 = 62; // inner hub
const R = 330; // data area
const TICK = R + 7; // acceleration ticks
const BAND = R + 30; // sector arc
const LABEL = R + 42; // repository names

/** Sector colours, readable on both themes; green and red are kept for the ticks. */
const SECTOR_COLOR: Record<Domain, string> = {
  ai: "#a371f7",
  web: "#4493f8",
  devtools: "#db61a2",
  infra: "#f0883e",
  data: "#2bb3c0",
  security: "#d29922",
  apps: "#7d8cff",
  systems: "#8b949e",
};

type Lens = "momentum" | "day" | "accel";
const LENSES: { value: Lens; label: string }[] = [
  { value: "momentum", label: "Momentum" },
  { value: "day", label: "Étoiles 24 h" },
  { value: "accel", label: "Accélération" },
];
const lensValue: Record<Lens, (r: RepoSummary) => number> = {
  momentum: (r) => r.momentum,
  day: (r) => r.gained.day ?? -1,
  accel: (r) => (r.acceleration ?? 0) * Math.min(1, (r.gained.day ?? 0) / 50),
};

/** Width of the drawing on screen, to drop unreadable labels on phones. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Rounded so that server and browser print the same coordinates (no hydration mismatch). */
const round = (n: number) => Math.round(n * 100) / 100;
const deg = (rad: number) => round((rad * 180) / Math.PI);
const px = (angle: number, r: number) => round(C + Math.cos(angle) * r);
const py = (angle: number, r: number) => round(C + Math.sin(angle) * r);

export function RadarView() {
  const { repos } = useOverview();
  const { boards, account } = useApp();
  const lookup = useRepoLookup();
  const movers = useMovers();
  const now = useNow(5000);
  const { ref, width } = useWidth<HTMLDivElement>();
  const compact = width > 0 && width < 560;

  const [scope, setScope] = useState<"all" | "mine">("all");
  const [lens, setLens] = useState<Lens>("momentum");
  const [sector, setSector] = useState<Domain | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const followed = useMemo(() => new Set(boards.flatMap((b) => b.repos.map((r) => r.key))), [boards]);

  /** Repositories that gained stars in the last three minutes ripple. */
  const fresh = useMemo(() => {
    if (now === null) return new Set<string>();
    const since = now - 3 * 60_000;
    return new Set(movers.filter((m) => new Date(m.at).getTime() >= since).map((m) => m.key));
  }, [movers, now]);

  const limit = compact ? 36 : sector ? 60 : 84;
  const pool = useMemo(() => {
    const value = lensValue[lens];
    return repos
      .filter((r) => (scope === "mine" ? followed.has(r.key) : true) && (!sector || r.domain === sector))
      .filter((r) => lens !== "accel" || r.acceleration !== null)
      .sort((a, b) => value(b) - value(a))
      .slice(0, limit);
  }, [repos, scope, followed, sector, lens, limit]);

  /* Layout: sectors take room in proportion to their repositories, with a gap between them. */
  const layout = useMemo(() => {
    const value = lensValue[lens];
    const rank = new Map(pool.map((r, i) => [r.key, i]));
    const groups = DOMAIN_IDS.map((d) => ({ domain: d, repos: pool.filter((r) => r.domain === d) })).filter(
      (g) => g.repos.length > 0,
    );
    const GAP = groups.length > 1 ? 1.6 : 0;
    const slots = pool.length + GAP * groups.length;
    const step = (2 * Math.PI) / Math.max(slots, 1);
    let cursor = -Math.PI / 2 + (GAP * step) / 2;
    const spokes: { repo: RepoSummary; angle: number; radius: number }[] = [];
    const sectors: { domain: Domain; start: number; end: number; count: number }[] = [];
    for (const g of groups) {
      const start = cursor;
      for (const repo of [...g.repos].sort((a, b) => value(b) - value(a))) {
        const angle = cursor + step / 2;
        // Rank among what is shown: the strongest sit next to the hub.
        const r = rank.get(repo.key)! / Math.max(pool.length - 1, 1);
        spokes.push({ repo, angle, radius: round(R0 + 26 + r * (R - R0 - 44)) });
        cursor += step;
      }
      sectors.push({ domain: g.domain, start, end: cursor, count: g.repos.length });
      cursor += GAP * step;
    }
    return { spokes, sectors };
  }, [pool, lens]);

  const active = hovered ?? selected;
  const activeRepo = selected ? (lookup(selected) ?? null) : null;

  if (scope === "mine" && !account) {
    return (
      <div className="flex flex-col gap-4">
        <Controls {...{ scope, setScope, lens, setLens }} onScope={() => setSelected(null)} />
        <Empty icon={Radar} title="Connecte-toi pour voir tes suivis sur le radar" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Controls {...{ scope, setScope, lens, setLens }} onScope={() => setSelected(null)} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Box className="relative min-w-0 overflow-hidden p-1 sm:p-2">
          <div ref={ref} className="mx-auto w-full max-w-[860px]">
            {pool.length === 0 ? (
              <div className="grid aspect-square place-items-center text-[14px] text-muted">Aucun dépôt à placer</div>
            ) : (
              <svg
                // Without names around it (phones), the ring is cropped tight to fill the width.
                viewBox={
                  compact
                    ? `${C - BAND - 12} ${C - BAND - 12} ${2 * (BAND + 12)} ${2 * (BAND + 12)}`
                    : `0 0 ${SIZE} ${SIZE}`
                }
                className="block w-full touch-manipulation select-none"
                onClick={() => setSelected(null)}
                role="img"
                aria-label="Radar des dépôts"
              >
                <defs>
                  <linearGradient id="radar-sweep-fill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                    <stop offset="1" stopColor="var(--accent)" stopOpacity="0.16" />
                  </linearGradient>
                  {layout.sectors.map((s) => {
                    const mid = (s.start + s.end) / 2;
                    const bottom = Math.sin(mid) > 0.15;
                    const r = R - 14;
                    const [a, b] = bottom ? [s.end, s.start] : [s.start, s.end];
                    const large = Math.abs(s.end - s.start) > Math.PI ? 1 : 0;
                    return (
                      <path
                        key={s.domain}
                        id={`sector-path-${s.domain}`}
                        d={`M${px(a, r)},${py(a, r)} A${r},${r} 0 ${large} ${bottom ? 0 : 1} ${px(b, r)},${py(b, r)}`}
                      />
                    );
                  })}
                </defs>

                {/* Rings and sweep */}
                <circle cx={C} cy={C} r={R} fill="var(--subtle)" fillOpacity="0.45" stroke="var(--line)" />
                {[0.25, 0.5, 0.75].map((f) => (
                  <circle
                    key={f}
                    cx={C}
                    cy={C}
                    r={R0 + 26 + f * (R - R0 - 44)}
                    fill="none"
                    stroke="var(--line)"
                    strokeDasharray="2 6"
                  />
                ))}
                <g className="radar-sweep pointer-events-none">
                  <path
                    d={`M${C},${C} L${C + R},${C} A${R},${R} 0 0 0 ${px(-0.55, R)},${py(-0.55, R)} Z`}
                    fill="url(#radar-sweep-fill)"
                  />
                </g>

                {/* Sectors: coloured arc, name inside the ring, click to focus */}
                {layout.sectors.map((s) => {
                  const on = sector === s.domain;
                  const large = s.end - s.start > Math.PI ? 1 : 0;
                  const arc = (r: number) =>
                    `M${px(s.start, r)},${py(s.start, r)} A${r},${r} 0 ${large} 1 ${px(s.end, r)},${py(s.end, r)}`;
                  return (
                    <g
                      key={s.domain}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSector(on ? null : s.domain);
                        setSelected(null);
                      }}
                    >
                      <path d={arc(BAND)} fill="none" stroke="transparent" strokeWidth="26" />
                      <path
                        d={arc(BAND)}
                        fill="none"
                        stroke={SECTOR_COLOR[s.domain]}
                        strokeWidth={on ? 7 : 4}
                        strokeLinecap="round"
                      />
                      {/* Named inside the ring when the arc is long enough to hold it. */}
                      {(s.end - s.start) * (R - 14) > (DOMAINS[s.domain].label.length + 4) * (compact ? 26 : 13) && (
                        <text
                          fontSize={compact ? 34 : 17}
                          fontWeight="600"
                          fill={SECTOR_COLOR[s.domain]}
                          letterSpacing="0.06em"
                        >
                          <textPath href={`#sector-path-${s.domain}`} startOffset="50%" textAnchor="middle">
                            {DOMAINS[s.domain].label.toUpperCase()}
                            {!compact && ` · ${s.count}`}
                          </textPath>
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* One spoke per repository */}
                {layout.spokes.map(({ repo, angle, radius }) => {
                  const isActive = active === repo.key;
                  const dim = active !== null && !isActive;
                  const flip = Math.cos(angle) < 0;
                  const color = SECTOR_COLOR[repo.domain];
                  const dot = round(4 + Math.min(8, Math.max(1.5, Math.log10(repo.stars + 1) * 1.45)));
                  const a = repo.acceleration;
                  const tick =
                    a === null
                      ? null
                      : a >= 1.15
                        ? { color: "var(--success)", len: round(Math.min(20, 5 + (a - 1) * 7)) }
                        : a <= 0.85
                          ? { color: "var(--danger)", len: round(Math.min(20, 5 + (1 - a) * 18)) }
                          : { color: "var(--fg-faint)", len: 3 };
                  const select = (e: { stopPropagation: () => void }) => {
                    e.stopPropagation();
                    setSelected(selected === repo.key ? null : repo.key);
                  };
                  return (
                    <g
                      key={repo.key}
                      className="radar-spoke cursor-pointer outline-none"
                      style={{ transform: `rotate(${deg(angle)}deg)`, transformOrigin: `${C}px ${C}px` }}
                      opacity={dim ? 0.28 : 1}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(repo.key)}
                      onPointerLeave={() => setHovered(null)}
                      onClick={select}
                      role="button"
                      tabIndex={0}
                      aria-label={`${repo.owner}/${repo.name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(e);
                        }
                      }}
                    >
                      <title>{`${repo.owner}/${repo.name} · +${formatCompact(repo.gained.day ?? 0)} ★ en 24 h · momentum ${repo.momentum}`}</title>
                      {/* hit area along the whole spoke */}
                      <line x1={C + R0} y1={C} x2={C + LABEL + 140} y2={C} stroke="transparent" strokeWidth="14" />
                      <line
                        x1={C + R0}
                        y1={C}
                        x2={C + R + 2}
                        y2={C}
                        stroke={isActive ? color : "var(--line-muted)"}
                        strokeWidth={isActive ? 2 : 1}
                      />
                      {tick && (
                        <line
                          x1={C + TICK}
                          y1={C}
                          x2={C + TICK + tick.len}
                          y2={C}
                          stroke={tick.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      )}
                      {!compact && (
                        <text
                          x={C + LABEL}
                          y={C}
                          dominantBaseline="middle"
                          textAnchor={flip ? "end" : "start"}
                          transform={flip ? `rotate(180 ${C + LABEL} ${C})` : undefined}
                          fontSize="15"
                          fontWeight={isActive ? 700 : 500}
                          fill={isActive ? "var(--fg)" : "var(--fg-muted)"}
                        >
                          {truncate(repo.name, 18)}
                        </text>
                      )}
                      {fresh.has(repo.key) && (
                        <circle
                          className="radar-ripple pointer-events-none"
                          cx={C + radius}
                          cy={C}
                          r={dot}
                          fill="none"
                          stroke="var(--success)"
                          strokeWidth="2"
                        />
                      )}
                      {repo.status === "hot" && (
                        <circle className="radar-dot" cx={C + radius} cy={C} r={dot + 5} fill={color} opacity="0.22" />
                      )}
                      {followed.has(repo.key) && (
                        <circle
                          className="radar-dot"
                          cx={C + radius}
                          cy={C}
                          r={dot + 3}
                          fill="none"
                          stroke="var(--fg)"
                          strokeWidth="1.5"
                        />
                      )}
                      <circle
                        className="radar-dot"
                        cx={C + radius}
                        cy={C}
                        r={isActive ? dot + 2 : dot}
                        fill={color}
                        stroke="var(--canvas)"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}

                {/* Hub */}
                <circle cx={C} cy={C} r={R0} fill="var(--canvas)" stroke="var(--line)" />
                <text
                  x={C}
                  y={C - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={compact ? 30 : 22}
                  fontWeight="700"
                  fill="var(--fg)"
                >
                  {pool.length}
                </text>
                <text
                  x={C}
                  y={C + 16}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={compact ? 20 : 13}
                  fill="var(--fg-muted)"
                >
                  dépôts
                </text>
              </svg>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2 pt-1 pb-2 text-[12.5px] text-muted">
            <span>Centre = les plus forts</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-3 rounded-full bg-success" /> accélère
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-3 rounded-full bg-danger" /> ralentit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2 border-success" /> étoile reçue
            </span>
            <span>taille = étoiles</span>
          </div>
        </Box>

        <aside className="flex min-w-0 flex-col gap-4">
          <SectorChips sectors={layout.sectors} sector={sector} onSector={setSector} />
          {activeRepo ? (
            <RepoPanel repo={activeRepo} onClose={() => setSelected(null)} />
          ) : (
            <MoversPanel movers={movers} onPick={(key) => setSelected(key)} visible={new Set(pool.map((r) => r.key))} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Controls({
  scope,
  setScope,
  lens,
  setLens,
  onScope,
}: {
  scope: "all" | "mine";
  setScope: (s: "all" | "mine") => void;
  lens: Lens;
  setLens: (l: Lens) => void;
  onScope: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2">
          <Segmented id="radar-lens" value={lens} onChange={setLens} options={LENSES} />
          <Segmented
            id="radar-scope"
            value={scope}
            onChange={(v) => {
              setScope(v);
              onScope();
            }}
            options={[
              { value: "all", label: "Tout" },
              { value: "mine", label: "Mes suivis" },
            ]}
          />
        </div>
      </div>
      <LiveBadge />
    </div>
  );
}

function SectorChips({
  sectors,
  sector,
  onSector,
}: {
  sectors: { domain: Domain; count: number }[];
  sector: Domain | null;
  onSector: (d: Domain | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(sector ? [{ domain: sector, count: sectors[0]?.count ?? 0 }] : sectors).map((s) => (
        <button
          key={s.domain}
          type="button"
          onClick={() => onSector(sector === s.domain ? null : s.domain)}
          aria-pressed={sector === s.domain}
          className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors ${
            sector === s.domain ? "border-accent/50 bg-accent-soft text-accent" : "border-line hover:bg-hover"
          }`}
        >
          <span className="size-2.5 rounded-full" style={{ background: SECTOR_COLOR[s.domain] }} />
          {DOMAINS[s.domain].label}
          <span className="text-muted tabular-nums">{s.count}</span>
          {sector === s.domain && <X className="size-3.5" />}
        </button>
      ))}
    </div>
  );
}

function RepoPanel({ repo, onClose }: { repo: RepoSummary; onClose: () => void }) {
  return (
    <Box className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <RepoAvatar repo={repo} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] text-muted">{repo.owner}</div>
          <div className="truncate text-[16px] font-semibold">{repo.name}</div>
        </div>
        <button type="button" aria-label="Fermer" onClick={onClose} className="btn btn-icon">
          <X className="size-4" />
        </button>
      </div>
      {repo.description && <p className="line-clamp-3 text-[13.5px] leading-snug text-muted">{repo.description}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <LangDot language={repo.language} />
        <StatusTag status={repo.status} />
        {repo.rank !== null && <span className="text-[12.5px] text-muted">N°{repo.rank} du Trending</span>}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line-muted bg-line-muted text-[12.5px]">
        {[
          ["24 h", repo.gained.day],
          ["7 j", repo.gained.week],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-canvas px-3 py-2">
            <dt className="text-muted">Gagnées · {label}</dt>
            <dd className="text-[17px] font-semibold text-success">
              {value === null ? (
                <span className="text-faint">—</span>
              ) : (
                <LiveFigure value={value as number} prefix="+" />
              )}
            </dd>
          </div>
        ))}
        <div className="bg-canvas px-3 py-2">
          <dt className="text-muted">Étoiles</dt>
          <dd className="text-[17px] font-semibold">
            <LiveFigure value={repo.stars} />
          </dd>
        </div>
        <div className="bg-canvas px-3 py-2">
          <dt className="text-muted">Momentum</dt>
          <dd className="text-[17px] font-semibold">
            {repo.momentum}
            {repo.acceleration !== null && (
              <span className="ml-1.5 text-[12.5px] font-medium text-muted">×{repo.acceleration.toFixed(1)}</span>
            )}
          </dd>
        </div>
      </dl>
      {repo.spark.length > 1 && (
        <div className="flex items-center justify-between gap-3 text-success">
          <span className="text-[12.5px] text-muted">48 h</span>
          <Sparkline values={repo.spark} width={220} height={36} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Link href={repoHref(repo)} className="btn btn-primary flex-1 justify-center">
          Voir la fiche
          <ArrowRight className="size-4" />
        </Link>
        <FollowButton repo={repo} compact />
      </div>
    </Box>
  );
}

function MoversPanel({
  movers,
  onPick,
  visible,
}: {
  movers: { key: string; gained: number; at: string }[];
  onPick: (key: string) => void;
  visible: Set<string>;
}) {
  const lookup = useRepoLookup();
  const now = useNow(1000);
  const rows = movers
    .map((m) => ({ m, repo: lookup(m.key) }))
    .filter((x) => x.repo)
    .slice(0, 10);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold">Ça bouge · 30 min</h2>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">Aucune étoile relevée ces 30 dernières minutes.</p>
      ) : (
        <List>
          {rows.map(({ m, repo }) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onPick(m.key)}
              className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-hover"
            >
              <RepoAvatar repo={repo!} size={22} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13.5px] font-semibold ${visible.has(m.key) ? "text-accent" : ""}`}
                >
                  {repo!.name}
                </span>
                <span className="block text-[11.5px] text-muted tabular-nums">
                  {now !== null ? formatAgo(m.at, now) : ""}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-success tabular-nums">
                +{formatCompact(m.gained)} ★
              </span>
            </button>
          ))}
        </List>
      )}
    </section>
  );
}

export function RadarSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-[320px]" />
    </div>
  );
}
