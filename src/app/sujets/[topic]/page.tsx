import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { TopicView } from "@/components/views/explore";
import { getTopic } from "@/server/explore";

export async function generateMetadata({ params }: PageProps<"/sujets/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  return { title: `#${decodeURIComponent(topic)}` };
}

async function Topic({ params }: { params: PageProps<"/sujets/[topic]">["params"] }) {
  const { topic } = await params;
  await connection();
  const data = await getTopic(decodeURIComponent(topic).toLowerCase());
  return (
    <>
      <PageTitle>#{data.topic}</PageTitle>
      <TopicView data={data} />
    </>
  );
}

export default function TopicPage({ params }: PageProps<"/sujets/[topic]">) {
  return (
    <Screen>
      <Suspense
        fallback={
          <div className="pt-20">
            <ListSkeleton rows={10} />
          </div>
        }
      >
        <Topic params={params} />
      </Suspense>
    </Screen>
  );
}
