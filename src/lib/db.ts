import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

let pool: Pool | undefined;

/**
 * Drizzle client using Neon's serverless Pool.
 * Local: set DATABASE_URL in .env.local.
 * Workers + Hyperdrive: pass env.HYPERDRIVE.connectionString or set DATABASE_URL in Wrangler.
 */
export function getDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set (or pass connectionString, e.g. from Hyperdrive in Workers).",
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return drizzle({ client: pool, schema });
}
