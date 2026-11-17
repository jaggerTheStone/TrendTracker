import { createRequire } from "node:module";

// `@next/env` ships as CommonJS: Node's ESM loader cannot see its named exports,
// so require it. Resolving from Next.js itself keeps npm and pnpm layouts working.
const nextRequire = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env") as {
  loadEnvConfig: (dir: string) => unknown;
};

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  // PGlite allows a single process per data directory: the dev server owns it.
  console.error(
    "No DATABASE_URL: the local database belongs to the dev server.\n" +
      "Trigger a collection through it instead: curl -X POST http://localhost:3000/api/ingest?force",
  );
  process.exit(1);
}

const { runIngestion } = await import("../src/server/ingest");
const result = await runIngestion({ force: true });
console.log(JSON.stringify(result, null, 2));
process.exit(result.results.some((r) => r.status === "error") ? 1 : 0);
