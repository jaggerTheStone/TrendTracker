"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";
import { formatAgo, formatCompact } from "@/lib/format";
import type { PulseEvent } from "@/lib/types";
import { useNow, useOverview, useRepoLookup } from "./app-provider";
import { repoHref, RepoAvatar } from "./repo-views";
import { List, SectionTitle } from "./ui";

export interface Mover {
  key: string;
  /** Stars gained over the last 30 minutes. */
  gained: number;
  /** Time of the latest gain. */
  at: string;
}

/** Star gains of the last 30 minutes, one entry per repository, biggest first. */
export function useMovers(): Mover[] {
  const { pulse } = useOverview();
  return useMemo(() => groupPulse(pulse), [pulse]);
}

export function groupPulse(pulse: PulseEvent[]): Mover[] {
  const byKey = new Map<string, Mover>();
  for (const e of pulse) {
    const m = byKey.get(e.key);
    if (m) {
      m.gained += e.delta;
      if (e.at > m.at) m.at = e.at;
    } else byKey.set(e.key, { key: e.key, gained: e.delta, at: e.at });
  }
  return [...byKey.values()].sort((a, b) => b.gained - a.gained || b.at.localeCompare(a.at));
}

export function LiveBadge() {
  const { lastIngestAt } = useOverview();
  const now = useNow(1000);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
      <span className="relative inline-flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
        <span className="relative size-2 rounded-full bg-success" />
      </span>
      {lastIngestAt && now !== null ? `Mis à jour ${formatAgo(lastIngestAt, now)}` : "En direct"}
    </span>
  );
}

/** "Ça bouge maintenant": the repositories that just gained stars. */
export function LiveFeed({ limit = 6 }: { limit?: number }) {
  const movers = useMovers().slice(0, limit);
  const lookup = useRepoLookup();
  const now = useNow(1000);
  const rows = movers.map((m) => ({ m, repo: lookup(m.key) })).filter((x) => x.repo);
  if (rows.length === 0) return null;
  return (
    <>
      <SectionTitle action={<LiveBadge />}>Ça bouge · 30 min</SectionTitle>
      <List>
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map(({ m, repo }) => (
            <motion.div
              key={m.key}
              layout
              initial={{ opacity: 0, backgroundColor: "var(--success-soft)" }}
              animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link
                href={repoHref(repo!)}
                className="flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover"
              >
                <RepoAvatar repo={repo!} size={24} />
                <span className="min-w-0 flex-1 truncate text-[14.5px]">
                  <span className="text-muted">{repo!.owner} / </span>
                  <span className="font-semibold text-accent">{repo!.name}</span>
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold text-success tabular-nums">
                  +{formatCompact(m.gained)} ★
                </span>
                <span className="hidden w-[92px] shrink-0 text-right text-[12.5px] text-muted tabular-nums sm:inline">
                  {now !== null ? formatAgo(m.at, now) : ""}
                </span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </List>
    </>
  );
}
