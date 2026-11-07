"use client";

import { MessageSquareOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDay } from "@/lib/format";
import { MENTION_SOURCES, type MentionSource } from "@/lib/types";
import { useNow, useOverview } from "../app-provider";
import { SOURCE_LABEL, SourceGlyph } from "../glyphs";
import { MentionRow } from "../repo-views";
import { Empty, List, Pill, PillRow } from "../ui";

export function BuzzView() {
  const { mentions } = useOverview();
  const params = useSearchParams();
  const now = useNow();
  const [source, setSource] = useState<MentionSource | null>(() =>
    MENTION_SOURCES.includes(params.get("s") as MentionSource) ? (params.get("s") as MentionSource) : null,
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(MENTION_SOURCES.map((s) => [s, 0])) as Record<MentionSource, number>;
    for (const m of mentions) c[m.source] += 1;
    return c;
  }, [mentions]);

  const groups = useMemo(() => {
    const list = source ? mentions.filter((m) => m.source === source) : mentions;
    const byDay = new Map<string, typeof list>();
    for (const m of list) {
      const day = m.publishedAt.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), m]);
    }
    return [...byDay];
  }, [mentions, source]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PillRow>
        <Pill active={source === null} onClick={() => setSource(null)}>
          Tout <span className="text-muted">{mentions.length}</span>
        </Pill>
        {MENTION_SOURCES.filter((s) => counts[s] > 0).map((s) => (
          <Pill key={s} active={source === s} onClick={() => setSource(source === s ? null : s)}>
            <SourceGlyph source={s} size={14} />
            {SOURCE_LABEL[s]} <span className="text-muted">{counts[s]}</span>
          </Pill>
        ))}
      </PillRow>

      {groups.length === 0 ? (
        <Empty icon={MessageSquareOff} title="Rien pour l'instant" />
      ) : (
        groups.map(([day, list]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="mt-3 text-[14px] font-semibold text-muted first-letter:uppercase">
              {now === null ? day : formatDay(`${day}T12:00:00Z`, now)}
            </h2>
            <List>
              {list.map((m) => (
                <MentionRow key={m.id} mention={m} />
              ))}
            </List>
          </section>
        ))
      )}
    </div>
  );
}
