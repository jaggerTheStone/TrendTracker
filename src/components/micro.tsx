"use client";

import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { formatCompact } from "@/lib/format";

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Tiny trend line in the current text colour. */
export function Sparkline({ values, width = 64, height = 22 }: { values: number[]; width?: number; height?: number }) {
  const points = useMemo(() => {
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    return values.map((v, i): [number, number] => [
      (i / Math.max(values.length - 1, 1)) * width,
      height - 2 - ((v - min) / span) * (height - 4),
    ]);
  }, [values, width, height]);
  if (values.length < 2) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={smoothPath(points)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** "Nice" axis bounds and ticks: round numbers covering [min, max]. */
function niceTicks(min: number, max: number, count = 3): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

const timeFormat = (t: number, span: number) =>
  new Date(t).toLocaleString(
    "fr-FR",
    span < 3 * 86_400_000
      ? { weekday: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short", ...(span > 300 * 86_400_000 ? { year: "2-digit" } : {}) },
  );

/** One header line above a chart: what the cursor points at, or the summary. */
function Readout({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-5 items-baseline justify-between gap-3 text-[13px] text-muted tabular-nums">
      <span className="min-w-0 truncate">{left}</span>
      <span className="shrink-0 font-semibold text-fg">{right}</span>
    </div>
  );
}

/** Rendered width of an element, so charts draw at real size (text never scales up). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Star history with a value axis, dates, and a readout under the cursor or finger. */
export function AreaChart({ points, height = 200 }: { points: { t: string; stars: number }[]; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: measured } = useElementWidth<HTMLDivElement>();
  const width = measured || 640;
  const pad = { top: 8, right: 52, bottom: 22, left: 4 };
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const times = points.map((p) => new Date(p.t).getTime());
    const t0 = times[0];
    const t1 = times.at(-1)!;
    const ticks = niceTicks(Math.min(...points.map((p) => p.stars)), Math.max(...points.map((p) => p.stars)));
    const lo = Math.min(ticks[0], ...points.map((p) => p.stars));
    const hi = Math.max(ticks.at(-1)!, ...points.map((p) => p.stars));
    const x = (t: number) => pad.left + ((t - t0) / Math.max(t1 - t0, 1)) * (width - pad.left - pad.right);
    const y = (v: number) => pad.top + (1 - (v - lo) / Math.max(hi - lo, 1)) * (height - pad.top - pad.bottom);
    const coords = points.map((p, i): [number, number] => [x(times[i]), y(p.stars)]);
    return { coords, line: smoothPath(coords), ticks: ticks.map((v) => ({ v, y: y(v) })), t0, t1, times };
    // pad is a constant object literal: its values never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, height, width]);

  if (!geometry) return null;
  const span = geometry.t1 - geometry.t0;
  const gained = points.at(-1)!.stars - points[0].stars;
  const bottom = height - pad.bottom;

  return (
    <div ref={ref}>
      <Readout
        left={
          hover !== null ? timeFormat(geometry.times[hover], span) : `${timeFormat(geometry.t0, span)} → maintenant`
        }
        right={
          hover !== null ? (
            `${formatCompact(points[hover].stars)} ★`
          ) : (
            <span className="text-success">
              {gained >= 0 ? "+" : ""}
              {formatCompact(gained)} ★
            </span>
          )
        }
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={measured || undefined}
        height={height}
        className={`block w-full touch-pan-y text-accent select-none ${measured ? "" : "invisible"}`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * width;
          let best = 0;
          geometry.coords.forEach(([cx], i) => {
            if (Math.abs(cx - px) < Math.abs(geometry.coords[best][0] - px)) best = i;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geometry.ticks.map(({ v, y }) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--line-muted)" strokeDasharray="3 4" />
            <text x={width - pad.right + 8} y={y} dominantBaseline="middle" fontSize="12" fill="var(--fg-muted)">
              {formatCompact(v)}
            </text>
          </g>
        ))}
        <path
          d={`${geometry.line} L${geometry.coords.at(-1)![0]},${bottom} L${geometry.coords[0][0]},${bottom} Z`}
          fill={`url(#${id}-fill)`}
        />
        <motion.path
          d={geometry.line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle cx={geometry.coords.at(-1)![0]} cy={geometry.coords.at(-1)![1]} r="3.5" fill="currentColor" />
        <text x={pad.left} y={height - 4} fontSize="12" fill="var(--fg-muted)">
          {timeFormat(geometry.t0, span)}
        </text>
        <text x={width - pad.right} y={height - 4} fontSize="12" fill="var(--fg-muted)" textAnchor="end">
          maintenant
        </text>
        {hover !== null && (
          <g>
            <line
              x1={geometry.coords[hover][0]}
              x2={geometry.coords[hover][0]}
              y1={pad.top}
              y2={bottom}
              stroke="var(--fg-faint)"
            />
            <circle cx={geometry.coords[hover][0]} cy={geometry.coords[hover][1]} r="4" fill="currentColor" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Weekly commits over a year, shaded like GitHub's contribution graph. */
export function CommitGraph({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {values.map((v, i) => (
        <span
          key={i}
          title={`${v} commit${v > 1 ? "s" : ""}`}
          className="h-8 rounded-[2px]"
          style={{ background: `var(--graph-${level(v)})` }}
        />
      ))}
    </div>
  );
}

function lastDays(count: number): string[] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Columns that pick up the pointer: one per day, touch-friendly. */
function useDayHover() {
  const [hover, setHover] = useState<number | null>(null);
  const handlers = (count: number) => ({
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const box = e.currentTarget.getBoundingClientRect();
      setHover(Math.min(count - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * count))));
    },
    onPointerLeave: () => setHover(null),
  });
  return { hover, handlers };
}

/**
 * One bar per UTC day over the last `count` days, with a scale and a readout. Days we did not
 * watch stay empty; today's bar is lighter: the day is not over.
 */
export function DayBars({
  values,
  count = 30,
  barClass = "bg-success",
  unit = "★",
}: {
  values: { day: string; gained: number }[];
  count?: number;
  barClass?: string;
  unit?: string;
}) {
  const days = lastDays(count);
  const byDay = new Map(values.map((v) => [v.day, v.gained]));
  const max = Math.max(1, ...values.map((v) => v.gained));
  const { hover, handlers } = useDayHover();
  const total = values.reduce((a, v) => a + v.gained, 0);
  const watched = values.length;
  const shown = hover !== null ? days[hover] : null;
  const shownValue = shown ? byDay.get(shown) : undefined;
  const today = days.at(-1)!;
  return (
    <div>
      <Readout
        left={
          shown
            ? `${dayLabel(shown)}${shown === today ? " · en cours" : ""}`
            : `${watched} jour${watched > 1 ? "s" : ""} relevé${watched > 1 ? "s" : ""}`
        }
        right={
          shown
            ? shownValue === undefined
              ? "pas de relevé"
              : `+${formatCompact(shownValue)} ${unit}`
            : `+${formatCompact(total)} ${unit} · max ${formatCompact(max)}/j`
        }
      />
      <div className="flex h-28 touch-pan-y items-end gap-[3px]" {...handlers(days.length)}>
        {days.map((day, i) => {
          const v = byDay.get(day);
          return (
            <span
              key={day}
              className={`min-w-0 flex-1 rounded-t-[2px] transition-opacity ${v === undefined ? "bg-subtle" : barClass} ${
                day === today ? "opacity-55" : ""
              } ${hover !== null && hover !== i ? "opacity-40" : ""}`}
              style={{ height: v === undefined ? 3 : `${Math.max(3, (v / max) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
        <span>{dayLabel(days[0])}</span>
        <span>Aujourd&apos;hui</span>
      </div>
    </div>
  );
}

/** Daily best position on GitHub Trending: taller means higher in the list. */
export function RankStrip({ days: ranked, count = 30 }: { days: { day: string; rank: number }[]; count?: number }) {
  const days = lastDays(count);
  const byDay = new Map(ranked.map((r) => [r.day, r.rank]));
  const { hover, handlers } = useDayHover();
  const shown = hover !== null ? days[hover] : null;
  const inWindow = ranked.filter((r) => r.day >= days[0]);
  const best = inWindow.length > 0 ? Math.min(...inWindow.map((r) => r.rank)) : null;
  return (
    <div>
      <Readout
        left={shown ? dayLabel(shown) : `${inWindow.length} jour${inWindow.length > 1 ? "s" : ""} dans la liste`}
        right={
          shown
            ? byDay.has(shown)
              ? `N°${byDay.get(shown)}`
              : "hors Trending"
            : best !== null
              ? `meilleur N°${best}`
              : "—"
        }
      />
      <div className="flex h-20 touch-pan-y items-end gap-[3px]" {...handlers(days.length)}>
        {days.map((day, i) => {
          const rank = byDay.get(day);
          return (
            <span
              key={day}
              className={`min-w-0 flex-1 rounded-t-[2px] transition-opacity ${
                rank === undefined ? "bg-subtle" : rank === 1 ? "bg-attention" : "bg-accent"
              } ${hover !== null && hover !== i ? "opacity-40" : ""}`}
              style={{ height: rank === undefined ? 3 : `${Math.max(12, ((26 - Math.min(rank, 25)) / 25) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
        <span>{dayLabel(days[0])}</span>
        <span>N°1 = barre pleine</span>
        <span>Aujourd&apos;hui</span>
      </div>
    </div>
  );
}
