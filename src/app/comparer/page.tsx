import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { Skeleton } from "@/components/ui";
import { CompareView } from "@/components/views/compare";

export const metadata: Metadata = { title: "Comparer" };

export default function ComparePage() {
  return (
    <Screen>
      <PageTitle>Comparer</PageTitle>
      <Suspense fallback={<Skeleton className="h-[320px]" />}>
        <CompareView />
      </Suspense>
    </Screen>
  );
}
