import { loadEnvConfig } from "@next/env";

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
