import type { Metadata, Viewport } from "next";
import { Geist_Mono, Mona_Sans } from "next/font/google";
import { connection } from "next/server";
import { AppProvider } from "@/components/app-provider";
import { Header, TabBar } from "@/components/chrome";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { getOverview } from "@/server/overview";
import "./globals.css";

const mona = Mona_Sans({ variable: "--font-mona", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "TrendTracker", template: "%s · TrendTracker" },
  description: "Les dépôts GitHub qui montent : étoiles du jour, vidéos, discussions, et tes suivis.",
  appleWebApp: { capable: true, title: "TrendTracker" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  viewportFit: "cover",
};

async function loadOverview() {
  await connection();
  return getOverview();
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Not awaited: each screen renders its shell at once and suspends on this
  // promise in its own boundary. The provider then keeps it live over SSE.
  const overview = loadOverview();

  return (
    // data-theme is set by the inline script before React hydrates.
    <html lang="fr" className={`${mona.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppProvider overviewPromise={overview}>
          <Header />
          {children}
          <TabBar />
        </AppProvider>
      </body>
    </html>
  );
}
