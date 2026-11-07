import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { BoardsView } from "@/components/views/boards";

export const metadata: Metadata = { title: "Suivis" };

export default function BoardsPage() {
  return (
    <Screen>
      <PageTitle>Suivis</PageTitle>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <BoardsView />
      </Suspense>
    </Screen>
  );
}
