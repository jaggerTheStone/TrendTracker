import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { BoardView } from "@/components/views/boards";

export const metadata: Metadata = { title: "Tableau" };

async function Board({ params }: { params: PageProps<"/suivis/[id]">["params"] }) {
  const { id } = await params;
  return <BoardView id={id} />;
}

export default function BoardPage({ params }: PageProps<"/suivis/[id]">) {
  return (
    <Screen>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Board params={params} />
      </Suspense>
    </Screen>
  );
}
