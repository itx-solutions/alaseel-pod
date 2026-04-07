import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { orders, shopifyQueue, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { MappedShopifyQueueInsert } from "@/lib/shopify";
import type { OrderItemLine } from "@/lib/types/order";
import type {
  PaginatedShopifyQueueResponse,
  ShopifyOrderPayload,
  ShopifyQueueDetailDto,
  ShopifyQueueEntryStatus,
  ShopifyQueueListRowDto,
} from "@/lib/types/shopify";

const PAGE_SIZE = 50;

const reviewerUser = alias(users, "shopify_reviewer");

function toIso(d: Date): string {
  return d.toISOString();
}

function itemsCount(
  items: Array<{ name: string; quantity: number }>,
): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

const SHOPIFY_CANCEL_NOTE =
  "Shopify order cancelled — manual review required";

function mergeShopifyCancelNote(existing: string | null): string {
  if (!existing?.trim()) return SHOPIFY_CANCEL_NOTE;
  if (existing.includes(SHOPIFY_CANCEL_NOTE)) return existing;
  return `${existing.trim()}\n\n${SHOPIFY_CANCEL_NOTE}`;
}

export async function countPendingShopifyQueue(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(shopifyQueue)
    .where(eq(shopifyQueue.status, "pending_review"));
  return Number(row?.n ?? 0);
}

export async function shopifyQueueEntryExists(
  shopifyOrderId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: shopifyQueue.id })
    .from(shopifyQueue)
    .where(eq(shopifyQueue.shopifyOrderId, shopifyOrderId))
    .limit(1);
  return !!row;
}

export async function insertShopifyQueueFromPaid(
  mapped: MappedShopifyQueueInsert,
): Promise<void> {
  const db = getDb();
  await db.insert(shopifyQueue).values({
    shopifyOrderId: mapped.shopify_order_id,
    shopifyOrderNumber: mapped.shopify_order_number,
    rawPayload: mapped.raw_payload,
    recipientName: mapped.recipient_name,
    recipientPhone: mapped.recipient_phone,
    recipientEmail: mapped.recipient_email,
    deliveryAddress: mapped.delivery_address,
    items: mapped.items,
    orderTotal: mapped.order_total,
    status: "pending_review",
    updatedAt: new Date(),
  });
}

export async function handleShopifyOrdersCancelled(
  payload: ShopifyOrderPayload,
): Promise<void> {
  const shopifyOrderId = String(payload.id);
  const db = getDb();

  const [row] = await db
    .select()
    .from(shopifyQueue)
    .where(eq(shopifyQueue.shopifyOrderId, shopifyOrderId))
    .limit(1);

  if (!row) return;

  if (row.status === "pending_review") {
    await db
      .update(shopifyQueue)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(shopifyQueue.id, row.id));
    return;
  }

  if (row.status === "approved" && row.createdOrderId) {
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, row.createdOrderId))
      .limit(1);

    if (!orderRow) return;

    if (orderRow.status === "pending" || orderRow.status === "assigned") {
      // neon-http: no transaction — order status only (delivery unchanged per milestone).
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(orders.id, orderRow.id));
      return;
    }

    if (
      orderRow.status === "in_transit" ||
      orderRow.status === "completed" ||
      orderRow.status === "attempted"
    ) {
      await db
        .update(orders)
        .set({
          specialInstructions: mergeShopifyCancelNote(
            orderRow.specialInstructions,
          ),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderRow.id));
    }
  }
}

function buildListWhere(opts: {
  status?: string;
  search?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (opts.status && opts.status !== "all") {
    parts.push(
      eq(shopifyQueue.status, opts.status as ShopifyQueueEntryStatus),
    );
  }
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    parts.push(
      or(
        ilike(shopifyQueue.recipientName, q),
        ilike(shopifyQueue.deliveryAddress, q),
        ilike(shopifyQueue.shopifyOrderNumber, q),
      ) as SQL,
    );
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listShopifyQueueEntries(params: {
  page: number;
  status?: string;
  search?: string;
}): Promise<PaginatedShopifyQueueResponse> {
  const db = getDb();
  const page = Math.max(1, params.page);
  const whereClause = buildListWhere({
    status: params.status,
    search: params.search,
  });

  const countBase = db.select({ total: count() }).from(shopifyQueue);
  const [countRow] = whereClause
    ? await countBase.where(whereClause)
    : await countBase;

  const total = Number(countRow?.total ?? 0);
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const listBase = db
    .select({
      row: shopifyQueue,
    })
    .from(shopifyQueue)
    .orderBy(desc(shopifyQueue.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows = whereClause
    ? await listBase.where(whereClause)
    : await listBase;

  const items: ShopifyQueueListRowDto[] = rows.map((r) => ({
    id: r.row.id,
    shopify_order_number: r.row.shopifyOrderNumber,
    recipient_name: r.row.recipientName,
    delivery_address: r.row.deliveryAddress,
    items_count: itemsCount(r.row.items),
    order_total: r.row.orderTotal,
    created_at: toIso(r.row.createdAt),
    status: r.row.status,
  }));

  return {
    items,
    page,
    page_size: PAGE_SIZE,
    total,
    total_pages,
  };
}

export async function getShopifyQueueEntry(
  id: string,
): Promise<ShopifyQueueDetailDto | null> {
  const db = getDb();
  const [row] = await db
    .select({
      entry: shopifyQueue,
      reviewerName: reviewerUser.name,
    })
    .from(shopifyQueue)
    .leftJoin(reviewerUser, eq(shopifyQueue.reviewedBy, reviewerUser.id))
    .where(eq(shopifyQueue.id, id))
    .limit(1);

  if (!row) return null;

  const e = row.entry;
  return {
    id: e.id,
    shopify_order_id: e.shopifyOrderId,
    shopify_order_number: e.shopifyOrderNumber,
    recipient_name: e.recipientName,
    recipient_phone: e.recipientPhone,
    recipient_email: e.recipientEmail,
    delivery_address: e.deliveryAddress,
    items: e.items,
    order_total: e.orderTotal,
    status: e.status,
    notes: e.notes,
    reviewed_at: e.reviewedAt ? toIso(e.reviewedAt) : null,
    reviewer_name: row.reviewerName,
    created_order_id: e.createdOrderId,
    created_at: toIso(e.createdAt),
    updated_at: toIso(e.updatedAt),
    raw_payload: e.rawPayload,
  };
}

export async function approveShopifyQueueEntry(
  queueId: string,
  userId: string,
): Promise<{ orderId: string } | null> {
  const db = getDb();
  const [q] = await db
    .select()
    .from(shopifyQueue)
    .where(eq(shopifyQueue.id, queueId))
    .limit(1);

  if (!q || q.status !== "pending_review") return null;

  const orderItems: OrderItemLine[] = q.items.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    ...(line.variant_title != null && line.variant_title !== ""
      ? { variant_title: line.variant_title }
      : {}),
  }));

  // Sequential writes — neon-http has no transaction (see lib/db.ts).
  const [inserted] = await db
    .insert(orders)
    .values({
      source: "shopify",
      shopifyOrderId: q.shopifyOrderId,
      shopifyOrderNumber: q.shopifyOrderNumber,
      recipientName: q.recipientName,
      recipientPhone: q.recipientPhone,
      recipientEmail: q.recipientEmail,
      deliveryAddress: q.deliveryAddress,
      items: orderItems,
      specialInstructions: null,
      status: "pending",
    })
    .returning({ id: orders.id });

  if (!inserted) return null;

  await db
    .update(shopifyQueue)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: userId,
      createdOrderId: inserted.id,
      updatedAt: new Date(),
    })
    .where(eq(shopifyQueue.id, queueId));

  return { orderId: inserted.id };
}

export async function rejectShopifyQueueEntry(
  queueId: string,
  userId: string,
  notes?: string | null,
): Promise<ShopifyQueueDetailDto | null> {
  const db = getDb();
  const [q] = await db
    .select()
    .from(shopifyQueue)
    .where(eq(shopifyQueue.id, queueId))
    .limit(1);

  if (!q || q.status !== "pending_review") return null;

  await db
    .update(shopifyQueue)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: userId,
      notes: notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(shopifyQueue.id, queueId));

  return getShopifyQueueEntry(queueId);
}
