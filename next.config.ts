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

const nextConfig: NextConfig = {
  // `ws` + optional native addons must not be webpack-bundled or WebSockets break at runtime
  // (bufferUtil.mask is not a function / Connection terminated unexpectedly).
  serverExternalPackages: ["ws", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
