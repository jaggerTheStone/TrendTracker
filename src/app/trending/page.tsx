import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { TrendingView } from "@/components/views/trending";
import type { Period } from "@/lib/types";
import { getTrending, TRENDING_LANGUAGES } from "@/server/trending";

export const metadata: Metadata = { title: "Trending" };

async function load(searchParams: PageProps<"/trending">["searchParams"]) {
  await connection();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const period = (["day", "week", "month"].includes(one(params.p)) ? one(params.p) : "day") as Period;
  const language = TRENDING_LANGUAGES.includes(one(params.lang)) ? one(params.lang) : "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one(params.day)) ? one(params.day) : null;
  return getTrending({ period, language, day });
}

export default function TrendingPage({ searchParams }: PageProps<"/trending">) {
  return (
    <Screen>
      <PageTitle>Trending</PageTitle>
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <TrendingView initial={load(searchParams)} />
      </Suspense>
    </Screen>
  );
}
