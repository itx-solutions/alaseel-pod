import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deliveries, orders, podPhotos, pods, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import type { PodDetailResponse, PaginatedPodsResponse, PodListRowDto } from "@/lib/types/pod";
import type { PodSummaryDto, PodType } from "@/lib/types/order";

const PAGE_SIZE = 50;

const driverUser = alias(users, "pod_driver");

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

function numericToNumber(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseUtcDayStart(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0),
  );
}

function parseUtcDayEnd(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999),
  );
}

function buildListWhere(opts: {
  type?: PodType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): SQL | undefined {
  const parts: SQL[] = [];

  if (opts.type) {
    parts.push(eq(pods.podType, opts.type));
  }

  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    parts.push(
      or(
        ilike(orders.recipientName, q),
        ilike(orders.deliveryAddress, q),
        ilike(pods.receiverName, q),
      ) as SQL,
    );
  }

  if (opts.dateFrom) {
    const start = parseUtcDayStart(opts.dateFrom);
    if (start) parts.push(gte(pods.submittedAt, start));
  }
  if (opts.dateTo) {
    const end = parseUtcDayEnd(opts.dateTo);
    if (end) parts.push(lte(pods.submittedAt, end));
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listPodsForBackOffice(params: {
  page: number;
  type?: PodType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PaginatedPodsResponse> {
  const db = getDb();
  const page = Math.max(1, params.page);
  const whereClause = buildListWhere({
    type: params.type,
    search: params.search,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const countBase = db
    .select({ total: count() })
    .from(pods)
    .innerJoin(deliveries, eq(pods.deliveryId, deliveries.id))
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(driverUser, eq(deliveries.driverId, driverUser.id));

  const [countRow] = whereClause
    ? await countBase.where(whereClause)
    : await countBase;

  const total = Number(countRow?.total ?? 0);
  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const listBase = db
    .select({
      pod: pods,
      orderRecipientName: orders.recipientName,
      deliveryAddress: orders.deliveryAddress,
      orderId: orders.id,
      driverName: driverUser.name,
    })
    .from(pods)
    .innerJoin(deliveries, eq(pods.deliveryId, deliveries.id))
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(driverUser, eq(deliveries.driverId, driverUser.id))
    .orderBy(desc(pods.submittedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows = whereClause
    ? await listBase.where(whereClause)
    : await listBase;

  const podIds = rows.map((r) => r.pod.id);
  const photoCountMap = new Map<string, number>();
  if (podIds.length > 0) {
    const countRows = await db
      .select({
        podId: podPhotos.podId,
        n: count(),
      })
      .from(podPhotos)
      .where(inArray(podPhotos.podId, podIds))
      .groupBy(podPhotos.podId);
    for (const cr of countRows) {
      photoCountMap.set(cr.podId, Number(cr.n));
    }
  }

  const items: PodListRowDto[] = rows.map((r) => ({
    id: r.pod.id,
    pod_type: r.pod.podType,
    receiver_name: r.pod.receiverName,
    submitted_at: toIso(r.pod.submittedAt),
    gps_lat: numericToNumber(r.pod.gpsLat),
    gps_lng: numericToNumber(r.pod.gpsLng),
    delivery_address: r.deliveryAddress,
    order_recipient_name: r.orderRecipientName,
    driver_name: r.driverName,
    photo_count: photoCountMap.get(r.pod.id) ?? 0,
    order_id: r.orderId,
  }));

  return {
    items,
    page,
    page_size: PAGE_SIZE,
    total,
    total_pages,
  };
}

type PodDetailRaw = {
  pod: typeof pods.$inferSelect;
  delivery: typeof deliveries.$inferSelect;
  order: typeof orders.$inferSelect;
  driverName: string;
  photos: { id: string; photoUrl: string; uploadedAt: Date }[];
};

async function loadPodDetailRaw(podId: string): Promise<PodDetailRaw | null> {
  const db = getDb();
  const [row] = await db
    .select({
      pod: pods,
      delivery: deliveries,
      order: orders,
      driverName: driverUser.name,
    })
    .from(pods)
    .innerJoin(deliveries, eq(pods.deliveryId, deliveries.id))
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(driverUser, eq(deliveries.driverId, driverUser.id))
    .where(eq(pods.id, podId))
    .limit(1);

  if (!row) return null;

  const photos = await db
    .select({
      id: podPhotos.id,
      photoUrl: podPhotos.photoUrl,
      uploadedAt: podPhotos.uploadedAt,
    })
    .from(podPhotos)
    .where(eq(podPhotos.podId, podId))
    .orderBy(asc(podPhotos.uploadedAt));

  return {
    pod: row.pod,
    delivery: row.delivery,
    order: row.order,
    driverName: row.driverName,
    photos: photos.map((p) => ({
      id: p.id,
      photoUrl: p.photoUrl,
      uploadedAt: p.uploadedAt,
    })),
  };
}

export async function getPodDetailForBackOffice(
  podId: string,
): Promise<PodDetailResponse | null> {
  const raw = await loadPodDetailRaw(podId);
  if (!raw) return null;

  let signature_signed_url: string | null = null;
  if (raw.pod.podType === "signed" && raw.pod.signatureUrl) {
    signature_signed_url = await getSignedR2Url(raw.pod.signatureUrl, 3600);
  }

  const photo_signed_urls = await Promise.all(
    raw.photos.map(async (p) => ({
      id: p.id,
      url: await getSignedR2Url(p.photoUrl, 3600),
      uploaded_at: toIso(p.uploadedAt),
    })),
  );

  return {
    pod: {
      id: raw.pod.id,
      delivery_id: raw.pod.deliveryId,
      pod_type: raw.pod.podType,
      receiver_name: raw.pod.receiverName,
      submitted_at: toIso(raw.pod.submittedAt),
      gps_lat: numericToNumber(raw.pod.gpsLat),
      gps_lng: numericToNumber(raw.pod.gpsLng),
    },
    delivery: {
      id: raw.delivery.id,
      order_id: raw.delivery.orderId,
      driver_id: raw.delivery.driverId,
      notes: raw.delivery.notes,
    },
    order: {
      id: raw.order.id,
      recipient_name: raw.order.recipientName,
      recipient_phone: raw.order.recipientPhone,
      recipient_email: raw.order.recipientEmail,
      delivery_address: raw.order.deliveryAddress,
      items: raw.order.items,
      special_instructions: raw.order.specialInstructions,
    },
    driver_name: raw.driverName,
    signature_signed_url,
    photo_signed_urls,
  };
}

export async function getPodSummaryForOrderDelivery(
  deliveryId: string,
): Promise<PodSummaryDto | null> {
  const db = getDb();
  const [podRow] = await db
    .select({
      id: pods.id,
      podType: pods.podType,
      receiverName: pods.receiverName,
      submittedAt: pods.submittedAt,
      signatureUrl: pods.signatureUrl,
    })
    .from(pods)
    .where(eq(pods.deliveryId, deliveryId))
    .limit(1);

  if (!podRow) return null;

  const [countRow] = await db
    .select({ n: count() })
    .from(podPhotos)
    .where(eq(podPhotos.podId, podRow.id));

  const photo_count = Number(countRow?.n ?? 0);

  let signature_thumbnail_url: string | null = null;
  if (podRow.podType === "signed" && podRow.signatureUrl) {
    signature_thumbnail_url = await getSignedR2Url(podRow.signatureUrl, 3600);
  }

  return {
    id: podRow.id,
    podType: podRow.podType,
    receiverName: podRow.receiverName,
    submittedAt: toIso(podRow.submittedAt),
    photo_count,
    signature_thumbnail_url,
  };
}

export async function countPodsSubmittedTodayUtc(): Promise<number> {
  const db = getDb();
  const { start, end } = utcDayBounds();
  const [row] = await db
    .select({ n: count() })
    .from(pods)
    .where(and(gte(pods.submittedAt, start), lte(pods.submittedAt, end)));
  return Number(row?.n ?? 0);
}
