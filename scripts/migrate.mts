import { createRequire } from "node:module";

// `@next/env` ships as CommonJS: Node's ESM loader cannot see its named exports,
// so require it. Resolving from Next.js itself keeps npm and pnpm layouts working.
const nextRequire = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env") as {
  loadEnvConfig: (dir: string) => unknown;
};

loadEnvConfig(process.cwd());

const { migrateDatabase } = await import("../src/server/db/client");
await migrateDatabase();
console.log("Migrations applied.");
process.exit(0);
