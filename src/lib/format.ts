const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("fr-FR");

/** 1 234 → "1,2 k". */
export function formatCompact(value: number): string {
  return Math.abs(value) < 10_000 ? plain.format(value) : compact.format(value).replace(/ /g, " ");
}

/** Splits a compact number into its figure and unit, for "12,3 k" set as a big number with a small unit. */
export function splitCompact(value: number): { figure: string; unit: string } {
  if (Math.abs(value) < 1000) return { figure: plain.format(value), unit: "" };
  const text = compact.format(value).replace(/ /g, " ");
  const match = /^([-\d,.\s]+?)\s*([^\d\s]+)$/.exec(text);
  return match ? { figure: match[1], unit: match[2] } : { figure: text, unit: "" };
}

export function formatGrowth(growth: number): string {
  if (growth >= 9.995) return "×" + Math.round(growth + 1);
  const pct = Math.round(growth * 100);
  return `${pct >= 0 ? "+" : ""}${pct} %`;
}

export function formatRelative(iso: string, now: number): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h`;
  if (seconds < 30 * 86_400) return `${Math.floor(seconds / 86_400)} j`;
  if (seconds < 365 * 86_400) return `${Math.floor(seconds / (30 * 86_400))} mois`;
  return `${Math.floor(seconds / (365 * 86_400))} an${seconds >= 730 * 86_400 ? "s" : ""}`;
}

export function formatDay(iso: string, now: number): string {
  const date = new Date(iso);
  const today = new Date(now);
  const diff = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000,
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** "il y a 12 s", "il y a 3 min": for live readouts that tick every second. */
export function formatAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  return `il y a ${Math.floor(seconds / 3600)} h`;
}
