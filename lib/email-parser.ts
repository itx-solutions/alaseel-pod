import type { ParsedEmailConfidence, ParsedEmailData } from "@/lib/types/email";

export const SYSTEM_PROMPT = `You are a delivery order parser for Mazati, a Lebanese food delivery business in Sydney, Australia.

Extract delivery order details from the email below. Return ONLY a valid JSON object with no other text, no markdown, no explanation.

Required fields (return null for the field if not found):
{
  "recipient_name": string | null,
  "delivery_address": string | null,
  "recipient_phone": string | null,
  "recipient_email": string | null,
  "items": [{ "name": string, "quantity": number }] | null,
  "special_instructions": string | null,
  "confidence": "high" | "medium" | "low"
}

Set confidence to:
- "high" if recipient name and delivery address are clearly present
- "medium" if some fields are present but others are uncertain
- "low" if the email does not appear to be a delivery order at all

If this email is clearly not a delivery order (spam, unrelated content), set all fields to null and confidence to "low".`;

function isConfidence(v: unknown): v is ParsedEmailConfidence {
  return v === "high" || v === "medium" || v === "low";
}

function normalizeParsed(raw: unknown): ParsedEmailData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const confidence = o.confidence;
  if (!isConfidence(confidence)) return null;

  let items: ParsedEmailData["items"] = null;
  if (Array.isArray(o.items)) {
    const lines: Array<{ name: string; quantity: number }> = [];
    for (const row of o.items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      const q = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
      if (!name.trim() || !Number.isFinite(q) || q < 1) continue;
      lines.push({ name: name.trim(), quantity: Math.floor(q) });
    }
    items = lines.length ? lines : null;
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
    items,
    special_instructions:
      typeof o.special_instructions === "string"
        ? o.special_instructions
        : null,
    confidence,
  };
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

/**
 * Calls Claude Haiku to extract delivery fields. Never throws; returns null on any failure.
 */
export async function parseEmailWithClaude(
  subject: string,
  body: string,
  apiKey: string,
): Promise<ParsedEmailData | null> {
  if (!apiKey.trim()) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Subject: ${subject}\n\nBody:\n${body}`,
          },
        ],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as unknown;
    const text = extractAssistantText(data);
    if (!text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return null;
    }

    return normalizeParsed(parsed);
  } catch {
    return null;
  }
}
