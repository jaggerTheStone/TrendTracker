import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { runIngestion } from "@/server/ingest";
import { refreshLive } from "@/server/live";

export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  // ?live: only refresh the star counts of what is on screen (cheap, for a one-minute cron).
  if (params.has("live")) return Response.json({ live: await refreshLive() });
  const result = await runIngestion({ force: params.has("force") });
  return Response.json(result);
}

/** Called by the scheduler (GitHub Actions, Vercel Cron) with `Authorization: Bearer $CRON_SECRET`. */
export const POST = handle;
export const GET = handle;
