import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deliveries, orders, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { countPendingShopifyQueue } from "@/lib/data/shopify-queue";
import {
  countPodsSubmittedTodayUtc,
  getPodSummaryForOrderDelivery,
} from "@/lib/data/pods";
import type {
  DashboardStatsResponse,
  DeliveryDetailDto,
  DriverPublicDto,
  OrderCoreDto,
  OrderDetailResponse,
  OrderItemLine,
  OrderListRow,
  OrderStatus,
  PaginatedOrdersResponse,
  PodSummaryDto,
} from "@/lib/types/order";

const PAGE_SIZE = 50;

const driverUser = alias(users, "driver");

function utcDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start, end };
}

function toIso(d: Date): string {
  return d.toISOString();
}

function mapOrderCore(row: typeof orders.$inferSelect): OrderCoreDto {
  return {
    id: row.id,
    source: row.source,
    shopifyOrderId: row.shopifyOrderId,
    shopifyOrderNumber: row.shopifyOrderNumber,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    recipientEmail: row.recipientEmail,
    deliveryAddress: row.deliveryAddress,
    items: row.items,
    specialInstructions: row.specialInstructions,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function itemsCount(items: OrderItemLine[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function buildOrderWhere(opts: {
  status?: OrderStatus;
  search?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (opts.status) {
    parts.push(eq(orders.status, opts.status));
  }
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    parts.push(
      or(
        ilike(orders.recipientName, q),
        ilike(orders.deliveryAddress, q),
      ) as SQL,
    );
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listOrdersData(params: {
  status?: OrderStatus;
  page: number;
  search?: string;
}): Promise<PaginatedOrdersResponse> {
  const db = getDb();
  const page = Math.max(1, params.page);
  const whereClause = buildOrderWhere({
    status: params.status,
    search: params.search,
  });

  const countBase = db.select({ total: count() }).from(orders);
  const [countRow] = whereClause
    ? await countBase.where(whereClause)
    : await countBase;

  const totalCount = Number(countRow?.total ?? 0);

  const listBase = db
    .select({
      order: orders,
      driverName: driverUser.name,
      driverId: driverUser.id,
    })
    .from(orders)
    .leftJoin(deliveries, eq(orders.id, deliveries.orderId))
    .leftJoin(driverUser, eq(deliveries.driverId, driverUser.id))
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows = whereClause
    ? await listBase.where(whereClause)
    : await listBase;

  const orderRows: OrderListRow[] = rows.map((r) => ({
    id: r.order.id,
    recipientName: r.order.recipientName,
    deliveryAddress: r.order.deliveryAddress,
    items: r.order.items,
    itemsCount: itemsCount(r.order.items),
    status: r.order.status,
    source: r.order.source,
    driverName: r.driverName,
    driverId: r.driverId,
    createdAt: toIso(r.order.createdAt),
  }));

  return {
    orders: orderRows,
    page,
    pageSize: PAGE_SIZE,
    totalCount,
  };
}

export async function listTodayOrdersData(): Promise<OrderListRow[]> {
  const { start, end } = utcDayBounds();
  const db = getDb();
  const whereClause = and(
    gte(orders.createdAt, start),
    lte(orders.createdAt, end),
  );

  const rows = await db
    .select({
      order: orders,
      driverName: driverUser.name,
      driverId: driverUser.id,
    })
    .from(orders)
    .leftJoin(deliveries, eq(orders.id, deliveries.orderId))
    .leftJoin(driverUser, eq(deliveries.driverId, driverUser.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({
    id: r.order.id,
    recipientName: r.order.recipientName,
    deliveryAddress: r.order.deliveryAddress,
    items: r.order.items,
    itemsCount: itemsCount(r.order.items),
    status: r.order.status,
    source: r.order.source,
    driverName: r.driverName,
    driverId: r.driverId,
    createdAt: toIso(r.order.createdAt),
  }));
}

export async function getDashboardStatsData(): Promise<DashboardStatsResponse> {
  const db = getDb();
  const { start, end } = utcDayBounds();

  const [totalRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)));

  const [completedRow] = await db
    .select({ total: count() })
    .from(orders)
    .innerJoin(deliveries, eq(orders.id, deliveries.orderId))
    .where(
      and(
        eq(orders.status, "completed"),
        isNotNull(deliveries.completedAt),
        gte(deliveries.completedAt, start),
        lte(deliveries.completedAt, end),
      ),
    );

  const [inTransitRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.status, "in_transit"));

  const [pendingRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.status, "pending"));

  const pods_today = await countPodsSubmittedTodayUtc();
  const shopify_pending = await countPendingShopifyQueue();

  return {
    total_today: Number(totalRow?.total ?? 0),
    completed_today: Number(completedRow?.total ?? 0),
    in_transit: Number(inTransitRow?.total ?? 0),
    pending_assignment: Number(pendingRow?.total ?? 0),
    pods_today,
    shopify_pending,
  };
}

export async function getActiveDriversData(): Promise<DriverPublicDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.role, "driver"), eq(users.isActive, true)))
    .orderBy(users.name);

  return rows;
}

async function validateDriverId(driverId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, driverId),
        eq(users.role, "driver"),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getOrderDetailData(
  orderId: string,
): Promise<OrderDetailResponse | null> {
  const db = getDb();
  const [orderRow] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return null;

  const [deliveryRow] = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
    .limit(1);

  let driverDto: DriverPublicDto | null = null;
  if (deliveryRow) {
    const [du] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, deliveryRow.driverId))
      .limit(1);
    if (du) driverDto = du;
  }

  let podDto: PodSummaryDto | null = null;
  if (deliveryRow) {
    podDto = await getPodSummaryForOrderDelivery(deliveryRow.id);
  }

  const deliveryDto: DeliveryDetailDto | null = deliveryRow
    ? {
        id: deliveryRow.id,
        orderId: deliveryRow.orderId,
        driverId: deliveryRow.driverId,
        status: deliveryRow.status,
        assignedAt: toIso(deliveryRow.assignedAt),
        startedAt: deliveryRow.startedAt
          ? toIso(deliveryRow.startedAt)
          : null,
        arrivedAt: deliveryRow.arrivedAt ? toIso(deliveryRow.arrivedAt) : null,
        completedAt: deliveryRow.completedAt
          ? toIso(deliveryRow.completedAt)
          : null,
      }
    : null;

  return {
    order: mapOrderCore(orderRow),
    delivery: deliveryDto,
    driver: driverDto,
    pod: podDto,
  };
}

export async function createOrderData(input: {
  recipient_name: string;
  delivery_address: string;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  items?: OrderItemLine[];
  special_instructions?: string | null;
  driver_id?: string | null;
}): Promise<OrderDetailResponse> {
  const items = input.items?.length ? input.items : [];
  const db = getDb();

  if (input.driver_id) {
    const ok = await validateDriverId(input.driver_id);
    if (!ok) {
      throw new Error("Invalid driver");
    }
  }

  if (input.driver_id) {
    // neon-http has no transactions — sequential writes (see lib/db.ts).
    const [o] = await db
      .insert(orders)
      .values({
        source: "manual",
        recipientName: input.recipient_name,
        deliveryAddress: input.delivery_address,
        recipientPhone: input.recipient_phone ?? null,
        recipientEmail: input.recipient_email ?? null,
        items,
        specialInstructions: input.special_instructions ?? null,
        status: "assigned",
      })
      .returning();

    if (!o) throw new Error("Insert failed");

    await db.insert(deliveries).values({
      orderId: o.id,
      driverId: input.driver_id!,
      status: "assigned",
    });

    const detail = await getOrderDetailData(o.id);
    if (!detail) throw new Error("Load failed");
    return detail;
  }

  const [o] = await db
    .insert(orders)
    .values({
      source: "manual",
      recipientName: input.recipient_name,
      deliveryAddress: input.delivery_address,
      recipientPhone: input.recipient_phone ?? null,
      recipientEmail: input.recipient_email ?? null,
      items,
      specialInstructions: input.special_instructions ?? null,
      status: "pending",
    })
    .returning();

  if (!o) throw new Error("Insert failed");
  const detail = await getOrderDetailData(o.id);
  if (!detail) throw new Error("Load failed");
  return detail;
}

export async function updateOrderData(
  orderId: string,
  patch: {
    recipient_name?: string;
    recipient_phone?: string | null;
    recipient_email?: string | null;
    delivery_address?: string;
    items?: OrderItemLine[];
    special_instructions?: string | null;
  },
): Promise<OrderDetailResponse | null> {
  const db = getDb();
  const [existing] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) return null;
  if (
    existing.status === "in_transit" ||
    existing.status === "completed" ||
    existing.status === "attempted" ||
    existing.status === "cancelled"
  ) {
    throw new Error("NOT_EDITABLE");
  }

  const sets: Partial<typeof orders.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.recipient_name !== undefined)
    sets.recipientName = patch.recipient_name;
  if (patch.recipient_phone !== undefined)
    sets.recipientPhone = patch.recipient_phone;
  if (patch.recipient_email !== undefined)
    sets.recipientEmail = patch.recipient_email;
  if (patch.delivery_address !== undefined)
    sets.deliveryAddress = patch.delivery_address;
  if (patch.items !== undefined) sets.items = patch.items;
  if (patch.special_instructions !== undefined)
    sets.specialInstructions = patch.special_instructions;

  await db.update(orders).set(sets).where(eq(orders.id, orderId));

  return getOrderDetailData(orderId);
}

export async function assignDriverData(
  orderId: string,
  driverId: string,
): Promise<OrderDetailResponse | null> {
  const ok = await validateDriverId(driverId);
  if (!ok) throw new Error("Invalid driver");

  const db = getDb();
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) return null;
  if (existing.status === "cancelled") return null;

  const [delRow] = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
    .limit(1);

  if (!delRow) {
    // neon-http has no transactions — sequential writes (see lib/db.ts).
    await db.insert(deliveries).values({
      orderId,
      driverId,
      status: "assigned",
    });
    await db
      .update(orders)
      .set({ status: "assigned", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  } else {
    await db
      .update(deliveries)
      .set({ driverId })
      .where(eq(deliveries.id, delRow.id));
    await db
      .update(orders)
      .set({ status: "assigned", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }

  return getOrderDetailData(orderId);
}
