"use client";

import { Loader2, Search, SearchX, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DOMAIN_IDS, DOMAINS, type Domain } from "@/lib/domains";
import { parseRepoInput } from "@/lib/links";
import { useSettings } from "@/lib/settings";
import type { Period, RepoSummary } from "@/lib/types";
import { useApp, useOverview } from "../app-provider";
import { gainIn, repoHref, RepoRow } from "../repo-views";
import { Empty, List, Pill, PillRow, Segmented, SectionTitle } from "../ui";

type Sort = "momentum" | "stars" | "growth" | "new";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "24 h" },
  { value: "week", label: "7 j" },
  { value: "month", label: "30 j" },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "momentum", label: "Momentum" },
  { value: "stars", label: "Étoiles" },
  { value: "growth", label: "Croissance" },
  { value: "new", label: "Nouveaux" },
];

const PAGE = 30;

function matches(repo: RepoSummary, q: string): boolean {
  const text =
    `${repo.owner}/${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")} ${repo.language ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

export function ExplorerView() {
  const { repos, generatedAt } = useOverview();
  const { remember } = useApp();
  const settings = useSettings();
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [periodChoice, setPeriod] = useState<Period | null>(() =>
    ["day", "week", "month"].includes(params.get("p") ?? "") ? (params.get("p") as Period) : null,
  );
  const period = periodChoice ?? settings.period;
  const [sort, setSort] = useState<Sort>(() =>
    SORTS.some((s) => s.value === params.get("sort")) ? (params.get("sort") as Sort) : "momentum",
  );
  const [domain, setDomain] = useState<Domain | null>(() =>
    DOMAIN_IDS.includes(params.get("d") as Domain) ? (params.get("d") as Domain) : null,
  );
  const [language, setLanguage] = useState<string | null>(() => params.get("lang"));
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);

  // Keep the URL shareable without adding history entries.
  useEffect(() => {
    const next = new URLSearchParams();
    if (deferred) next.set("q", deferred);
    if (periodChoice) next.set("p", periodChoice);
    if (sort !== "momentum") next.set("sort", sort);
    if (domain) next.set("d", domain);
    if (language) next.set("lang", language);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [deferred, periodChoice, sort, domain, language]);

  const languages = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of repos) if (r.language) count.set(r.language, (count.get(r.language) ?? 0) + 1);
    return [...count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([l]) => l);
  }, [repos]);

  const results = useMemo(() => {
    const value = (r: RepoSummary) => gainIn(r, period);
    let list = repos.filter(
      (r) =>
        (!domain || r.domain === domain) &&
        (!language || r.language === language) &&
        (!deferred || matches(r, deferred)),
    );
    // "Nouveaux": created in the last 14 days, whatever their pace.
    if (sort === "new") {
      const since = new Date(generatedAt).getTime() - 14 * 86_400_000;
      list = list.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= since);
    }
    const sorted = [...list];
    if (sort === "stars" || sort === "new") sorted.sort((a, b) => value(b) - value(a));
    else if (sort === "growth") sorted.sort((a, b) => (b.growth ?? -1) - (a.growth ?? -1) || value(b) - value(a));
    else sorted.sort((a, b) => b.momentum - a.momentum);
    return sorted;
  }, [repos, generatedAt, domain, language, deferred, sort, period]);

  /* GitHub-wide search for anything outside the trending pool. */
  const [remote, setRemote] = useState<{ q: string; repos: RepoSummary[]; error?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const direct = parseRepoInput(query);

  useEffect(() => {
    const q = deferred.trim();
    if (q.length < 3 || parseRepoInput(q)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = (await res.json()) as { repos: RepoSummary[]; error?: string };
        remember(body.repos);
        setRemote({ q, repos: body.repos, error: body.error });
      } catch {
        // Aborted by a newer query.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 650);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [deferred, remember]);

  const open = (key: string) => {
    const [owner, name] = key.split("/");
    router.push(repoHref({ owner, name }));
  };

  const localKeys = new Set(results.map((r) => r.key));
  const remoteExtra = remote && remote.q === deferred.trim() ? remote.repos.filter((r) => !localKeys.has(r.key)) : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          if (direct) open(direct);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          onPaste={(e) => {
            const pasted = parseRepoInput(e.clipboardData.getData("text"));
            if (pasted) {
              e.preventDefault();
              open(pasted);
            }
          }}
          placeholder="Nom, sujet ou lien GitHub"
          aria-label="Rechercher un dépôt"
          enterKeyHint="search"
          className="input h-11 pr-24 pl-10 text-[15px]"
        />
        <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
          {searching && <Loader2 className="size-4 animate-spin text-muted" />}
          {query && (
            <button
              type="button"
              aria-label="Effacer"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="btn btn-icon border-transparent bg-transparent"
            >
              <X className="size-4" />
            </button>
          )}
          {direct && (
            <button type="submit" className="btn btn-primary">
              Ouvrir
            </button>
          )}
        </span>
      </form>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2">
          <Segmented id="period" value={period} options={PERIODS} onChange={setPeriod} />
          <Segmented id="sort" value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>

      <PillRow>
        <Pill active={domain === null} onClick={() => setDomain(null)}>
          Tous
        </Pill>
        {DOMAIN_IDS.map((d) => (
          <Pill key={d} active={domain === d} onClick={() => setDomain(domain === d ? null : d)}>
            {DOMAINS[d].label}
          </Pill>
        ))}
      </PillRow>
      <PillRow>
        {languages.map((l) => (
          <Pill key={l} active={language === l} onClick={() => setLanguage(language === l ? null : l)}>
            {l}
          </Pill>
        ))}
      </PillRow>

      {results.length === 0 && remoteExtra.length === 0 && !searching ? (
        <Empty icon={SearchX} title="Aucun dépôt">
          {remote?.error && <p className="text-[14px] text-muted">{remote.error}</p>}
        </Empty>
      ) : (
        <>
          {results.length > 0 && (
            <List>
              {results.slice(0, limit).map((repo, i) => (
                <RepoRow
                  key={repo.key}
                  repo={repo}
                  period={period}
                  rank={sort === "momentum" && !deferred ? i + 1 : undefined}
                />
              ))}
            </List>
          )}
          {results.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn mx-auto">
              Afficher plus · {results.length - limit}
            </button>
          )}
          {remoteExtra.length > 0 && (
            <section>
              <SectionTitle>Sur GitHub</SectionTitle>
              <List>
                {remoteExtra.map((repo) => (
                  <RepoRow key={repo.key} repo={repo} period={period} />
                ))}
              </List>
            </section>
          )}
        </>
      )}
    </div>
  );
}
