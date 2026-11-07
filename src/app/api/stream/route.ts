import { connection } from "next/server";
import { getLatestBuild, getOverview } from "@/server/overview";

export const maxDuration = 300;

const POLL_MS = 5_000;
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events: pushes a fresh overview whenever a collection finishes.
 * Change detection reads the database, so it works across server instances.
 * EventSource reconnects on its own when the platform closes the stream.
 */
export async function GET(request: Request) {
  await connection();
  const encoder = new TextEncoder();
  let lastBuild: string | null = null;
  let timers: ReturnType<typeof setInterval>[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed by the client.
        }
      };

      const push = async () => {
        try {
          const build = await getLatestBuild();
          if (build === lastBuild) return;
          lastBuild = build;
          send(`event: overview\ndata: ${JSON.stringify(await getOverview())}\n\n`);
        } catch (error) {
          console.error("[stream]", error);
        }
      };

      send("retry: 5000\n\n");
      await push();
      timers = [setInterval(push, POLL_MS), setInterval(() => send(": ping\n\n"), HEARTBEAT_MS)];

      request.signal.addEventListener("abort", () => {
        timers.forEach(clearInterval);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      timers.forEach(clearInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
