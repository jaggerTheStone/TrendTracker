import Anthropic from "@anthropic-ai/sdk";
import { parseRepoInput } from "@/lib/links";
import { analystEnabled, analyzeRepo } from "@/server/analyst";
import { getRepoDetail } from "@/server/repo-detail";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!analystEnabled()) {
    return Response.json({ error: "Analyse IA désactivée : ajoute ANTHROPIC_API_KEY." }, { status: 501 });
  }
  const { key } = (await request.json().catch(() => ({}))) as { key?: unknown };
  const parsed = typeof key === "string" ? parseRepoInput(key) : null;
  if (!parsed) return Response.json({ error: "Dépôt manquant." }, { status: 400 });

  const [owner, name] = parsed.split("/");
  const detail = await getRepoDetail(owner, name);
  if (!detail) return Response.json({ error: "Dépôt introuvable." }, { status: 404 });

  try {
    return Response.json(await analyzeRepo(detail));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Trop de demandes, réessaie dans une minute." }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Clé Anthropic invalide." }, { status: 502 });
    }
    console.error("[analyze]", error);
    return Response.json({ error: "Analyse indisponible." }, { status: 502 });
  }
}
