import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import type { Board } from "@/lib/types";
import { getDb } from "./db/client";
import { boardRepos, boards, repos } from "./db/schema";
import { summariesFor } from "./summaries";

export const BOARD_COLORS = ["#ff8a4c", "#5ac8fa", "#a78bfa", "#34c759", "#ffd60a", "#ff6482"];

const newId = (bytes = 9) => randomBytes(bytes).toString("base64url");

export async function listBoards(userId: string): Promise<Board[]> {
  const db = await getDb();
  let rows = await db
    .select()
    .from(boards)
    .where(eq(boards.userId, userId))
    .orderBy(asc(boards.position), asc(boards.createdAt));
  if (rows.length === 0) {
    // Everyone starts with one board, so "follow" is a single tap.
    await db.insert(boards).values({ id: newId(), userId, name: "Mes suivis", color: BOARD_COLORS[0], position: 0 });
    rows = await db.select().from(boards).where(eq(boards.userId, userId));
  }
  const items = await db
    .select({ boardId: boardRepos.boardId, key: repos.key, note: boardRepos.note, addedAt: boardRepos.addedAt })
    .from(boardRepos)
    .innerJoin(repos, eq(repos.id, boardRepos.repoId))
    .where(
      inArray(
        boardRepos.boardId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(boardRepos.addedAt));
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    shareId: b.shareId,
    repos: items
      .filter((i) => i.boardId === b.id)
      .map((i) => ({ key: i.key, note: i.note, addedAt: i.addedAt.toISOString() })),
  }));
}

async function ownBoard(userId: string, boardId: string) {
  const db = await getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);
  return board ?? null;
}

export async function createBoard(userId: string, name: string, color: string) {
  const db = await getDb();
  const [{ position }] = await db
    .select({ position: max(boards.position) })
    .from(boards)
    .where(eq(boards.userId, userId));
  const id = newId();
  await db.insert(boards).values({ id, userId, name, color, position: (position ?? 0) + 1 });
  return id;
}

export async function updateBoard(
  userId: string,
  boardId: string,
  patch: { name?: string; color?: string; shared?: boolean },
): Promise<boolean> {
  const board = await ownBoard(userId, boardId);
  if (!board) return false;
  const db = await getDb();
  await db
    .update(boards)
    .set({
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.shared === undefined ? {} : { shareId: patch.shared ? (board.shareId ?? newId(12)) : null }),
    })
    .where(eq(boards.id, boardId));
  return true;
}

export async function deleteBoard(userId: string, boardId: string): Promise<boolean> {
  const db = await getDb();
  const deleted = await db
    .delete(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .returning({ id: boards.id });
  return deleted.length > 0;
}

export async function setBoardRepo(userId: string, boardId: string, repoId: number, note?: string | null) {
  if (!(await ownBoard(userId, boardId))) return false;
  const db = await getDb();
  await db
    .insert(boardRepos)
    .values({ boardId, repoId, note: note ?? null })
    .onConflictDoUpdate({
      target: [boardRepos.boardId, boardRepos.repoId],
      set: note === undefined ? { boardId } : { note },
    });
  return true;
}

export async function removeBoardRepo(userId: string, boardId: string, key: string) {
  if (!(await ownBoard(userId, boardId))) return false;
  const db = await getDb();
  const [repo] = await db.select({ id: repos.id }).from(repos).where(eq(repos.key, key.toLowerCase())).limit(1);
  if (!repo) return true;
  await db.delete(boardRepos).where(and(eq(boardRepos.boardId, boardId), eq(boardRepos.repoId, repo.id)));
  return true;
}

export async function getSharedBoard(shareId: string) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(eq(boards.shareId, shareId)).limit(1);
  if (!board) return null;
  const items = await db
    .select({ key: repos.key, note: boardRepos.note })
    .from(boardRepos)
    .innerJoin(repos, eq(repos.id, boardRepos.repoId))
    .where(eq(boardRepos.boardId, board.id))
    .orderBy(asc(boardRepos.addedAt));
  const summaries = await summariesFor(items.map((i) => i.key));
  return {
    name: board.name,
    color: board.color,
    repos: summaries,
    notes: Object.fromEntries(items.map((i) => [i.key, i.note])),
  };
}
