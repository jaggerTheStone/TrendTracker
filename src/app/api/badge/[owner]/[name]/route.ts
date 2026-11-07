import { and, eq, min } from "drizzle-orm";
import { connection } from "next/server";
import { formatCompact } from "@/lib/format";
import { getDb } from "@/server/db/client";
import { repos, trendingDays } from "@/server/db/schema";
import { summariesFor } from "@/server/summaries";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Rough width of 11px Verdana-like text, enough for a badge. */
const textWidth = (s: string) =>
  Math.round([...s].reduce((w, c) => w + (/[ilj.,:'|!]/.test(c) ? 3.6 : /[A-Z°★+]/.test(c) ? 7.6 : 6.6), 0));

function badge(label: string, value: string, color: string) {
  const lw = textWidth(label) + 30;
  const vw = textWidth(value) + 16;
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22" role="img" aria-label="${escape(label)}: ${escape(value)}">
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".12"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="22" rx="5"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="22" fill="#24292f"/><rect x="${lw}" width="${vw}" height="22" fill="${color}"/><rect width="${w}" height="22" fill="url(#s)"/></g>
<g transform="translate(7 4) scale(.028)"><path fill="#3fb950" d="M496 278.2c0 31.9-3.2 65.7-17.5 95-37.9 76.6-142.1 74.8-216.7 74.8-75.8 0-186.2 2.7-225.6-74.8-14.6-29-20.2-63.1-20.2-95 0-41.9 13.9-81.5 41.5-113.6-5.2-15.8-7.7-32.4-7.7-48.8 0-21.5 4.9-32.3 14.6-51.8 45.3 0 74.3 9 108.8 36 29-6.9 58.8-10 88.7-10 27 0 54.2 2.9 80.4 9.2 34-26.7 63-35.2 107.8-35.2 9.8 19.5 14.6 30.3 14.6 51.8 0 16.4-2.6 32.7-7.7 48.2 27.5 32.4 39 72.3 39 114.2z"/></g>
<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="25" y="15">${escape(label)}</text><text x="${lw + 8}" y="15" font-weight="bold">${escape(value)}</text></g>
</svg>`;
}

/** README badge: best Trending rank, else stars gained this week, else total stars. */
export async function GET(_request: Request, ctx: RouteContext<"/api/badge/[owner]/[name]">) {
  await connection();
  const { owner, name } = await ctx.params;
  const key = `${owner}/${name.replace(/\.svg$/, "")}`.toLowerCase();
  const db = await getDb();
  const [row] = await db
    .select({ best: min(trendingDays.rank) })
    .from(trendingDays)
    .innerJoin(repos, eq(repos.id, trendingDays.repoId))
    .where(and(eq(repos.key, key)));
  const [summary] = await summariesFor([key]);

  let value = "non suivi";
  let color = "#6e7781";
  if (row?.best) {
    value = `N°${row.best} du Trending`;
    color = row.best === 1 ? "#bf8700" : "#1f883d";
  } else if (summary?.gained.week) {
    value = `+${formatCompact(summary.gained.week)} ★ cette semaine`;
    color = "#1f883d";
  } else if (summary) {
    value = `${formatCompact(summary.stars)} ★`;
    color = "#0969da";
  }
  return new Response(badge("TrendTracker", value, color), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
