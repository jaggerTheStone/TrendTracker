"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import type { Board, Overview, RepoSummary } from "@/lib/types";
import { AuthSheet } from "./auth-sheet";
import { BoardPicker } from "./board-picker";

export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface AppContextValue {
  overviewPromise: Promise<Overview>;
  latest: Overview | null;
  extra: Map<string, RepoSummary>;
  live: boolean;
  remember: (repos: RepoSummary[]) => void;

  account: Account | null;
  sessionPending: boolean;
  boards: Board[];
  boardsLoaded: boolean;
  isFollowed: (key: string) => boolean;
  follow: (repo: RepoSummary) => void;
  unfollow: (key: string) => void;
  toggleInBoard: (boardId: string, repo: RepoSummary) => void;
  createBoard: (name: string, color?: string) => Promise<string | null>;
  updateBoard: (id: string, patch: { name?: string; color?: string; shared?: boolean }) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  setNote: (boardId: string, key: string, note: string) => void;
  signOut: () => Promise<void>;

  openAuth: (then?: () => void) => void;
  openBoardPicker: (repo: RepoSummary) => void;
  toast: (message: string, action?: Toast["action"]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

/** The latest overview. Suspends until the first one arrives: call it under a Suspense boundary. */
export function useOverview(): Overview {
  const { overviewPromise, latest } = useApp();
  const initial = use(overviewPromise);
  return latest ?? initial;
}

/** Finds a repository summary by key among everything the client has seen. */
export function useRepoLookup(): (key: string) => RepoSummary | undefined {
  const overview = useOverview();
  const { extra } = useApp();
  const index = useMemo(() => {
    const map = new Map(extra);
    for (const r of overview.repos) map.set(r.key, r);
    return map;
  }, [overview, extra]);
  return useCallback((key: string) => index.get(key.toLowerCase()), [index]);
}

/* ───────────── Clock ───────────── */

const clocks = new Map<number, { subscribe: (cb: () => void) => () => void; snapshot: () => number }>();
function clockFor(step: number) {
  let clock = clocks.get(step);
  if (!clock) {
    clock = {
      subscribe(callback) {
        const timer = setInterval(callback, step);
        return () => clearInterval(timer);
      },
      snapshot: () => Math.floor(Date.now() / step) * step,
    };
    clocks.set(step, clock);
  }
  return clock;
}
const serverNow = () => null;

/**
 * Current time, ticking every `step` ms (30 s by default, 1 s for "il y a 12 s" readouts).
 * Null during server render and hydration so relative dates never mismatch.
 */
export function useNow(step = 30_000): number | null {
  const clock = clockFor(step);
  return useSyncExternalStore(clock.subscribe, clock.snapshot, serverNow);
}

/* ───────────── Provider ───────────── */

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body;
}

export function AppProvider({
  overviewPromise,
  children,
}: {
  overviewPromise: Promise<Overview>;
  children: ReactNode;
}) {
  const [latest, setLatest] = useState<Overview | null>(null);
  const [live, setLive] = useState(false);
  const [extra, setExtra] = useState<Map<string, RepoSummary>>(() => new Map());

  /* Live updates */
  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("overview", (event) => {
      setLatest(JSON.parse((event as MessageEvent).data) as Overview);
    });
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  const remember = useCallback((repos: RepoSummary[]) => {
    if (repos.length === 0) return;
    setExtra((prev) => {
      const next = new Map(prev);
      for (const r of repos) if (!next.has(r.key)) next.set(r.key, r);
      return next;
    });
  }, []);

  /* Toasts */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((message: string, action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, message, action }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 5000 : 2800);
  }, []);

  /* Account and boards */
  const session = authClient.useSession();
  const sessionUser = session.data?.user ?? null;
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsFor, setBoardsFor] = useState<string | null>(null);
  const afterAuth = useRef<(() => void) | null>(null);

  const loadMe = useCallback(async () => {
    const me = await api<{ user: Account | null; boards: Board[]; repos: RepoSummary[] }>("/api/me");
    setBoards(me.boards);
    setBoardsFor(me.user?.id ?? null);
    remember(me.repos);
  }, [remember]);

  const userId = sessionUser?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api<{ user: Account | null; boards: Board[]; repos: RepoSummary[] }>("/api/me")
      .then((me) => {
        if (cancelled) return;
        setBoards(me.boards);
        setBoardsFor(me.user?.id ?? null);
        remember(me.repos);
        const pending = afterAuth.current;
        afterAuth.current = null;
        pending?.();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, remember]);

  const account = useMemo<Account | null>(
    () =>
      sessionUser
        ? { id: sessionUser.id, name: sessionUser.name, email: sessionUser.email, image: sessionUser.image ?? null }
        : null,
    [sessionUser],
  );
  const visibleBoards = useMemo(
    () => (account && boardsFor === account.id ? boards : []),
    [account, boardsFor, boards],
  );
  const followed = useMemo(() => new Set(visibleBoards.flatMap((b) => b.repos.map((r) => r.key))), [visibleBoards]);

  const [authOpen, setAuthOpen] = useState(false);
  const [pickerRepo, setPickerRepo] = useState<RepoSummary | null>(null);

  const openAuth = useCallback((then?: () => void) => {
    afterAuth.current = then ?? null;
    setAuthOpen(true);
  }, []);

  const mutateBoard = useCallback((boardId: string, update: (board: Board) => Board) => {
    setBoards((list) => list.map((b) => (b.id === boardId ? update(b) : b)));
  }, []);

  const addTo = useCallback(
    (boardId: string, repo: RepoSummary) => {
      remember([repo]);
      mutateBoard(boardId, (b) =>
        b.repos.some((r) => r.key === repo.key)
          ? b
          : { ...b, repos: [...b.repos, { key: repo.key, note: null, addedAt: new Date().toISOString() }] },
      );
      api(`/api/boards/${boardId}/repos`, { method: "PUT", body: JSON.stringify({ key: repo.key }) }).catch(
        (e: Error) => {
          toast(e.message);
          void loadMe();
        },
      );
    },
    [mutateBoard, remember, toast, loadMe],
  );

  const removeFrom = useCallback(
    (boardId: string, key: string) => {
      mutateBoard(boardId, (b) => ({ ...b, repos: b.repos.filter((r) => r.key !== key) }));
      api(`/api/boards/${boardId}/repos?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch((e: Error) => {
        toast(e.message);
        void loadMe();
      });
    },
    [mutateBoard, toast, loadMe],
  );

  const followRef = useRef<(repo: RepoSummary) => void>(() => {});
  const follow = useCallback(
    (repo: RepoSummary) => {
      if (!sessionUser) {
        openAuth(() => followRef.current(repo));
        return;
      }
      const target = visibleBoards[0];
      if (!target) return;
      addTo(target.id, repo);
      toast(`Ajouté à ${target.name}`, { label: "Changer", run: () => setPickerRepo(repo) });
    },
    [sessionUser, visibleBoards, addTo, toast, openAuth],
  );
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  const unfollow = useCallback(
    (key: string) => {
      for (const b of visibleBoards) if (b.repos.some((r) => r.key === key)) removeFrom(b.id, key);
      toast("Retiré des suivis");
    },
    [visibleBoards, removeFrom, toast],
  );

  const toggleInBoard = useCallback(
    (boardId: string, repo: RepoSummary) => {
      const board = visibleBoards.find((b) => b.id === boardId);
      if (!board) return;
      if (board.repos.some((r) => r.key === repo.key)) removeFrom(boardId, repo.key);
      else addTo(boardId, repo);
    },
    [visibleBoards, addTo, removeFrom],
  );

  const createBoard = useCallback(
    async (name: string, color?: string) => {
      try {
        const { id, color: c } = await api<{ id: string; color: string }>("/api/boards", {
          method: "POST",
          body: JSON.stringify({ name, color }),
        });
        setBoards((list) => [...list, { id, name, color: c, shareId: null, repos: [] }]);
        return id;
      } catch (e) {
        toast((e as Error).message);
        return null;
      }
    },
    [toast],
  );

  const updateBoard = useCallback(
    async (id: string, patch: { name?: string; color?: string; shared?: boolean }) => {
      mutateBoard(id, (b) => ({
        ...b,
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.color ? { color: patch.color } : {}),
      }));
      try {
        const { board } = await api<{ board: Board }>(`/api/boards/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        if (board) mutateBoard(id, () => board);
      } catch (e) {
        toast((e as Error).message);
      }
    },
    [mutateBoard, toast],
  );

  const deleteBoard = useCallback(
    async (id: string) => {
      setBoards((list) => list.filter((b) => b.id !== id));
      await api(`/api/boards/${id}`, { method: "DELETE" }).catch((e: Error) => toast(e.message));
    },
    [toast],
  );

  const setNote = useCallback(
    (boardId: string, key: string, note: string) => {
      mutateBoard(boardId, (b) => ({
        ...b,
        repos: b.repos.map((r) => (r.key === key ? { ...r, note: note || null } : r)),
      }));
      api(`/api/boards/${boardId}/repos`, { method: "PUT", body: JSON.stringify({ key, note: note || null }) }).catch(
        (e: Error) => toast(e.message),
      );
    },
    [mutateBoard, toast],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setBoards([]);
    setBoardsFor(null);
    toast("Déconnecté");
  }, [toast]);

  const value: AppContextValue = {
    overviewPromise,
    latest,
    extra,
    live,
    remember,
    account,
    sessionPending: session.isPending,
    boards: visibleBoards,
    boardsLoaded: Boolean(account && boardsFor === account.id),
    isFollowed: (key) => followed.has(key),
    follow,
    unfollow,
    toggleInBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    setNote,
    signOut,
    openAuth,
    openBoardPicker: (r) => (sessionUser ? setPickerRepo(r) : openAuth(() => setPickerRepo(r))),
    toast,
  };

  return (
    <AppContext value={value}>
      {children}
      <Suspense fallback={null}>
        <AuthSheetWithFeatures
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => {
            setAuthOpen(false);
            toast("Connecté");
            void session.refetch();
          }}
        />
      </Suspense>
      <BoardPicker repo={pickerRepo} onClose={() => setPickerRepo(null)} />
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="overlay pointer-events-auto flex max-w-full items-center gap-3 py-2 pr-2 pl-4 text-[14px]"
            >
              <span className="min-w-0 truncate">{t.message}</span>
              {t.action ? (
                <button type="button" onClick={t.action.run} className="btn h-7 px-2.5 text-[13px]">
                  {t.action.label}
                </button>
              ) : (
                <span className="w-1" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext>
  );
}

function AuthSheetWithFeatures(props: { open: boolean; onClose: () => void; onSignedIn: () => void }) {
  const { features } = useOverview();
  return <AuthSheet {...props} features={features} />;
}
