import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { RadarSkeleton, RadarView } from "@/components/views/radar";

export const metadata: Metadata = { title: "Radar" };

export default function RadarPage() {
  return (
    <Screen>
      <PageTitle>Radar</PageTitle>
      <Suspense fallback={<RadarSkeleton />}>
        <RadarView />
      </Suspense>
    </Screen>
  );
}
