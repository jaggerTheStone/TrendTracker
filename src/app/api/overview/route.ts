import { connection } from "next/server";
import { getOverview } from "@/server/overview";

export async function GET() {
  await connection();
  return Response.json(await getOverview());
}
