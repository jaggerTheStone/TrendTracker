import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Both drivers expose the same query builder; we type against postgres-js and
 * only use the builder (never `db.execute`, whose result shape differs).
 */
export type Db = PostgresJsDatabase<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

// Survives Next.js hot reloads and is shared between route bundles: PGlite
// must only ever be opened once per data directory.
const globalForDb = globalThis as unknown as { __trendtrackerDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__trendtrackerDb ??= connect().catch((error) => {
    globalForDb.__trendtrackerDb = undefined;
    throw error;
  });
  return globalForDb.__trendtrackerDb;
}

async function connect(): Promise<Db> {
  const { DATABASE_URL, PGLITE_DIR } = env();

  if (DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare: false keeps us compatible with transaction poolers (Neon, Supabase).
    return drizzle({ client: postgres(DATABASE_URL, { prepare: false, max: 5 }), schema });
  }

  // Local mode: an embedded Postgres persisted on disk, migrated on first use.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.resolve(PGLITE_DIR);
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Db;
}

/** Applies migrations to the configured database (used by `npm run db:migrate`). */
export async function migrateDatabase(): Promise<void> {
  const { DATABASE_URL } = env();
  if (!DATABASE_URL) {
    await getDb(); // PGlite migrates on connect
    return;
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}
