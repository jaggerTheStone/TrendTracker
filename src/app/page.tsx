import { Suspense } from "react";
import { PageTitle, Screen } from "@/components/chrome";
import { HomeSkeleton, HomeView } from "@/components/views/home";

export default function HomePage() {
  return (
    <Screen>
      <PageTitle>Pulse</PageTitle>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeView />
      </Suspense>
    </Screen>
  );
}
