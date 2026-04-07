import { Suspense } from "react";
import { ShopifyQueueListClient } from "./shopify-queue-list-client";

export default function ShopifyQueuePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-gray-500">Loading Shopify queue…</p>}
    >
      <ShopifyQueueListClient />
    </Suspense>
  );
}
