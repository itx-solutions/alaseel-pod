import {
  handleShopifyOrdersCancelled,
  insertShopifyQueueFromPaid,
  shopifyQueueEntryExists,
} from "@/lib/data/shopify-queue";
import {
  mapShopifyOrderToQueueEntry,
  verifyShopifyWebhook,
} from "@/lib/shopify";
import type { ShopifyOrderPayload } from "@/lib/types/shopify";

function getTopic(request: Request): string {
  return (
    request.headers.get("x-shopify-topic") ??
    request.headers.get("X-Shopify-Topic") ??
    ""
  )
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.text();

  if (!(await verifyShopifyWebhook(request, body))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const topic = getTopic(request);

  try {
    if (topic === "orders/paid") {
      let payload: ShopifyOrderPayload;
      try {
        payload = JSON.parse(body) as ShopifyOrderPayload;
      } catch {
        console.warn("[shopify webhook] orders/paid: invalid JSON");
        return new Response("OK", { status: 200 });
      }

      const shopifyOrderId = String(payload.id);
      if (await shopifyQueueEntryExists(shopifyOrderId)) {
        return new Response("OK", { status: 200 });
      }

      const mapped = mapShopifyOrderToQueueEntry(payload);
      if (!mapped) {
        console.info(
          "[shopify webhook] orders/paid: skipped (no shipping address)",
          shopifyOrderId,
        );
        return new Response("OK", { status: 200 });
      }

      await insertShopifyQueueFromPaid(mapped);
      return new Response("OK", { status: 200 });
    }

    if (topic === "orders/cancelled") {
      let payload: ShopifyOrderPayload;
      try {
        payload = JSON.parse(body) as ShopifyOrderPayload;
      } catch {
        console.warn("[shopify webhook] orders/cancelled: invalid JSON");
        return new Response("OK", { status: 200 });
      }

      await handleShopifyOrdersCancelled(payload);
      return new Response("OK", { status: 200 });
    }
  } catch (e) {
    console.error("[shopify webhook]", topic, e);
  }

  return new Response("OK", { status: 200 });
}
