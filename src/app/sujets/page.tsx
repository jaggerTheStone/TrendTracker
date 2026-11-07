import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { TopicsIndex } from "@/components/views/explore";

export const metadata: Metadata = { title: "Sujets" };

export default function TopicsPage() {
  return (
    <Screen>
      <PageTitle>Sujets</PageTitle>
      <Suspense fallback={<ListSkeleton rows={12} />}>
        <TopicsIndex />
      </Suspense>
    </Screen>
  );
}
