import { z } from "zod";
import { parseRepoInput } from "@/lib/links";
import { currentUser } from "@/server/auth";
import { removeBoardRepo, setBoardRepo } from "@/server/boards";
import { summariesFor } from "@/server/summaries";
import { resolveRepo } from "@/server/repo-detail";

const Put = z.object({ key: z.string(), note: z.string().max(500).nullable().optional() });

/** Adds a repository to a board, or updates its note. */
export async function PUT(request: Request, ctx: RouteContext<"/api/boards/[id]/repos">) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = Put.safeParse(await request.json().catch(() => null));
  const key = body.success ? parseRepoInput(body.data.key) : null;
  if (!body.success || !key) return Response.json({ error: "Dépôt invalide." }, { status: 400 });

  const [owner, name] = key.split("/");
  const repo = await resolveRepo(owner, name);
  if (!repo) return Response.json({ error: "Dépôt introuvable sur GitHub." }, { status: 404 });

  const { id } = await ctx.params;
  if (!(await setBoardRepo(user.id, id, repo.id, body.data.note))) {
    return Response.json({ error: "Tableau introuvable." }, { status: 404 });
  }
  const [summary] = await summariesFor([repo.key]);
  return Response.json({ repo: summary ?? null });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/boards/[id]/repos">) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Dépôt manquant." }, { status: 400 });
  const { id } = await ctx.params;
  if (!(await removeBoardRepo(user.id, id, key)))
    return Response.json({ error: "Tableau introuvable." }, { status: 404 });
  return Response.json({ ok: true });
}
