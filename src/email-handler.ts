import PostalMime from "postal-mime";
import { insertInboundEmailQueueRow } from "@/lib/data/email-queue";
import { parseEmailWithClaude } from "@/lib/email-parser";

function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type InboundEmailMessage = {
  raw: ReadableStream<Uint8Array>;
  /** Envelope From (RFC 5321), when available */
  from?: string;
  headers?: Headers;
};

type EmailHandlerEnv = {
  ANTHROPIC_API_KEY?: string;
  HYPERDRIVE?: { connectionString?: string };
};

function envelopeFrom(m: InboundEmailMessage): string | undefined {
  if (typeof m.from === "string" && m.from.trim()) return m.from.trim();
  const h = m.headers?.get("from");
  return h?.trim() || undefined;
}

/**
 * Cloudflare Email Worker entry. Never throws — errors are logged and a row may be stored with minimal data.
 */
export async function emailHandler(
  message: InboundEmailMessage,
  env: EmailHandlerEnv,
): Promise<void> {
  try {
    const parsed = await PostalMime.parse(message.raw);
    const rawFrom =
      parsed.from?.address?.trim() ||
      envelopeFrom(message) ||
      "(unknown)";
    const rawSubject = parsed.subject?.trim() || "(no subject)";
    let rawBody = parsed.text?.trim() || "";
    if (!rawBody && parsed.html) {
      rawBody = stripHtmlToText(parsed.html);
    }
    if (!rawBody) rawBody = "(empty body)";

    const apiKey = env.ANTHROPIC_API_KEY ?? "";
    const parsedData = apiKey
      ? await parseEmailWithClaude(rawSubject, rawBody, apiKey)
      : null;

    await insertInboundEmailQueueRow(
      {
        rawFrom,
        rawSubject,
        rawBody,
        parsedData,
      },
      env,
    );
  } catch (err) {
    try {
      const from = envelopeFrom(message) ?? "(unknown)";
      await insertInboundEmailQueueRow(
        {
          rawFrom: from,
          rawSubject: "(processing error)",
          rawBody:
            err instanceof Error ? err.message : "Failed to process inbound email",
          parsedData: null,
        },
        env,
      );
    } catch {
      /* last-resort: do not propagate */
    }
  }
}
