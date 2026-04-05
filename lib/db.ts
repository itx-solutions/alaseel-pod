import { neon } from "@neondatabase/serverless";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function getDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;
  try {
    const { env } = getCloudflareContext({ async: false });
    const hyperdrive = (env as Record<string, unknown>).HYPERDRIVE as
      | { connectionString?: string }
      | undefined;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    // Not running inside a Cloudflare Worker request (e.g. local Node, build).
  }
  throw new Error(
    "DATABASE_URL is not set. For Workers, bind Hyperdrive as HYPERDRIVE or set DATABASE_URL.",
  );
}

export type Database = NeonHttpDatabase<typeof schema>;

let _db: Database | undefined;

export function getDb(): Database {
  if (!_db) {
    _db = drizzle(neon(getDatabaseUrl()), { schema });
  }
  return _db;
}
