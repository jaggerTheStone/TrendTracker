import { connection } from "next/server";
import type { Period } from "@/lib/types";
import { getTrending, TRENDING_LANGUAGES } from "@/server/trending";

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const period = (["day", "week", "month"].includes(params.get("p") ?? "") ? params.get("p") : "day") as Period;
  const language = TRENDING_LANGUAGES.includes(params.get("lang") ?? "") ? params.get("lang")! : "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") ?? "") ? params.get("day") : null;
  return Response.json(await getTrending({ period, language, day }));
}
