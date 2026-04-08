import type { ShopifyOrderPayload } from "@/lib/types/shopify";

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a[i]! ^ b[i]!;
  }
  return out === 0;
}

/**
 * Verifies Shopify webhook HMAC (X-Shopify-Hmac-Sha256) using Web Crypto API.
 * Returns false if secret missing, header missing, or signature mismatch.
 */
export async function verifyShopifyWebhook(
  request: Request,
  body: string,
): Promise<boolean> {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get("x-shopify-hmac-sha256") ??
    request.headers.get("X-Shopify-Hmac-Sha256");
  if (!header?.trim()) return false;

  let expectedB64: string;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    expectedB64 = uint8ToBase64(new Uint8Array(sig));
  } catch {
    return false;
  }

  const expected = expectedB64.trim();
  const received = header.trim();
  if (expected.length !== received.length) return false;

  let expBytes: Uint8Array;
  let recvBytes: Uint8Array;
  try {
    expBytes = Uint8Array.from(atob(expected), (c) => c.charCodeAt(0));
    recvBytes = Uint8Array.from(atob(received), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  if (expBytes.length !== recvBytes.length) return false;
  return timingSafeEqualBytes(expBytes, recvBytes);
}

/** Exported for shopify-queue insert + tests */
export type MappedShopifyQueueInsert = {
  shopify_order_id: string;
  shopify_order_number: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  delivery_address: string;
  items: Array<{
    name: string;
    quantity: number;
    variant_title?: string | null;
  }>;
  order_total: string | null;
  notes: string | null;
  raw_payload: Record<string, unknown>;
};

/**
 * Maps Shopify order payload to queue row fields.
 * Returns null if there is no usable shipping address.
 */
export function mapShopifyOrderToQueueEntry(
  payload: ShopifyOrderPayload,
): MappedShopifyQueueInsert | null {
  const addr = payload.shipping_address;
  if (!addr || !addr.address1?.trim()) {
    return null;
  }

  const parts: string[] = [];
  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (t) parts.push(t);
  };
  push(addr.address1);
  push(addr.address2);
  push(addr.city);
  const provZip = [addr.province?.trim(), addr.zip?.trim()]
    .filter(Boolean)
    .join(" ");
  if (provZip) parts.push(provZip);
  push(addr.country);

  const delivery_address = parts.join(", ");
  if (!delivery_address.trim()) return null;

  const items = payload.line_items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    variant_title: item.variant_title,
  }));

  const dueDate =
    payload.note_attributes?.find(
      (a) =>
        a.name.toLowerCase().includes("due date") ||
        a.name.toLowerCase().includes("delivery date"),
    )?.value ?? null;

  const dueTime =
    payload.note_attributes?.find(
      (a) =>
        a.name.toLowerCase().includes("due time") ||
        a.name.toLowerCase().includes("delivery time"),
    )?.value ?? null;

  const notes =
    [
      dueDate ? `Delivery date: ${dueDate}` : null,
      dueTime ? `Delivery time: ${dueTime}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

  return {
    shopify_order_id: String(payload.id),
    shopify_order_number: `#${payload.order_number}`,
    recipient_name: addr.name?.trim() || "Unknown",
    recipient_phone: addr.phone?.trim() ?? null,
    recipient_email: payload.email?.trim() ?? null,
    delivery_address,
    items,
    order_total: payload.total_price ?? null,
    notes,
    raw_payload: payload as unknown as Record<string, unknown>,
  };
}
