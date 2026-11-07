import { z } from "zod";
import { currentUser } from "@/server/auth";
import { BOARD_COLORS, deleteBoard, listBoards, updateBoard } from "@/server/boards";

const Patch = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: z
    .string()
    .refine((c) => BOARD_COLORS.includes(c))
    .optional(),
  shared: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = Patch.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Modification invalide." }, { status: 400 });
  const { id } = await ctx.params;
  if (!(await updateBoard(user.id, id, body.data)))
    return Response.json({ error: "Tableau introuvable." }, { status: 404 });
  const board = (await listBoards(user.id)).find((b) => b.id === id);
  return Response.json({ board });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await deleteBoard(user.id, id))) return Response.json({ error: "Tableau introuvable." }, { status: 404 });
  return Response.json({ ok: true });
}
