import { z } from "zod";
import { getAlertSettings, saveAlertSettings } from "@/server/alerts";
import { currentUser } from "@/server/auth";

const Body = z.object({ trending: z.boolean(), spikes: z.boolean(), weekly: z.boolean() });

export async function GET(request: Request) {
  const account = await currentUser(request.headers);
  if (!account) return Response.json({ error: "Connexion requise." }, { status: 401 });
  return Response.json(await getAlertSettings(account.id));
}

export async function PUT(request: Request) {
  const account = await currentUser(request.headers);
  if (!account) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Réglages invalides." }, { status: 400 });
  await saveAlertSettings(account.id, body.data);
  return Response.json(body.data);
}
