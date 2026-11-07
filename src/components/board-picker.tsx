"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import type { RepoSummary } from "@/lib/types";
import { useApp } from "./app-provider";
import { Sheet } from "./sheet";

export function BoardPicker({ repo, onClose }: { repo: RepoSummary | null; onClose: () => void }) {
  const { boards, toggleInBoard, createBoard } = useApp();
  const [name, setName] = useState("");

  return (
    <Sheet open={repo !== null} onClose={onClose} title="Ajouter à un tableau">
      {repo && (
        <div className="flex flex-col gap-3">
          <div className="box divide-y divide-line-muted">
            {boards.map((board) => {
              const inside = board.repos.some((r) => r.key === repo.key);
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => toggleInBoard(board.id, repo)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-hover"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: board.color }} />
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">{board.name}</span>
                  <span className="text-[12.5px] text-muted tabular-nums">{board.repos.length}</span>
                  <span
                    className={`grid size-5 place-items-center rounded-[5px] border transition-colors ${
                      inside ? "border-accent bg-accent text-white" : "border-line"
                    }`}
                  >
                    {inside && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const id = await createBoard(name.trim());
              setName("");
              if (id) toggleInBoard(id, repo);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nouveau tableau"
              maxLength={40}
              className="input"
            />
            <button type="submit" aria-label="Créer" disabled={!name.trim()} className="btn h-10 w-10 px-0">
              <Plus className="size-4" />
            </button>
          </form>
        </div>
      )}
    </Sheet>
  );
}
