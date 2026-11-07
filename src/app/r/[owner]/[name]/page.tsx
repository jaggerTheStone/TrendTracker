import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Screen } from "@/components/chrome";
import { DetailSkeleton, HeaderSkeleton, RepoView, type DetailResult } from "@/components/views/repo";
import { RateLimitedError } from "@/server/github/api";
import { getRepoDetail } from "@/server/repo-detail";

export async function generateMetadata({ params }: PageProps<"/r/[owner]/[name]">): Promise<Metadata> {
  const { owner, name } = await params;
  return { title: `${owner}/${name}` };
}

async function loadDetail(owner: string, name: string): Promise<DetailResult> {
  await connection();
  try {
    return { detail: await getRepoDetail(owner, name) };
  } catch (error) {
    if (error instanceof RateLimitedError)
      return { detail: null, error: "Quota GitHub atteint, réessaie dans quelques minutes." };
    console.error("[repo]", error);
    return { detail: null, error: "GitHub ne répond pas." };
  }
}

async function Repo({ params }: { params: PageProps<"/r/[owner]/[name]">["params"] }) {
  const { owner, name } = await params;
  // Not awaited: the client shows what it already knows while the rest streams in.
  return <RepoView owner={owner} name={name} detail={loadDetail(owner, name)} />;
}

export default function RepoPage({ params }: PageProps<"/r/[owner]/[name]">) {
  return (
    <Screen>
      <Suspense
        fallback={
          <>
            <HeaderSkeleton />
            <DetailSkeleton />
          </>
        }
      >
        <Repo params={params} />
      </Suspense>
    </Screen>
  );
}
