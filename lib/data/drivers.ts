import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { deliveries, orders, users, vehicles } from "@/db/schema";
import { getDb } from "@/lib/db";
import type {
  DriverDeliveryStats,
  DriverDetailView,
  DriverListItemDto,
  DriverOwnProfileResponse,
  DriverRecentDeliveryRow,
  DriverUserRecordDto,
  DriverVehicleSummaryDto,
  DriverWithVehicleResponse,
} from "@/lib/types/driver";

function completionRate(completed: number, attempted: number): number | null {
  const den = completed + attempted;
  if (den === 0) return null;
  return Math.round((completed / den) * 10000) / 100;
}

function coerceIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  const d =
    value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function rowToUserDto(row: typeof users.$inferSelect): DriverUserRecordDto {
  if (row.role !== "driver") {
    throw new Error("Expected driver role");
  }
  const phone = row.phone?.trim() || null;
  return {
    id: row.id,
    clerkId: row.clerkId,
    role: "driver",
    name: row.name,
    email: row.email,
    phone,
    vehicleId: row.vehicleId ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

async function fetchDriverWithVehicle(
  driverId: string,
): Promise<DriverWithVehicleResponse | null> {
  const db = getDb();
  const [row] = await db
    .select({
      user: users,
      vid: vehicles.id,
      vmake: vehicles.make,
      vmodel: vehicles.model,
      vcolour: vehicles.colour,
      vrego: vehicles.rego,
      vyear: vehicles.year,
    })
    .from(users)
    .leftJoin(vehicles, eq(users.vehicleId, vehicles.id))
    .where(and(eq(users.id, driverId), eq(users.role, "driver")))
    .limit(1);

  if (!row) return null;
  const base = rowToUserDto(row.user);
  const vehicle: DriverVehicleSummaryDto | null =
    row.vid != null
      ? {
          id: row.vid,
          make: row.vmake!,
          model: row.vmodel!,
          colour: row.vcolour!,
          rego: row.vrego!,
          year: row.vyear,
        }
      : null;
  return { ...base, vehicle };
}

async function statsForDriverIds(
  db: ReturnType<typeof getDb>,
  driverIds: string[],
): Promise<Map<string, DriverDeliveryStats>> {
  const map = new Map<string, DriverDeliveryStats>();
  if (driverIds.length === 0) return map;

  const rows = await db
    .select({
      driverId: deliveries.driverId,
      totalDeliveries: sql<number>`cast(count(*) as int)`,
      completedDeliveries: sql<number>`coalesce(sum(case when ${deliveries.status} = 'completed' then 1 else 0 end), 0)::int`,
      attemptedDeliveries: sql<number>`coalesce(sum(case when ${deliveries.status} = 'attempted' then 1 else 0 end), 0)::int`,
      lastDeliveryAt: sql<string | null>`max(coalesce(${deliveries.completedAt}, ${deliveries.assignedAt}))`,
    })
    .from(deliveries)
    .where(inArray(deliveries.driverId, driverIds))
    .groupBy(deliveries.driverId);

  for (const r of rows) {
    const c = Number(r.completedDeliveries ?? 0);
    const a = Number(r.attemptedDeliveries ?? 0);
    const total = Number(r.totalDeliveries ?? 0);
    map.set(r.driverId, {
      totalDeliveries: total,
      completedDeliveries: c,
      attemptedDeliveries: a,
      completionRate: completionRate(c, a),
      lastDeliveryAt: coerceIsoTimestamp(r.lastDeliveryAt),
    });
  }

  for (const id of driverIds) {
    if (!map.has(id)) {
      map.set(id, {
        totalDeliveries: 0,
        completedDeliveries: 0,
        attemptedDeliveries: 0,
        completionRate: null,
        lastDeliveryAt: null,
      });
    }
  }

  return map;
}

/** All drivers (active + inactive) with delivery stats. Sorted: active first, then name. */
export async function listDriversWithStats(): Promise<DriverListItemDto[]> {
  const db = getDb();
  const driverRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "driver"));

  const statsMap = await statsForDriverIds(
    db,
    driverRows.map((r) => r.id),
  );

  const out: DriverListItemDto[] = driverRows.map((u) => {
    const s = statsMap.get(u.id)!;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      ...s,
    };
  });

  out.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return out;
}

export async function getDriverByIdForBackOffice(
  id: string,
): Promise<DriverListItemDto | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "driver")))
    .limit(1);

  if (!row) return null;

  const statsMap = await statsForDriverIds(db, [row.id]);
  const s = statsMap.get(row.id)!;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    ...s,
  };
}

export async function getDriverRecentDeliveries(
  driverId: string,
  limit: number,
): Promise<DriverRecentDeliveryRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      deliveryId: deliveries.id,
      orderId: orders.id,
      recipientName: orders.recipientName,
      deliveryAddress: orders.deliveryAddress,
      status: deliveries.status,
      assignedAt: deliveries.assignedAt,
      completedAt: deliveries.completedAt,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(eq(deliveries.driverId, driverId))
    .orderBy(
      desc(
        sql`coalesce(${deliveries.completedAt}, ${deliveries.assignedAt})`,
      ),
    )
    .limit(limit);

  return rows.map((r) => {
    const displayAt = (r.completedAt ?? r.assignedAt).toISOString();
    return {
      deliveryId: r.deliveryId,
      orderId: r.orderId,
      recipientName: r.recipientName,
      deliveryAddress: r.deliveryAddress,
      status: r.status,
      displayAt,
    };
  });
}

export async function getDriverDetailView(
  id: string,
): Promise<DriverDetailView | null> {
  const base = await getDriverByIdForBackOffice(id);
  if (!base) return null;

  const db = getDb();
  const [joinRow] = await db
    .select({
      phone: users.phone,
      vid: vehicles.id,
      vmake: vehicles.make,
      vmodel: vehicles.model,
      vcolour: vehicles.colour,
      vrego: vehicles.rego,
      vyear: vehicles.year,
    })
    .from(users)
    .leftJoin(vehicles, eq(users.vehicleId, vehicles.id))
    .where(and(eq(users.id, id), eq(users.role, "driver")))
    .limit(1);

  const recentDeliveries = await getDriverRecentDeliveries(id, 20);

  const vehicle: DriverVehicleSummaryDto | null =
    joinRow?.vid != null
      ? {
          id: joinRow.vid,
          make: joinRow.vmake!,
          model: joinRow.vmodel!,
          colour: joinRow.vcolour!,
          rego: joinRow.vrego!,
          year: joinRow.vyear,
        }
      : null;

  return {
    id: base.id,
    name: base.name,
    email: base.email,
    phone: joinRow?.phone?.trim() || null,
    isActive: base.isActive,
    createdAt: base.createdAt,
    stats: {
      totalDeliveries: base.totalDeliveries,
      completedDeliveries: base.completedDeliveries,
      attemptedDeliveries: base.attemptedDeliveries,
      completionRate: base.completionRate,
      lastDeliveryAt: base.lastDeliveryAt,
    },
    recentDeliveries,
    vehicle,
  };
}

export async function setDriverActive(
  driverId: string,
  isActive: boolean,
): Promise<{ ok: true; user: DriverUserRecordDto } | { ok: false; reason: "not_found" | "not_driver" }> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.role !== "driver") return { ok: false, reason: "not_driver" };

  const [updated] = await db
    .update(users)
    .set({ isActive })
    .where(eq(users.id, driverId))
    .returning();

  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, user: rowToUserDto(updated) };
}

export async function updateDriverProfile(
  driverId: string,
  phone: string | null,
): Promise<
  | { ok: true; user: DriverUserRecordDto }
  | { ok: false; reason: "not_found" | "not_driver" }
> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.role !== "driver") return { ok: false, reason: "not_driver" };

  const normalized =
    phone === null || phone === undefined
      ? null
      : phone.trim() === ""
        ? null
        : phone.trim();

  const [updated] = await db
    .update(users)
    .set({ phone: normalized })
    .where(eq(users.id, driverId))
    .returning();

  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, user: rowToUserDto(updated) };
}

export async function assignDriverVehicle(
  driverId: string,
  vehicleId: string | null,
): Promise<
  | { ok: true; data: DriverWithVehicleResponse }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_driver"
        | "vehicle_not_found"
        | "vehicle_inactive";
    }
> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.role !== "driver") return { ok: false, reason: "not_driver" };

  if (vehicleId === null) {
    await db
      .update(users)
      .set({ vehicleId: null })
      .where(eq(users.id, driverId));
  } else {
    const [v] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);
    if (!v) return { ok: false, reason: "vehicle_not_found" };
    if (!v.isActive) return { ok: false, reason: "vehicle_inactive" };

    await db
      .update(users)
      .set({ vehicleId })
      .where(eq(users.id, driverId));
  }

  const data = await fetchDriverWithVehicle(driverId);
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, data };
}

export async function getDriverOwnProfile(
  driverUserId: string,
): Promise<DriverOwnProfileResponse | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      vid: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      colour: vehicles.colour,
      rego: vehicles.rego,
      year: vehicles.year,
    })
    .from(users)
    .leftJoin(vehicles, eq(users.vehicleId, vehicles.id))
    .where(and(eq(users.id, driverUserId), eq(users.role, "driver")))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone?.trim() || null,
    isActive: row.isActive,
    vehicle:
      row.vid != null
        ? {
            make: row.make!,
            model: row.model!,
            colour: row.colour!,
            rego: row.rego!,
            year: row.year,
          }
        : null,
  };
}
