import { z } from "zod";
import { currentUser } from "@/server/auth";
import { BOARD_COLORS, createBoard } from "@/server/boards";

const Body = z.object({ name: z.string().trim().min(1).max(40), color: z.string().optional() });

export async function POST(request: Request) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Nom invalide." }, { status: 400 });
  const color = body.data.color && BOARD_COLORS.includes(body.data.color) ? body.data.color : BOARD_COLORS[1];
  const id = await createBoard(user.id, body.data.name, color);
  return Response.json({ id, color });
}
