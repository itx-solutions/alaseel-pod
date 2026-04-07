import { notFound } from "next/navigation";
import { getShopifyQueueEntry } from "@/lib/data/shopify-queue";
import { ShopifyQueueReviewClient } from "./shopify-queue-review-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShopifyQueueReviewPage({ params }: PageProps) {
  const { id } = await params;
  const entry = await getShopifyQueueEntry(id);
  if (!entry) notFound();

  return <ShopifyQueueReviewClient initial={entry} />;
}
