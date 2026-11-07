import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { BuzzView } from "@/components/views/buzz";

export const metadata: Metadata = { title: "Buzz" };

export default function BuzzPage() {
  return (
    <Screen>
      <PageTitle>Buzz</PageTitle>
      <Suspense fallback={<ListSkeleton />}>
        <BuzzView />
      </Suspense>
    </Screen>
  );
}
