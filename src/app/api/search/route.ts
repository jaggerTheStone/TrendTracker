import { connection } from "next/server";
import { parseRepoInput } from "@/lib/links";
import { summariesFor } from "@/server/summaries";
import { getDb } from "@/server/db/client";
import { RateLimitedError, searchRepos } from "@/server/github/api";
import { resolveRepo } from "@/server/repo-detail";
import { mergeObservations, upsertRepos } from "@/server/repos";
import { fromApi } from "@/server/sources/types";

/** GitHub-wide search: a link or "owner/name" opens that repository, anything else searches by name and description. */
export async function GET(request: Request) {
  await connection();
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ repos: [] });

  try {
    const direct = parseRepoInput(q);
    if (direct) {
      const [owner, name] = direct.split("/");
      const row = await resolveRepo(owner, name);
      return Response.json({ repos: row ? await summariesFor([row.key]) : [] });
    }

    const items = await searchRepos(`${q} in:name,description,topics fork:false`, AbortSignal.timeout(10_000), 15);
    const merged = mergeObservations(items.map(fromApi));
    // Search results are not "seen" in the wild: they must not enter the trending pool.
    await upsertRepos(await getDb(), merged, new Date(), new Date(0));
    return Response.json({ repos: await summariesFor([...merged.keys()]) });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return Response.json({ repos: [], error: "Recherche GitHub en pause une minute (quota)." }, { status: 429 });
    }
    console.error("[search]", error);
    return Response.json({ repos: [], error: "Recherche indisponible." }, { status: 502 });
  }
}
