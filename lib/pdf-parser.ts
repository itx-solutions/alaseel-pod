import { PDFParse } from "pdf-parse";

/** Claude PDF vision + text-array extraction output shape. */
export interface PdfDeliveryOrder {
  recipient_name: string | null;
  delivery_address: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  items: Array<{ name: string; quantity: number }> | null;
  special_instructions: string | null;
  order_reference: string | null;
  confidence: "high" | "medium" | "low";
}

const PDF_ARRAY_PROMPT = `Extract ALL delivery orders from this PDF document. This could be a route sheet with multiple stops, a supplier invoice, or a delivery slip.

Return ONLY a valid JSON array with no other text, no markdown, no explanation.
Each element represents one delivery stop or order:
[
  {
    "recipient_name": string | null,
    "delivery_address": string | null,
    "recipient_phone": string | null,
    "recipient_email": string | null,
    "items": [{ "name": string, "quantity": number }] | null,
    "special_instructions": string | null,
    "order_reference": string | null,
    "confidence": "high" | "medium" | "low"
  }
]

Rules:
- Create one object per delivery stop or destination
- For route sheets: each numbered stop is a separate delivery
- For invoices: the "Deliver To" or "Ship To" section is the delivery destination
- order_reference: the order number, invoice number, or stop number if present
- confidence "high": recipient name and full address clearly present
- confidence "medium": some fields present but incomplete
- confidence "low": cannot determine delivery details
- If this is not a delivery-related document, return an empty array []`;

const PDF_TEXT_USER_PREFIX = `The following text was extracted from a PDF attachment. Follow the same JSON array rules as for a full PDF document.

--- PDF text ---
`;

const MODEL = "claude-haiku-4-5-20251001";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function extractAssistantText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const content = (json as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  const s = parts.join("").trim();
  return s || null;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im;
  const m = t.match(fence);
  if (m?.[1]) return m[1]!.trim();
  return t;
}

function normalizeItems(
  raw: unknown,
): Array<{ name: string; quantity: number }> | null {
  if (!Array.isArray(raw)) return null;
  const lines: Array<{ name: string; quantity: number }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    const q = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
    if (!name.trim() || !Number.isFinite(q) || q < 1) continue;
    lines.push({ name: name.trim(), quantity: Math.floor(q) });
  }
  return lines.length ? lines : null;
}

function normalizePdfOrder(raw: unknown): PdfDeliveryOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const confidence = o.confidence;
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") {
    return null;
  }
  return {
    recipient_name:
      typeof o.recipient_name === "string" ? o.recipient_name : null,
    delivery_address:
      typeof o.delivery_address === "string" ? o.delivery_address : null,
    recipient_phone:
      typeof o.recipient_phone === "string" ? o.recipient_phone : null,
    recipient_email:
      typeof o.recipient_email === "string" ? o.recipient_email : null,
    items: normalizeItems(o.items),
    special_instructions:
      typeof o.special_instructions === "string"
        ? o.special_instructions
        : null,
    order_reference:
      typeof o.order_reference === "string" ? o.order_reference : null,
    confidence,
  };
}

function parseOrdersJson(text: string): PdfDeliveryOrder[] {
  const cleaned = stripJsonFence(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: PdfDeliveryOrder[] = [];
  for (const el of parsed) {
    const one = normalizePdfOrder(el);
    if (one) out.push(one);
  }
  return out;
}

async function callClaudeMessages(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  if (!apiKey.trim()) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return extractAssistantText(data);
  } catch {
    return null;
  }
}

/**
 * Extract plain text from a PDF buffer. Never throws.
 * Returns null if extraction fails or text is shorter than 50 characters.
 */
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer,
): Promise<string | null> {
  let parser: PDFParse | undefined;
  try {
    const data = new Uint8Array(pdfBuffer);
    parser = new PDFParse({ data });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    if (text.length < 50) return null;
    return text;
  } catch {
    return null;
  } finally {
    try {
      await parser?.destroy();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Sends the raw PDF to Claude document vision. Never throws; returns [] on error.
 */
export async function parsePdfWithClaude(
  pdfBuffer: ArrayBuffer,
  apiKey: string,
): Promise<PdfDeliveryOrder[]> {
  if (!apiKey.trim()) return [];
  try {
    const base64 = arrayBufferToBase64(pdfBuffer);
    const text = await callClaudeMessages(apiKey, {
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: PDF_ARRAY_PROMPT,
            },
          ],
        },
      ],
    });
    if (!text) return [];
    return parseOrdersJson(text);
  } catch {
    return [];
  }
}

async function parsePdfTextWithClaude(
  extractedText: string,
  apiKey: string,
): Promise<PdfDeliveryOrder[]> {
  if (!apiKey.trim()) return [];
  try {
    const text = await callClaudeMessages(apiKey, {
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${PDF_TEXT_USER_PREFIX}${extractedText}`,
            },
          ],
        },
      ],
      system: PDF_ARRAY_PROMPT,
    });
    if (!text) return [];
    return parseOrdersJson(text);
  } catch {
    return [];
  }
}

export type ExtractPdfOrdersResult = {
  orders: PdfDeliveryOrder[];
  /** Shown as email_queue.raw_body for PDF-sourced rows. */
  displayBody: string;
};

/**
 * Tries local text extraction + Claude on text; if that yields no orders, falls back to PDF vision.
 * Never throws.
 */
export async function extractDeliveryOrdersFromPdf(
  pdfBuffer: ArrayBuffer,
  apiKey: string,
): Promise<ExtractPdfOrdersResult> {
  let extractedText: string | null = null;
  try {
    extractedText = await extractTextFromPdf(pdfBuffer);
  } catch {
    extractedText = null;
  }

  if (extractedText) {
    const fromText = await parsePdfTextWithClaude(extractedText, apiKey);
    if (fromText.length > 0) {
      return { orders: fromText, displayBody: extractedText };
    }
  }

  const fromVision = await parsePdfWithClaude(pdfBuffer, apiKey);
  if (fromVision.length > 0) {
    return {
      orders: fromVision,
      displayBody: "PDF attachment — see parsed data",
    };
  }

  return {
    orders: [],
    displayBody: extractedText ?? "PDF attachment — see parsed data",
  };
}
