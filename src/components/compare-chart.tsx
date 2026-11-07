"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { formatCompact } from "@/lib/format";

export interface Series {
  label: string;
  color: string;
  points: { x: number; stars: number }[];
}

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

/** Several star histories on one chart; x is a timestamp or a number of days, as given. */
export function CompareChart({
  series,
  height = 260,
  formatX,
}: {
  series: Series[];
  height?: number;
  formatX: (x: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 700;
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x));
  const max = Math.max(...all.map((p) => p.stars), 1);
  const sx = (x: number) => ((x - x0) / Math.max(x1 - x0, 1)) * width;
  const sy = (v: number) => height - 6 - (v / max) * (height - 16);
  const valueAt = (s: Series, x: number) => {
    let value: number | null = null;
    for (const p of s.points) if (p.x <= x) value = p.stars;
    return value;
  };
  const cursor = hover ?? x1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="text-muted tabular-nums">{formatX(cursor)}</span>
        {series.map((s) => {
          const v = valueAt(s, cursor);
          return (
            <span key={s.label} className="inline-flex min-w-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="max-w-[160px] truncate">{s.label}</span>
              <span className="font-semibold tabular-nums">{v === null ? "—" : formatCompact(v)}</span>
            </span>
          );
        })}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full touch-none"
        style={{ height }}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(x0 + ((e.clientX - box.left) / box.width) * (x1 - x0));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="var(--line-muted)"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s) => (
          <motion.path
            key={s.label}
            d={smoothPath(s.points.map((p): [number, number] => [sx(p.x), sy(p.stars)]))}
            fill="none"
            stroke={s.color}
            strokeWidth="2.2"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        {hover !== null && (
          <line
            x1={sx(hover)}
            x2={sx(hover)}
            y1="0"
            y2={height}
            stroke="var(--line)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
