import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatCompact } from "@/lib/format";
import type { Analysis, RepoDetail } from "@/lib/types";
import { getDb } from "./db/client";
import { analyses, repos } from "./db/schema";
import { stripHtml } from "./sources/types";

const AnalysisSchema = z.object({
  pitch: z.string().describe("Ce que fait le dépôt, en une phrase de 20 mots maximum."),
  why: z.string().describe("Pourquoi il attire l'attention maintenant, en une ou deux phrases courtes."),
  audience: z.string().describe("Pour qui c'est utile, en quelques mots."),
  alternatives: z.array(z.string()).max(3).describe("Jusqu'à trois projets comparables (noms courts)."),
  verdict: z
    .enum(["essayer", "surveiller", "passer"])
    .describe("essayer : mûr et utile ; surveiller : prometteur mais jeune ; passer : effet de mode ou trop risqué."),
});

const SYSTEM = `Tu es un développeur senior qui fait de la veille GitHub. On te donne un dépôt, ses chiffres et le début de son README.
Réponds en français, très brièvement, sans jargon marketing. Appuie-toi sur les éléments fournis ; si une information manque, ne l'invente pas.`;

/** True when an Anthropic credential is configured: the analyst is optional. */
export function analystEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const TTL_MS = 24 * 60 * 60_000;

/** Short verdict on a repository, cached a day in the database. */
export async function analyzeRepo(detail: RepoDetail): Promise<Analysis> {
  const db = await getDb();
  const [row] = await db.select({ id: repos.id }).from(repos).where(eq(repos.key, detail.repo.key)).limit(1);
  if (row) {
    const [cached] = await db.select().from(analyses).where(eq(analyses.repoId, row.id)).limit(1);
    if (cached && Date.now() - cached.createdAt.getTime() < TTL_MS) return cached.payload as Analysis;
  }

  const { repo } = detail;
  const readme = detail.readmeHtml ? stripHtml(detail.readmeHtml).slice(0, 6000) : "(pas de README)";
  const prompt = [
    `Dépôt : ${repo.owner}/${repo.name}`,
    repo.description ? `Description : ${repo.description}` : null,
    `Langage : ${repo.language ?? "?"} · sujets : ${repo.topics.join(", ") || "aucun"}`,
    `Étoiles : ${formatCompact(repo.stars)} · +${repo.gained.day ?? "?"} aujourd'hui · +${repo.gained.week ?? "?"} cette semaine`,
    repo.createdAt ? `Créé le : ${repo.createdAt.slice(0, 10)}` : null,
    detail.contributors ? `Contributeurs : ${detail.contributors}` : null,
    detail.mentions.length
      ? `Mentions récentes :\n${detail.mentions
          .slice(0, 8)
          .map((m) => `- [${m.source}] ${m.title}`)
          .join("\n")}`
      : null,
    `README (extrait) :\n${readme}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // If the model declines, the API retries on a fallback model it picks by refusal category.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(AnalysisSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("L'analyse n'a pas pu être générée pour ce dépôt.");
  }
  const analysis = response.parsed_output;
  if (row) {
    await db
      .insert(analyses)
      .values({ repoId: row.id, payload: analysis, createdAt: new Date() })
      .onConflictDoUpdate({ target: analyses.repoId, set: { payload: analysis, createdAt: new Date() } });
  }
  return analysis;
}
