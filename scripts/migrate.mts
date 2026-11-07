import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const { migrateDatabase } = await import("../src/server/db/client");
await migrateDatabase();
console.log("Migrations applied.");
process.exit(0);
