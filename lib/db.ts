import { Pool, neonConfig } from "@neondatabase/serverless";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/db/schema";

neonConfig.webSocketConstructor = ws;

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

export type Database = NeonDatabase<typeof schema>;

let _db: Database | undefined;

export function getDb(): Database {
  if (!_db) {
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
