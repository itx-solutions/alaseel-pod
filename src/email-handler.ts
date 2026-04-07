import PostalMime from "postal-mime";
import { insertInboundEmailQueueRow } from "@/lib/data/email-queue";
import { parseEmailWithClaude } from "@/lib/email-parser";
import {
  extractDeliveryOrdersFromPdf,
  type PdfDeliveryOrder,
} from "@/lib/pdf-parser";
import type { ParsedEmailData } from "@/lib/types/email";

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

function attachmentBodyToArrayBuffer(
  content: ArrayBuffer | Uint8Array | string,
): ArrayBuffer | null {
  if (typeof content === "string") {
    try {
      const binary = atob(content);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch {
      return null;
    }
  }
  if (content instanceof ArrayBuffer) return content;
  if (content instanceof Uint8Array) {
    const copy = new Uint8Array(content.byteLength);
    copy.set(content);
    return copy.buffer;
  }
  return null;
}

function pdfOrderToParsedData(order: PdfDeliveryOrder): ParsedEmailData {
  return {
    recipient_name: order.recipient_name,
    delivery_address: order.delivery_address,
    recipient_phone: order.recipient_phone,
    recipient_email: order.recipient_email,
    items: order.items,
    special_instructions: order.special_instructions,
    confidence: order.confidence,
    order_reference: order.order_reference,
    source_type: "pdf_attachment",
  };
}

function isDeliveryRelevantBody(parsed: ParsedEmailData | null): boolean {
  if (!parsed) return false;
  return !!(
    parsed.recipient_name?.trim() ||
    parsed.delivery_address?.trim() ||
    (parsed.items && parsed.items.length > 0)
  );
}

/**
 * Cloudflare Email Worker entry. Never throws — errors are logged and a row may be stored with minimal data.
 */
export async function emailHandler(
  message: InboundEmailMessage,
  env: EmailHandlerEnv,
): Promise<void> {
  try {
    const parsed = await PostalMime.parse(message.raw, {
      attachmentEncoding: "arraybuffer",
    });
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

    const pdfAttachments = (parsed.attachments ?? []).filter((a) => {
      if (a.mimeType !== "application/pdf") return false;
      return !!attachmentBodyToArrayBuffer(a.content);
    });

    if (pdfAttachments.length > 0) {
      try {
        for (const att of pdfAttachments) {
          const buf = attachmentBodyToArrayBuffer(att.content);
          if (!buf) continue;

          const filename = att.filename?.trim() || "attachment.pdf";
          const subjectWithPdf = `${rawSubject} (PDF: ${filename})`;

          const { orders, displayBody } = await extractDeliveryOrdersFromPdf(
            buf,
            apiKey,
          );

          if (orders.length === 0) {
            await insertInboundEmailQueueRow(
              {
                rawFrom,
                rawSubject: subjectWithPdf,
                rawBody: `${displayBody}\n\n(No delivery orders could be parsed from this PDF.)`,
                parsedData: null,
              },
              env,
            );
          } else {
            for (const order of orders) {
              await insertInboundEmailQueueRow(
                {
                  rawFrom,
                  rawSubject: subjectWithPdf,
                  rawBody: displayBody,
                  parsedData: pdfOrderToParsedData(order),
                },
                env,
              );
            }
          }
        }

        const bodyParsed = apiKey
          ? await parseEmailWithClaude(rawSubject, rawBody, apiKey)
          : null;
        if (bodyParsed && isDeliveryRelevantBody(bodyParsed)) {
          const withSource: ParsedEmailData = {
            ...bodyParsed,
            source_type: "email_body",
          };
          await insertInboundEmailQueueRow(
            {
              rawFrom,
              rawSubject,
              rawBody,
              parsedData: withSource,
            },
            env,
          );
        }
        return;
      } catch {
        /* fall through to body-only */
      }
    }

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
