import { and, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { deliveries, orders, podPhotos, pods } from "@/db/schema";
import { getDb } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import type { OrderItemLine, PodType } from "@/lib/types/order";
import type {
  CompletedDeliveryRow,
  DriverDeliveryRow,
  DriverOrderSummary,
  DriverPodCreatedResponse,
} from "@/lib/types/delivery";

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

function mapOrderSummary(row: typeof orders.$inferSelect): DriverOrderSummary {
  return {
    id: row.id,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    recipientEmail: row.recipientEmail,
    deliveryAddress: row.deliveryAddress,
    items: row.items as OrderItemLine[],
    specialInstructions: row.specialInstructions,
    status: row.status,
  };
}

function mapDeliveryRow(
  d: typeof deliveries.$inferSelect,
  order: typeof orders.$inferSelect,
): DriverDeliveryRow {
  return {
    id: d.id,
    orderId: d.orderId,
    driverId: d.driverId,
    status: d.status,
    assignedAt: toIso(d.assignedAt),
    startedAt: d.startedAt ? toIso(d.startedAt) : null,
    arrivedAt: d.arrivedAt ? toIso(d.arrivedAt) : null,
    completedAt: d.completedAt ? toIso(d.completedAt) : null,
    order: mapOrderSummary(order),
  };
}

export async function listTodayDeliveriesForDriver(
  driverId: string,
): Promise<DriverDeliveryRow[]> {
  const db = getDb();
  const { start, end } = utcDayBounds();

  const rows = await db
    .select({ delivery: deliveries, order: orders })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(
      and(
        eq(deliveries.driverId, driverId),
        inArray(deliveries.status, ["assigned", "in_transit"]),
        gte(deliveries.assignedAt, start),
        lte(deliveries.assignedAt, end),
      ),
    )
    .orderBy(deliveries.assignedAt);

  return rows.map((r) => mapDeliveryRow(r.delivery, r.order));
}

export async function getDeliveryForDriver(
  deliveryId: string,
  driverId: string,
): Promise<DriverDeliveryRow | null> {
  const db = getDb();
  const [row] = await db
    .select({ delivery: deliveries, order: orders })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.driverId, driverId)))
    .limit(1);

  if (!row) return null;
  return mapDeliveryRow(row.delivery, row.order);
}

export async function startDeliveryForDriver(
  deliveryId: string,
  driverId: string,
): Promise<DriverDeliveryRow | null> {
  const db = getDb();
  const [existing] = await db
    .select({ delivery: deliveries, order: orders })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.driverId, driverId)))
    .limit(1);

  if (!existing) return null;
  if (existing.delivery.status !== "assigned") {
    throw new Error("INVALID_STATE");
  }

  const now = new Date();
  // neon-http: no transaction — sequential updates; partial failure possible.
  await db
    .update(deliveries)
    .set({
      status: "in_transit",
      startedAt: now,
    })
    .where(eq(deliveries.id, deliveryId));

  await db
    .update(orders)
    .set({ status: "in_transit", updatedAt: now })
    .where(eq(orders.id, existing.delivery.orderId));

  const updated = await getDeliveryForDriver(deliveryId, driverId);
  return updated;
}

export async function arriveDeliveryForDriver(
  deliveryId: string,
  driverId: string,
): Promise<DriverDeliveryRow | null> {
  const db = getDb();
  const [existing] = await db
    .select({ delivery: deliveries, order: orders })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.driverId, driverId)))
    .limit(1);

  if (!existing) return null;
  if (existing.delivery.status !== "in_transit") {
    throw new Error("INVALID_STATE");
  }

  const now = new Date();
  await db
    .update(deliveries)
    .set({ arrivedAt: now })
    .where(eq(deliveries.id, deliveryId));

  return getDeliveryForDriver(deliveryId, driverId);
}

export type CreatePodInput = {
  podType: PodType;
  receiverName: string | null;
  signaturePng: Uint8Array | null;
  photos: Uint8Array[];
  gpsLat: string | null;
  gpsLng: string | null;
  notes: string | null;
};

export async function createPodForDriver(
  deliveryId: string,
  driverId: string,
  input: CreatePodInput,
): Promise<DriverPodCreatedResponse | null> {
  const db = getDb();
  const [scoped] = await db
    .select({ delivery: deliveries, order: orders })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.driverId, driverId)))
    .limit(1);

  if (!scoped) return null;
  if (scoped.delivery.status !== "in_transit" || !scoped.delivery.arrivedAt) {
    throw new Error("INVALID_STATE");
  }

  const [existingPod] = await db
    .select({ id: pods.id })
    .from(pods)
    .where(eq(pods.deliveryId, deliveryId))
    .limit(1);
  if (existingPod) throw new Error("POD_EXISTS");

  if (input.podType === "signed") {
    if (!input.receiverName?.trim()) throw new Error("VALIDATION");
    if (!input.signaturePng || input.signaturePng.length === 0)
      throw new Error("VALIDATION");
    if (input.photos.length === 0) throw new Error("VALIDATION");
  } else {
    if (input.photos.length === 0) throw new Error("VALIDATION");
  }

  const photoKeys: string[] = [];

  let signatureKey: string | null = null;
  if (input.podType === "signed" && input.signaturePng) {
    signatureKey = `pods/${deliveryId}/signature.png`;
    await uploadToR2(signatureKey, input.signaturePng, "image/png");
  }

  for (let i = 0; i < input.photos.length; i++) {
    const id = crypto.randomUUID();
    const key = `pods/${deliveryId}/photos/${id}.jpg`;
    await uploadToR2(key, input.photos[i], "image/jpeg");
    photoKeys.push(key);
  }

  const now = new Date();
  const [podRow] = await db
    .insert(pods)
    .values({
      deliveryId,
      podType: input.podType,
      receiverName: input.receiverName?.trim() ?? null,
      signatureUrl: signatureKey,
      gpsLat: input.gpsLat ?? null,
      gpsLng: input.gpsLng ?? null,
      submittedAt: now,
    })
    .returning();

  if (!podRow) throw new Error("INSERT_FAILED");

  for (const key of photoKeys) {
    await db.insert(podPhotos).values({
      podId: podRow.id,
      photoUrl: key,
    });
  }

  const deliveryStatus =
    input.podType === "signed" ? ("completed" as const) : ("attempted" as const);
  const orderStatus =
    input.podType === "signed" ? ("completed" as const) : ("attempted" as const);

  await db
    .update(deliveries)
    .set({
      status: deliveryStatus,
      completedAt: now,
      notes: input.notes?.trim() ?? null,
    })
    .where(eq(deliveries.id, deliveryId));

  await db
    .update(orders)
    .set({ status: orderStatus, updatedAt: now })
    .where(eq(orders.id, scoped.delivery.orderId));

  return {
    pod: {
      id: podRow.id,
      deliveryId: podRow.deliveryId,
      podType: podRow.podType,
      receiverName: podRow.receiverName,
      signatureUrl: podRow.signatureUrl,
      gpsLat: podRow.gpsLat != null ? String(podRow.gpsLat) : null,
      gpsLng: podRow.gpsLng != null ? String(podRow.gpsLng) : null,
      submittedAt: toIso(podRow.submittedAt),
    },
    photoKeys,
  };
}

export type CompletedDeliveryData = Omit<
  CompletedDeliveryRow,
  "signatureSignedUrl" | "photos"
> & {
  signatureKey: string | null;
  photoKeys: { id: string; key: string }[];
};

export async function listCompletedDeliveriesForDriver(
  driverId: string,
  days = 30,
): Promise<CompletedDeliveryData[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const deliveryRows = await db
    .select({ delivery: deliveries, order: orders, pod: pods })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(pods, eq(pods.deliveryId, deliveries.id))
    .where(
      and(
        eq(deliveries.driverId, driverId),
        inArray(deliveries.status, ["completed", "attempted"]),
        isNotNull(deliveries.completedAt),
        gte(deliveries.completedAt, cutoff),
      ),
    )
    .orderBy(desc(deliveries.completedAt));

  const result: CompletedDeliveryData[] = [];

  for (const row of deliveryRows) {
    const photos = await db
      .select({ id: podPhotos.id, photoUrl: podPhotos.photoUrl })
      .from(podPhotos)
      .where(eq(podPhotos.podId, row.pod.id))
      .orderBy(podPhotos.uploadedAt);

    result.push({
      deliveryId: row.delivery.id,
      orderId: row.order.id,
      recipientName: row.order.recipientName,
      deliveryAddress: row.order.deliveryAddress,
      completedAt: row.delivery.completedAt
        ? toIso(row.delivery.completedAt)
        : toIso(row.pod.submittedAt),
      podType: row.pod.podType,
      signatureKey: row.pod.signatureUrl,
      photoKeys: photos.map((p) => ({ id: p.id, key: p.photoUrl })),
    });
  }

  return result;
}
