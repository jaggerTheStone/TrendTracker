"use client";

import { GitCompareArrows, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCompact, formatDate, formatRelative } from "@/lib/format";
import { parseRepoInput } from "@/lib/links";
import type { RepoDetail } from "@/lib/types";
import { useNow, useOverview } from "../app-provider";
import { CompareChart, type Series } from "../compare-chart";
import { repoHref, RepoAvatar } from "../repo-views";
import { Box, Empty, Segmented, SectionTitle } from "../ui";

const COLORS = ["var(--accent)", "var(--success)", "var(--done)", "var(--attention)"];
const MAX = 4;

type Loaded = { key: string; detail?: RepoDetail; error?: string };

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow();
  const { repos } = useOverview();
  const keys = useMemo(
    () =>
      (params.get("r") ?? "")
        .split(",")
        .map((k) => parseRepoInput(k))
        .filter((k): k is string => Boolean(k))
        .slice(0, MAX),
    [params],
  );
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"date" | "age">("date");

  const requested = useRef(new Set<string>());
  useEffect(() => {
    for (const key of keys) {
      if (requested.current.has(key.toLowerCase())) continue;
      requested.current.add(key.toLowerCase());
      fetch(`/api/repo/${key}`)
        .then(async (res) => {
          const body = (await res.json()) as RepoDetail & { error?: string };
          setLoaded((prev) => ({
            ...prev,
            [key.toLowerCase()]: res.ok ? { key, detail: body } : { key, error: body.error ?? "Indisponible" },
          }));
        })
        .catch(() => setLoaded((prev) => ({ ...prev, [key.toLowerCase()]: { key, error: "Indisponible" } })));
    }
  }, [keys]);

  const setKeys = (next: string[]) => {
    const q = next.length ? `?r=${next.join(",")}` : "";
    router.replace(`/comparer${q}`, { scroll: false });
  };

  const add = (raw: string) => {
    const key = parseRepoInput(raw) ?? repos.find((r) => r.name.toLowerCase() === raw.trim().toLowerCase())?.key;
    if (!key || keys.some((k) => k.toLowerCase() === key.toLowerCase()) || keys.length >= MAX) return;
    setKeys([...keys, key]);
    setInput("");
  };

  const suggestions =
    input.trim().length >= 2
      ? repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(input.trim().toLowerCase())).slice(0, 6)
      : [];

  const entries = keys.map((k, i) => ({ ...loaded[k.toLowerCase()], key: k, color: COLORS[i] }));
  const ready = entries.filter((e) => e.detail);

  const series: Series[] = ready.map((e) => {
    const d = e.detail!;
    const created = d.repo.createdAt ? new Date(d.repo.createdAt).getTime() : null;
    const history = d.starHistory.length > 1 ? d.starHistory : [{ t: new Date().toISOString(), stars: d.repo.stars }];
    return {
      label: `${d.repo.owner}/${d.repo.name}`,
      color: e.color,
      points: history.map((p) => {
        const t = new Date(p.t).getTime();
        return { x: mode === "age" && created ? (t - created) / 86_400_000 : t, stars: p.stars };
      }),
    };
  });

  const rows: { label: string; value: (d: RepoDetail) => string; best?: (d: RepoDetail) => number }[] = [
    { label: "Étoiles", value: (d) => formatCompact(d.repo.stars), best: (d) => d.repo.stars },
    {
      label: "Gagnées · 24 h",
      value: (d) => (d.repo.gained.day ? `+${formatCompact(d.repo.gained.day)}` : "—"),
      best: (d) => d.repo.gained.day ?? 0,
    },
    {
      label: "Gagnées · 7 j",
      value: (d) => (d.repo.gained.week ? `+${formatCompact(d.repo.gained.week)}` : "—"),
      best: (d) => d.repo.gained.week ?? 0,
    },
    { label: "Momentum", value: (d) => `${d.repo.momentum}/100`, best: (d) => d.repo.momentum },
    { label: "Forks", value: (d) => formatCompact(d.repo.forks), best: (d) => d.repo.forks },
    {
      label: "Contributeurs",
      value: (d) => (d.contributors ? formatCompact(d.contributors) : "—"),
      best: (d) => d.contributors ?? 0,
    },
    { label: "Issues ouvertes", value: (d) => (d.openIssues !== null ? formatCompact(d.openIssues) : "—") },
    {
      label: "Commits · 1 an",
      value: (d) => (d.commits ? formatCompact(d.commits.reduce((a, b) => a + b, 0)) : "—"),
      best: (d) => (d.commits ?? []).reduce((a, b) => a + b, 0),
    },
    {
      label: "Meilleur rang Trending",
      value: (d) => (d.trendingDays.length ? `N°${Math.min(...d.trendingDays.map((t) => t.rank))}` : "—"),
    },
    { label: "Mentions", value: (d) => String(d.mentions.length), best: (d) => d.mentions.length },
    { label: "Langage", value: (d) => d.repo.language ?? "—" },
    { label: "Licence", value: (d) => d.license ?? "—" },
    { label: "Créé", value: (d) => (d.repo.createdAt ? formatDate(d.repo.createdAt) : "—") },
    {
      label: "Dernier push",
      value: (d) => (d.pushedAt && now !== null ? `il y a ${formatRelative(d.pushedAt, now)}` : "—"),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {entries.map((e) => (
          <span
            key={e.key}
            className="inline-flex h-8 min-w-0 items-center gap-2 rounded-full border border-line pr-1 pl-2.5 text-[13.5px]"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
            <span className="max-w-[180px] truncate font-medium">{e.key}</span>
            {!e.detail && !e.error && <Loader2 className="size-3.5 animate-spin text-muted" />}
            {e.error && <span className="text-[12px] text-danger">{e.error}</span>}
            <button
              type="button"
              aria-label={`Retirer ${e.key}`}
              onClick={() => setKeys(keys.filter((k) => k !== e.key))}
              className="grid size-6 place-items-center rounded-full hover:bg-hover"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {keys.length < MAX && (
          <form
            className="relative min-w-[220px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              add(input);
            }}
          >
            <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ajouter : owner/nom ou lien GitHub"
              aria-label="Ajouter un dépôt à comparer"
              className="input h-8 pl-9 text-[14px]"
            />
            {suggestions.length > 0 && (
              <div className="overlay absolute top-10 right-0 left-0 z-20 p-1">
                {suggestions.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => add(r.key)}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-hover"
                  >
                    <RepoAvatar repo={r} size={20} />
                    <span className="truncate">
                      <span className="text-muted">{r.owner}/</span>
                      <span className="font-semibold">{r.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        )}
      </div>

      {keys.length === 0 ? (
        <Empty icon={GitCompareArrows} title="Compare jusqu'à 4 dépôts">
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {repos.slice(0, 3).map((r) => (
              <button key={r.key} type="button" className="btn" onClick={() => add(r.key)}>
                + {r.name}
              </button>
            ))}
          </div>
        </Empty>
      ) : (
        <>
          {ready.length > 0 && (
            <Box className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">Étoiles</span>
                <Segmented
                  id="compare-mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "date", label: "Par date" },
                    { value: "age", label: "Depuis la création" },
                  ]}
                />
              </div>
              <CompareChart
                series={series}
                formatX={(x) =>
                  mode === "age" ? `jour ${Math.max(0, Math.round(x))}` : formatDate(new Date(x).toISOString())
                }
              />
            </Box>
          )}

          {ready.length > 0 && (
            <>
              <SectionTitle>Chiffres</SectionTitle>
              <div className="box overflow-x-auto">
                <table className="w-full min-w-[480px] text-[14px]">
                  <thead>
                    <tr className="border-b border-line-muted">
                      <th className="w-[170px] px-4 py-3 text-left font-normal text-muted" />
                      {ready.map((e) => (
                        <th key={e.key} className="px-4 py-3 text-left font-semibold">
                          <Link
                            href={repoHref(e.detail!.repo)}
                            className="inline-flex min-w-0 items-center gap-2 hover:text-accent"
                          >
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                            <span className="truncate">{e.detail!.repo.name}</span>
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-muted">
                    {rows.map((row) => {
                      const top = row.best ? Math.max(...ready.map((e) => row.best!(e.detail!))) : null;
                      return (
                        <tr key={row.label}>
                          <td className="px-4 py-2.5 text-muted">{row.label}</td>
                          {ready.map((e) => {
                            const win = top !== null && top > 0 && ready.length > 1 && row.best!(e.detail!) === top;
                            return (
                              <td
                                key={e.key}
                                className={`px-4 py-2.5 tabular-nums ${win ? "font-semibold text-success" : ""}`}
                              >
                                {row.value(e.detail!)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
