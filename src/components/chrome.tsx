"use client";

import {
  Bookmark,
  Compass,
  Flame,
  House,
  LogIn,
  LogOut,
  Mail,
  Rss,
  Settings2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { logoSvg } from "@/lib/logo";
import { updateSettings, useSettings } from "@/lib/settings";
import { useApp } from "./app-provider";
import { Segmented } from "./ui";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Pulse", icon: House },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/explorer", label: "Explorer", icon: Compass },
  { href: "/buzz", label: "Buzz", icon: Rss },
  { href: "/suivis", label: "Suivis", icon: Bookmark },
];

/** Pages reached from Explorer (radar, topics, developers, comparison) keep its tab selected. */
const EXPLORER_PAGES = ["/radar", "/sujets", "/dev", "/comparer"];

function activeTab(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (EXPLORER_PAGES.some((p) => pathname.startsWith(p))) return "/explorer";
  return TABS.find((t) => t.href !== "/" && pathname.startsWith(t.href))?.href ?? null;
}

/** Reads the URL, so it streams in; the static shell shows the same nav without a selection. */
function WithPath({ children }: { children: (current: string | null) => ReactNode }) {
  return <Suspense fallback={children(null)}>{<PathReader>{children}</PathReader>}</Suspense>;
}

function PathReader({ children }: { children: (current: string | null) => ReactNode }) {
  return children(activeTab(usePathname()));
}

const HEADER_LOGO = logoSvg({ id: "header-logo", size: 30 });

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold" aria-label="TrendTracker, accueil">
      {/* Static markup from our own constants, rendered once. */}
      <span className="size-[30px] shrink-0" dangerouslySetInnerHTML={{ __html: HEADER_LOGO }} />
      <span className="hidden text-[16px] tracking-tight sm:inline">TrendTracker</span>
    </Link>
  );
}

/** Top bar: logo, sections (from md up), account and settings. */
export function Header() {
  return (
    <header className="bar sticky top-0 z-40 border-b border-line-muted">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        <WithPath>
          {(current) => (
            <nav aria-label="Sections" className="hidden flex-1 items-center gap-1 md:flex">
              {TABS.map(({ href, label, icon: Icon }) => {
                const active = current === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-14 items-center gap-2 px-3 text-[14px] font-medium transition-colors ${
                      active ? "text-fg" : "text-muted hover:text-fg"
                    }`}
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                    {label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#fd8c73]"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </WithPath>
        <span className="flex-1 md:hidden" />
        <LiveDot />
        <AccountMenu />
      </div>
    </header>
  );
}

/** Bottom tab bar on phones and small tablets. */
export function TabBar() {
  return (
    <WithPath>
      {(current) => (
        <nav
          aria-label="Navigation"
          className="bar fixed inset-x-0 bottom-0 z-40 border-t border-line-muted pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="mx-auto grid h-14 max-w-[560px] grid-cols-5">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = current === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon className="size-[21px]" strokeWidth={active ? 2.1 : 1.7} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </WithPath>
  );
}

type Alerts = { trending: boolean; spikes: boolean; weekly: boolean };

const ALERT_LABELS: { key: keyof Alerts; label: string }[] = [
  { key: "trending", label: "Entrée dans le Trending" },
  { key: "spikes", label: "Forte poussée d'étoiles" },
  { key: "weekly", label: "Résumé de la semaine" },
];

/** E-mail alerts about followed repositories, saved on the account. */
function AlertToggles() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => (r.ok ? (r.json() as Promise<Alerts>) : null))
      .then(setAlerts)
      .catch(() => {});
  }, []);

  const toggle = (key: keyof Alerts) => {
    if (!alerts) return;
    const next = { ...alerts, [key]: !alerts[key] };
    setAlerts(next);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => setAlerts(alerts));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-line-muted px-3 py-3">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
        <Mail className="size-3.5" />
        Alertes e-mail · tes suivis
      </p>
      {ALERT_LABELS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={alerts?.[key] ?? false}
          disabled={!alerts}
          onClick={() => toggle(key)}
          className="flex items-center justify-between gap-3 text-left text-[14px] disabled:opacity-50"
        >
          {label}
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${alerts?.[key] ? "bg-primary" : "bg-line"}`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${alerts?.[key] ? "translate-x-[18px]" : "translate-x-0.5"}`}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function AccountMenu() {
  const { account, sessionPending, openAuth, signOut } = useApp();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compte et réglages"
        aria-expanded={open}
        className="grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-subtle transition-colors hover:bg-btn-hover"
      >
        {account?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : account ? (
          <span className="text-[14px] font-semibold">{(account.name || account.email).charAt(0).toUpperCase()}</span>
        ) : (
          <UserRound className="size-[18px] text-muted" strokeWidth={1.8} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.14 }}
            style={{ transformOrigin: "top right" }}
            className="overlay absolute top-11 right-0 z-50 w-[min(300px,calc(100vw-32px))] p-1.5"
          >
            <div className="border-b border-line-muted px-3 pt-2 pb-3">
              {account ? (
                <>
                  <p className="truncate text-[14.5px] font-semibold">{account.name || "Mon compte"}</p>
                  <p className="truncate text-[13px] text-muted">{account.email}</p>
                </>
              ) : (
                <button
                  type="button"
                  disabled={sessionPending}
                  onClick={() => {
                    setOpen(false);
                    openAuth();
                  }}
                  className="btn btn-primary w-full"
                >
                  <LogIn className="size-4" />
                  Se connecter
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 px-3 py-3">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
                <Settings2 className="size-3.5" />
                Réglages
              </p>
              <div className="flex items-center justify-between gap-3 text-[14px]">
                Thème
                <Segmented
                  id="theme"
                  value={settings.theme}
                  onChange={(theme) => updateSettings({ theme })}
                  options={[
                    { value: "system", label: "Auto" },
                    { value: "light", label: "Clair" },
                    { value: "dark", label: "Sombre" },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[14px]">
                Période
                <Segmented
                  id="period-setting"
                  value={settings.period}
                  onChange={(period) => updateSettings({ period })}
                  options={[
                    { value: "day", label: "24 h" },
                    { value: "week", label: "7 j" },
                    { value: "month", label: "30 j" },
                  ]}
                />
              </div>
            </div>

            {account && <AlertToggles />}

            {account && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg border-t border-line-muted px-3 py-2.5 text-left text-[14px] hover:bg-hover"
              >
                <LogOut className="size-4 text-muted" />
                Se déconnecter
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LiveDot() {
  const { live } = useApp();
  return (
    <span
      className="relative inline-flex size-2"
      title={live ? "En direct" : "Hors ligne"}
      aria-label={live ? "En direct" : "Hors ligne"}
    >
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />}
      <span className={`relative size-2 rounded-full ${live ? "bg-success" : "bg-faint"}`} />
    </span>
  );
}

export function PageTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-6 pb-5">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">{children}</h1>
      {extra}
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    // A CSS fade: the server-rendered page shows at once, before any script has loaded.
    <main className="screen-in mx-auto w-full max-w-[1120px] min-w-0 px-4 pb-28 sm:px-6 md:pb-16">{children}</main>
  );
}
