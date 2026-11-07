import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { DevelopersIndex } from "@/components/views/explore";
import { trendingAppearancesByOwner } from "@/server/trending";

export const metadata: Metadata = { title: "Développeurs" };

async function Developers() {
  await connection();
  const appearances = Object.fromEntries(await trendingAppearancesByOwner());
  return <DevelopersIndex appearances={appearances} />;
}

export default function DevelopersPage() {
  return (
    <Screen>
      <PageTitle>Développeurs en vue</PageTitle>
      <Suspense fallback={<ListSkeleton rows={12} />}>
        <Developers />
      </Suspense>
    </Screen>
  );
}
