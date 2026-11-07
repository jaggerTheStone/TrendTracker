import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { DeveloperView } from "@/components/views/explore";
import { RateLimitedError } from "@/server/github/api";
import { getDeveloper } from "@/server/explore";

export async function generateMetadata({ params }: PageProps<"/dev/[owner]">): Promise<Metadata> {
  const { owner } = await params;
  return { title: decodeURIComponent(owner) };
}

async function Developer({ params }: { params: PageProps<"/dev/[owner]">["params"] }) {
  const { owner } = await params;
  await connection();
  const data = await getDeveloper(decodeURIComponent(owner)).catch((error: unknown) => {
    if (error instanceof RateLimitedError) return "rate-limited" as const;
    throw error;
  });
  if (data === "rate-limited") {
    return <p className="pt-10 text-center text-muted">Quota GitHub atteint, réessaie dans quelques minutes.</p>;
  }
  if (!data) notFound();
  return <DeveloperView data={data} />;
}

export default function DeveloperPageRoute({ params }: PageProps<"/dev/[owner]">) {
  return (
    <Screen>
      <Suspense
        fallback={
          <div className="pt-6">
            <ListSkeleton rows={8} />
          </div>
        }
      >
        <Developer params={params} />
      </Suspense>
    </Screen>
  );
}
