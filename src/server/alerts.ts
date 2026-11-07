import { and, eq, inArray, or } from "drizzle-orm";
import { formatCompact } from "@/lib/format";
import type { RepoSummary } from "@/lib/types";
import { getDb } from "./db/client";
import { alertLog, alertPrefs, boardRepos, boards, repos, trendingDays, user } from "./db/schema";
import { env } from "./env";
import { sendMail } from "./mail";
import { getOverview } from "./overview";
import { summariesFor } from "./summaries";

export interface AlertSettings {
  trending: boolean;
  spikes: boolean;
  weekly: boolean;
}

const OFF: AlertSettings = { trending: false, spikes: false, weekly: false };

export async function getAlertSettings(userId: string): Promise<AlertSettings> {
  const db = await getDb();
  const [row] = await db.select().from(alertPrefs).where(eq(alertPrefs.userId, userId)).limit(1);
  return row ? { trending: row.trending, spikes: row.spikes, weekly: row.weekly } : OFF;
}

export async function saveAlertSettings(userId: string, settings: AlertSettings) {
  const db = await getDb();
  await db
    .insert(alertPrefs)
    .values({ userId, ...settings })
    .onConflictDoUpdate({ target: alertPrefs.userId, set: settings });
}

const appUrl = () => env().BETTER_AUTH_URL ?? "http://localhost:3000";

/** A followed repository gains at least three times more stars than on its usual days. */
const isSpike = (r: RepoSummary) => r.gained.day !== null && r.gained.day >= 50 && (r.acceleration ?? 0) >= 3;

function layout(title: string, rows: string, footer: string) {
  return `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2328">
<p style="font-size:18px;font-weight:600;margin:0 0 16px">${title}</p>
<table style="width:100%;border-collapse:collapse;border:1px solid #d1d9e0;border-radius:8px">${rows}</table>
<p style="font-size:12px;color:#59636e;margin:16px 0 0">${footer}</p>
</div>`;
}

function row(repo: RepoSummary, detail: string) {
  const href = `${appUrl()}/r/${repo.owner}/${repo.name}`;
  return `<tr><td style="padding:10px 12px;border-bottom:1px solid #d1d9e0"><a href="${href}" style="color:#0969da;font-weight:600;text-decoration:none">${repo.owner}/${repo.name}</a><div style="font-size:13px;color:#59636e">${detail}</div></td></tr>`;
}

const FOOTER =
  "Tu reçois cet e-mail car tu as activé les alertes dans TrendTracker (menu du compte, en haut à droite).";

/**
 * Runs after each collection: e-mails each opted-in user about their followed repositories
 * entering Trending or spiking, at most once per repository, kind and day; and a weekly summary.
 */
export async function runAlerts(): Promise<number> {
  const db = await getDb();
  const prefs = await db
    .select({
      userId: alertPrefs.userId,
      email: user.email,
      trending: alertPrefs.trending,
      spikes: alertPrefs.spikes,
      weekly: alertPrefs.weekly,
      lastWeeklyAt: alertPrefs.lastWeeklyAt,
    })
    .from(alertPrefs)
    .innerJoin(user, eq(user.id, alertPrefs.userId))
    .where(or(eq(alertPrefs.trending, true), eq(alertPrefs.spikes, true), eq(alertPrefs.weekly, true)));
  if (prefs.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;

  for (const p of prefs) {
    const followed = await db
      .selectDistinct({ repoId: repos.id, key: repos.key })
      .from(boardRepos)
      .innerJoin(boards, eq(boards.id, boardRepos.boardId))
      .innerJoin(repos, eq(repos.id, boardRepos.repoId))
      .where(eq(boards.userId, p.userId));
    if (followed.length === 0) continue;

    const ids = followed.map((f) => f.repoId);
    const idByKey = new Map(followed.map((f) => [f.key, f.repoId]));
    const summaries = await summariesFor(followed.map((f) => f.key));
    const done = new Set(
      (
        await db
          .select({ repoId: alertLog.repoId, kind: alertLog.kind })
          .from(alertLog)
          .where(and(eq(alertLog.userId, p.userId), eq(alertLog.day, today), inArray(alertLog.repoId, ids)))
      ).map((l) => `${l.repoId}:${l.kind}`),
    );

    const events: { repo: RepoSummary; kind: "trending" | "spike"; detail: string }[] = [];
    if (p.trending) {
      const ranked = await db
        .select({ repoId: trendingDays.repoId, rank: trendingDays.rank, gained: trendingDays.gained })
        .from(trendingDays)
        .where(and(eq(trendingDays.day, today), inArray(trendingDays.repoId, ids)));
      for (const r of ranked) {
        const repo = summaries.find((s) => idByKey.get(s.key) === r.repoId);
        if (repo && !done.has(`${r.repoId}:trending`)) {
          events.push({
            repo,
            kind: "trending",
            detail: `N°${r.rank} sur GitHub Trending · +${formatCompact(r.gained)} ★ aujourd'hui`,
          });
        }
      }
    }
    if (p.spikes) {
      for (const repo of summaries.filter(isSpike)) {
        if (!done.has(`${idByKey.get(repo.key)}:spike`) && !events.some((e) => e.repo.key === repo.key)) {
          events.push({
            repo,
            kind: "spike",
            detail: `+${formatCompact(repo.gained.day!)} ★ en 24 h, ×${(repo.acceleration ?? 0).toFixed(1)} par rapport à ses jours habituels`,
          });
        }
      }
    }

    if (events.length > 0) {
      const subject =
        events.length === 1 ? `${events[0].repo.name} décolle` : `${events.length} de tes dépôts suivis décollent`;
      const delivered = await sendMail({
        to: p.email,
        subject,
        text: events.map((e) => `${e.repo.owner}/${e.repo.name} : ${e.detail}`).join("\n") + `\n\n${appUrl()}/suivis`,
        html: layout(subject, events.map((e) => row(e.repo, e.detail)).join(""), FOOTER),
      }).catch((error: unknown) => {
        console.error("[alerts]", error);
        return false;
      });
      if (delivered) {
        sent += 1;
        await db
          .insert(alertLog)
          .values(events.map((e) => ({ userId: p.userId, repoId: idByKey.get(e.repo.key)!, kind: e.kind, day: today })))
          .onConflictDoNothing();
      }
    }

    const weekAgo = Date.now() - 7 * 86_400_000;
    if (p.weekly && (!p.lastWeeklyAt || p.lastWeeklyAt.getTime() < weekAgo)) {
      const movers = [...summaries].sort((a, b) => (b.gained.week ?? 0) - (a.gained.week ?? 0)).slice(0, 10);
      const global = (await getOverview()).repos.filter((r) => !idByKey.has(r.key)).slice(0, 5);
      const html = layout(
        "Ta semaine sur TrendTracker",
        movers
          .map((r) =>
            row(r, r.gained.week ? `+${formatCompact(r.gained.week)} ★ cette semaine` : `${formatCompact(r.stars)} ★`),
          )
          .join("") +
          `<tr><td style="padding:10px 12px;background:#f6f8fa;font-size:13px;font-weight:600">À découvrir</td></tr>` +
          global.map((r) => row(r, r.description ?? "")).join(""),
        FOOTER,
      );
      const delivered = await sendMail({
        to: p.email,
        subject: "Ta semaine sur TrendTracker",
        text: movers.map((r) => `${r.owner}/${r.name} : +${r.gained.week ?? 0} ★`).join("\n"),
        html,
      }).catch(() => false);
      if (delivered) {
        sent += 1;
        await db.update(alertPrefs).set({ lastWeeklyAt: new Date() }).where(eq(alertPrefs.userId, p.userId));
      }
    }
  }
  return sent;
}
