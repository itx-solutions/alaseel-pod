import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

if (
  process.env.DATABASE_URL &&
  !process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
    process.env.DATABASE_URL;
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
