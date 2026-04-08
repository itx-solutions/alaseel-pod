import { neon } from "@neondatabase/serverless";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

/**
 * Hyperdrive + `neon-http` (fetch) is the supported path on Cloudflare Workers.
 * Do not use `neon-serverless` Pool + `ws` here — Workers are not Node.js; WebSocket
 * DB connections fail in production with errors like "Connection closed".
 *
 * Do not cache a global Drizzle/Neon client: Workers forbid I/O created in one
 * request from being used in another ("Cannot perform I/O on behalf of a different
 * request"). Always build a fresh client per `getDb()` call.
 */
export function getDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;
  try {
    const { env } = getCloudflareContext({ async: false });
    const hyperdrive = (env as unknown as Record<string, unknown>).HYPERDRIVE as
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

/**
 * Worker / email-handler env. Hyperdrive is for wire-protocol drivers; `@neondatabase/serverless`
 * `neon()` uses Neon's HTTP API and must use a direct Neon URL — see `getNeonConnectionString` in
 * `lib/data/email-queue.ts`.
 */
export type HyperdriveEnv = {
  HYPERDRIVE?: { connectionString?: string };
  /** Direct Neon URL for `neon()` in Email Worker (not the Hyperdrive proxy string). */
  NEON_DATABASE_URL?: string;
  DATABASE_URL?: string;
};

/**
 * Use in Workers handlers where `getCloudflareContext()` may be unavailable
 * (e.g. Email Worker). Prefer `getDb()` in Next.js / fetch handlers.
 */
export function getDbFromWorkerEnv(env: HyperdriveEnv): Database {
  const url =
    env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "HYPERDRIVE.connectionString or DATABASE_URL is required for Worker DB access.",
    );
  }
  return drizzle(neon(url), { schema });
}

export function getDb(): Database {
  return drizzle(neon(getDatabaseUrl()), { schema });
}
