import { connection } from "next/server";
import { RateLimitedError } from "@/server/github/api";
import { getRepoDetail } from "@/server/repo-detail";

/** Repository details without the README, for the comparison page. */
export async function GET(_request: Request, ctx: RouteContext<"/api/repo/[owner]/[name]">) {
  await connection();
  const { owner, name } = await ctx.params;
  try {
    const detail = await getRepoDetail(owner, name);
    if (!detail) return Response.json({ error: "Dépôt introuvable." }, { status: 404 });
    return Response.json({ ...detail, readmeHtml: null });
  } catch (error) {
    if (error instanceof RateLimitedError) return Response.json({ error: "Quota GitHub atteint." }, { status: 429 });
    throw error;
  }
}
