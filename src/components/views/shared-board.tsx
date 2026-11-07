"use client";

import { useEffect } from "react";
import type { RepoSummary } from "@/lib/types";
import { useApp } from "../app-provider";
import { RepoRow } from "../repo-views";
import { List } from "../ui";

export function SharedBoard({
  name,
  color,
  repos,
  notes,
}: {
  name: string;
  color: string;
  repos: RepoSummary[];
  notes: Record<string, string | null>;
}) {
  const { remember } = useApp();
  useEffect(() => remember(repos), [repos, remember]);
  return (
    <div className="flex min-w-0 flex-col gap-5 pt-6">
      <h1 className="flex items-center gap-3 text-[26px] font-semibold">
        <span className="size-3.5 rounded-full" style={{ background: color }} />
        <span className="truncate">{name}</span>
      </h1>
      <List>
        {repos.map((repo) => (
          <RepoRow key={repo.key} repo={repo} period="week" note={notes[repo.key]} />
        ))}
      </List>
    </div>
  );
}
