import {
  emailHandler,
  type InboundEmailMessage,
} from "./src/email-handler";

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

type WorkerHandlerEnv = {
  ANTHROPIC_API_KEY?: string;
  HYPERDRIVE?: { connectionString?: string };
  /** Direct Neon URL for `neon()` in email handler — not Hyperdrive (see lib/data/email-queue.ts). */
  NEON_DATABASE_URL?: string;
  DATABASE_URL?: string;
};

export default {
  fetch: handler.fetch.bind(handler),

  async email(
    message: InboundEmailMessage,
    env: WorkerHandlerEnv,
    _ctx: unknown,
  ): Promise<void> {
    await emailHandler(message, env);
  },
};
