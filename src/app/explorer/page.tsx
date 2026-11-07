import { GitCompareArrows, Hash, Radar, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { ListSkeleton } from "@/components/ui";
import { ExplorerView } from "@/components/views/explorer";

export const metadata: Metadata = { title: "Explorer" };

const EXPLORE_LINKS = [
  { href: "/sujets", label: "Sujets", icon: Hash },
  { href: "/dev", label: "Développeurs", icon: Users },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/comparer", label: "Comparer", icon: GitCompareArrows },
];

export default function ExplorerPage() {
  return (
    <Screen>
      <PageTitle
        extra={
          <nav aria-label="Vues" className="flex flex-wrap gap-2">
            {EXPLORE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="btn">
                <Icon className="size-4 text-muted" />
                {label}
              </Link>
            ))}
          </nav>
        }
      >
        Explorer
      </PageTitle>
      <Suspense fallback={<ListSkeleton />}>
        <ExplorerView />
      </Suspense>
    </Screen>
  );
}
