import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Screen } from "@/components/chrome";
import { Skeleton } from "@/components/ui";
import { SharedBoard } from "@/components/views/shared-board";
import { getSharedBoard } from "@/server/boards";

export const metadata: Metadata = { title: "Tableau partagé" };

async function Board({ params }: { params: PageProps<"/b/[shareId]">["params"] }) {
  const { shareId } = await params;
  await connection();
  const board = await getSharedBoard(shareId);
  if (!board) notFound();
  return <SharedBoard {...board} />;
}

export default function SharedBoardPage({ params }: PageProps<"/b/[shareId]">) {
  return (
    <Screen>
      <Suspense fallback={<Skeleton className="mt-6 h-[400px]" />}>
        <Board params={params} />
      </Suspense>
    </Screen>
  );
}
