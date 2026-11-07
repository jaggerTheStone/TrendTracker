"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Link2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/format";
import type { Board, RepoSummary } from "@/lib/types";
import { useApp, useOverview, useRepoLookup } from "../app-provider";
import { MentionRow, repoHref, RepoAvatar, RepoRow } from "../repo-views";
import { Empty, Figure, List, ListSkeleton, SectionTitle, Stats } from "../ui";

const COLORS = ["#fd8c73", "#4493f8", "#ab7df8", "#3fb950", "#d29922", "#f778ba"];

/** Stars gained this week; today's gain is a lower bound when the weekly figure is unknown. */
const weekGain = (r: RepoSummary) => Math.max(r.gained.week ?? 0, r.gained.day ?? 0);

function SignIn() {
  const { openAuth } = useApp();
  return (
    <Empty icon={Bookmark} title="Suis tes dépôts">
      <button type="button" onClick={() => openAuth()} className="btn btn-primary mt-1">
        Se connecter
      </button>
    </Empty>
  );
}

export function BoardsView() {
  const { account, sessionPending, boards, boardsLoaded, createBoard } = useApp();
  const lookup = useRepoLookup();
  const { mentions } = useOverview();
  const [name, setName] = useState("");

  const followed = useMemo(() => {
    const keys = [...new Set(boards.flatMap((b) => b.repos.map((r) => r.key)))];
    return keys.map((k) => lookup(k)).filter((r): r is RepoSummary => Boolean(r));
  }, [boards, lookup]);

  const activity = useMemo(() => {
    const keys = new Set(followed.map((r) => r.key));
    const events = followed
      .filter((r) => r.rank !== null || (r.gained.day !== null && r.gained.day >= 20))
      .sort((a, b) => (b.gained.day ?? 0) - (a.gained.day ?? 0));
    const talk = mentions.filter((m) => m.repos.some((k) => keys.has(k))).slice(0, 8);
    return { events, talk };
  }, [followed, mentions]);

  if (!account) return sessionPending ? <ListSkeleton rows={3} /> : <SignIn />;
  if (!boardsLoaded) return <ListSkeleton rows={3} />;

  return (
    <div className="flex min-w-0 flex-col">
      <List>
        {boards.map((board) => {
          const repos = board.repos.map((r) => lookup(r.key)).filter((r): r is RepoSummary => Boolean(r));
          const gained = repos.reduce((sum, r) => sum + weekGain(r), 0);
          return (
            <Link
              key={board.id}
              href={`/suivis/${board.id}`}
              className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
            >
              <span className="size-3 shrink-0 rounded-full" style={{ background: board.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{board.name}</span>
                <span className="block text-[12.5px] text-muted">
                  {board.repos.length} dépôt{board.repos.length > 1 ? "s" : ""}
                  {gained > 0 && <span className="text-success"> · +{formatCompact(gained)} ★ 7 j</span>}
                </span>
              </span>
              <span className="hidden -space-x-1.5 sm:flex">
                {repos.slice(0, 4).map((r) => (
                  <RepoAvatar key={r.key} repo={r} size={24} />
                ))}
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </Link>
          );
        })}
        <form
          className="flex items-center gap-2 px-4 py-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createBoard(name.trim(), COLORS[boards.length % COLORS.length]);
            setName("");
          }}
        >
          <Plus className="size-4 shrink-0 text-muted" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nouveau tableau"
            maxLength={40}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-faint"
          />
          {name.trim() && (
            <button type="submit" className="btn btn-primary h-7">
              Créer
            </button>
          )}
        </form>
      </List>

      {followed.length === 0 ? (
        <div className="mt-6">
          <Empty icon={Bookmark} title="Aucun dépôt suivi">
            <Link href="/explorer" className="btn mt-1">
              Explorer
            </Link>
          </Empty>
        </div>
      ) : (
        <>
          {activity.events.length > 0 && (
            <>
              <SectionTitle>Activité</SectionTitle>
              <List>
                {activity.events.map((repo) => (
                  <Link
                    key={repo.key}
                    href={repoHref(repo)}
                    className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
                  >
                    <RepoAvatar repo={repo} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-accent">{repo.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-[13px] text-muted tabular-nums">
                      {repo.rank !== null && (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <Flame className="size-3.5" />
                          N°{repo.rank}
                        </span>
                      )}
                      {repo.gained.day !== null && repo.gained.day > 0 && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <TrendingUp className="size-3.5" />+{formatCompact(repo.gained.day)} ★
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </List>
            </>
          )}
          {activity.talk.length > 0 && (
            <>
              <SectionTitle>On en parle</SectionTitle>
              <List>
                {activity.talk.map((m) => (
                  <MentionRow key={m.id} mention={m} />
                ))}
              </List>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── One board ───────────── */

export function BoardView({ id }: { id: string }) {
  const { account, sessionPending, boards, boardsLoaded, updateBoard, deleteBoard, setNote, toggleInBoard, toast } =
    useApp();
  const lookup = useRepoLookup();
  const { mentions } = useOverview();
  const router = useRouter();
  const board = boards.find((b) => b.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const repos = useMemo(
    () =>
      board
        ? board.repos
            .map((r) => ({ entry: r, repo: lookup(r.key) }))
            .filter((x): x is { entry: Board["repos"][number]; repo: RepoSummary } => Boolean(x.repo))
        : [],
    [board, lookup],
  );

  if (!account) return sessionPending ? <ListSkeleton rows={3} /> : <SignIn />;
  if (!boardsLoaded) return <ListSkeleton rows={3} />;
  if (!board) return <Empty icon={Bookmark} title="Tableau introuvable" />;

  const keys = new Set(board.repos.map((r) => r.key));
  const talk = mentions.filter((m) => m.repos.some((k) => keys.has(k))).length;
  const week = repos.reduce((sum, { repo }) => sum + weekGain(repo), 0);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-w-0 items-center gap-2 pt-6 pb-4">
        <Link href="/suivis" aria-label="Retour" className="btn btn-icon">
          <ChevronLeft className="size-4" />
        </Link>
        {editing ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void updateBoard(board.id, { name: name.trim() });
              setEditing(false);
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="input h-8"
            />
            <button type="submit" aria-label="Valider" className="btn btn-primary btn-icon">
              <Check className="size-4" />
            </button>
          </form>
        ) : (
          <h1 className="flex min-w-0 flex-1 items-center gap-2.5 text-[22px] font-semibold">
            <span className="size-3 shrink-0 rounded-full" style={{ background: board.color }} />
            <span className="truncate">{board.name}</span>
          </h1>
        )}
        {!editing && (
          <button
            type="button"
            aria-label="Renommer"
            className="btn btn-icon"
            onClick={() => {
              setName(board.name);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={board.shareId ? "Copier le lien public" : "Partager"}
          className={`btn ${board.shareId ? "border-accent/50 text-accent" : ""}`}
          onClick={async () => {
            if (!board.shareId) {
              await updateBoard(board.id, { shared: true });
              toast("Lien public activé");
              return;
            }
            await navigator.clipboard?.writeText(`${window.location.origin}/b/${board.shareId}`).catch(() => {});
            toast("Lien copié", { label: "Désactiver", run: () => void updateBoard(board.id, { shared: false }) });
          }}
        >
          <Link2 className="size-4" />
          <span className="hidden sm:inline">{board.shareId ? "Copier le lien" : "Partager"}</span>
        </button>
        <button
          type="button"
          aria-label="Supprimer"
          className="btn btn-icon text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label="Couleur"
            onClick={() => void updateBoard(board.id, { color: c })}
            className={`size-6 rounded-full transition-transform ${board.color === c ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-canvas" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>

      <Stats
        items={[
          { label: "Dépôts", value: board.repos.length },
          { label: "Étoiles · 7 j", value: <Figure value={week} prefix="+" /> },
          { label: "Mentions · 14 j", value: talk },
        ]}
      />

      {repos.length === 0 ? (
        <div className="mt-6">
          <Empty icon={Bookmark} title="Tableau vide">
            <Link href="/explorer" className="btn mt-1">
              Explorer
            </Link>
          </Empty>
        </div>
      ) : (
        <>
          <SectionTitle>Dépôts</SectionTitle>
          <List>
            {repos.map(({ entry, repo }) => (
              <div key={repo.key} className="min-w-0">
                <RepoRow repo={repo} period="week" note={entry.note} />
                <div className="flex gap-3 px-4 pb-3 pl-[68px] text-[12.5px] font-medium">
                  <button
                    type="button"
                    onClick={() => setNoteFor(noteFor === repo.key ? null : repo.key)}
                    className="text-accent hover:underline"
                  >
                    {entry.note ? "Modifier la note" : "Ajouter une note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleInBoard(board.id, repo)}
                    className="text-muted hover:text-danger"
                  >
                    Retirer
                  </button>
                </div>
                <AnimatePresence>
                  {noteFor === repo.key && (
                    <motion.form
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-4 sm:pl-[68px]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const value = new FormData(e.currentTarget).get("note");
                        setNote(board.id, repo.key, String(value ?? "").trim());
                        setNoteFor(null);
                      }}
                    >
                      <div className="mb-3 flex items-end gap-2">
                        <textarea
                          name="note"
                          autoFocus
                          defaultValue={entry.note ?? ""}
                          maxLength={500}
                          rows={2}
                          placeholder="Pourquoi le suivre ?"
                          className="input h-auto resize-none py-2 text-[14px]"
                        />
                        <button type="submit" className="btn btn-primary">
                          Enregistrer
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </List>
        </>
      )}

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="overlay fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-[420px] items-center gap-2 p-2.5 pl-4 md:bottom-6"
          >
            <span className="min-w-0 flex-1 truncate text-[14px]">Supprimer « {board.name} » ?</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn">
              Annuler
            </button>
            <button
              type="button"
              onClick={async () => {
                await deleteBoard(board.id);
                router.push("/suivis");
              }}
              className="btn border-danger bg-danger text-white hover:bg-danger"
            >
              Supprimer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
