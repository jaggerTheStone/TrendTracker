/**
 * Local scheduler. On a long-running server (`next dev`, `next start`, a VPS)
 * we collect sources every INGEST_INTERVAL_MINUTES. On serverless platforms
 * an external cron calls POST /api/ingest instead (see .github/workflows).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL) return;

  const { env } = await import("./server/env");
  const minutes = env().INGEST_INTERVAL_MINUTES;
  if (minutes === 0) return;

  const globalForScheduler = globalThis as unknown as { __trendtrackerScheduler?: boolean };
  if (globalForScheduler.__trendtrackerScheduler) return;
  globalForScheduler.__trendtrackerScheduler = true;

  const { runIngestion, isIngesting } = await import("./server/ingest");
  const { refreshLive } = await import("./server/live");
  const tick = () => runIngestion().catch((error) => console.error("[ingest]", error));

  setTimeout(tick, 2_000).unref();
  setInterval(tick, minutes * 60_000).unref();

  // Between two collections, star counts of what is on screen are refreshed every minute.
  const seconds = env().LIVE_INTERVAL_SECONDS;
  if (seconds > 0) {
    setInterval(() => {
      if (!isIngesting()) refreshLive().catch((error) => console.error("[live]", error));
    }, seconds * 1000).unref();
  }
  console.log(`[ingest] scheduler on, every ${minutes} min; live counts every ${seconds} s`);
}
