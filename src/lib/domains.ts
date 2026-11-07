export const DOMAIN_IDS = ["ai", "web", "devtools", "infra", "data", "security", "apps", "systems"] as const;

export type Domain = (typeof DOMAIN_IDS)[number];

export const DOMAINS: Record<Domain, { label: string }> = {
  ai: { label: "IA" },
  web: { label: "Web" },
  devtools: { label: "Outils" },
  infra: { label: "Infra" },
  data: { label: "Données" },
  security: { label: "Sécurité" },
  apps: { label: "Apps" },
  systems: { label: "Système" },
};

/** linguist colours for the languages that show up on trending. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Zig: "#ec915c",
  Lua: "#000080",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  "Jupyter Notebook": "#DA5B0B",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  Nix: "#7e7eff",
  MDX: "#fcb32c",
  Astro: "#ff5a03",
  Julia: "#a270ba",
  OCaml: "#ef7a08",
  Clojure: "#db5855",
  Dockerfile: "#384d54",
  "Objective-C": "#438eff",
  Assembly: "#6E4C13",
  Verilog: "#b2b7f8",
  Gleam: "#ffaff3",
  Mojo: "#ff4c1f",
};

export function languageColor(language: string | null): string {
  return (language && LANGUAGE_COLORS[language]) || "#d6c7b8";
}
