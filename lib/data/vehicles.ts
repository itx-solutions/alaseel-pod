import { and, asc, desc, eq, ne } from "drizzle-orm";
import { vehicles } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { VehicleDto } from "@/lib/types/vehicle";

function mapRow(row: typeof vehicles.$inferSelect): VehicleDto {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    colour: row.colour,
    rego: row.rego,
    year: row.year,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Active first, then inactive; within each group by rego ascending. */
export async function listAllVehicles(): Promise<VehicleDto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(vehicles)
    .orderBy(desc(vehicles.isActive), asc(vehicles.rego));
  return rows.map(mapRow);
}

export async function getVehicleById(id: string): Promise<VehicleDto | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

async function regoTakenByOther(
  regoUpper: string,
  excludeId?: string,
): Promise<boolean> {
  const db = getDb();
  const cond = excludeId
    ? and(eq(vehicles.rego, regoUpper), ne(vehicles.id, excludeId))
    : eq(vehicles.rego, regoUpper);
  const [row] = await db.select({ id: vehicles.id }).from(vehicles).where(cond).limit(1);
  return !!row;
}

export type CreateVehicleInput = {
  make: string;
  model: string;
  colour: string;
  rego: string;
  year: number | null;
  notes: string | null;
};

export async function createVehicle(
  input: CreateVehicleInput,
): Promise<{ ok: true; vehicle: VehicleDto } | { ok: false; reason: "duplicate_rego" }> {
  const regoUpper = input.rego.toUpperCase();
  if (await regoTakenByOther(regoUpper)) {
    return { ok: false, reason: "duplicate_rego" };
  }
  const db = getDb();
  const [row] = await db
    .insert(vehicles)
    .values({
      make: input.make.trim(),
      model: input.model.trim(),
      colour: input.colour.trim(),
      rego: regoUpper,
      year: input.year,
      notes: input.notes,
    })
    .returning();
  if (!row) return { ok: false, reason: "duplicate_rego" };
  return { ok: true, vehicle: mapRow(row) };
}

export type UpdateVehicleInput = {
  make?: string;
  model?: string;
  colour?: string;
  rego?: string;
  year?: number | null;
  notes?: string | null;
};

export async function updateVehicle(
  id: string,
  input: UpdateVehicleInput,
): Promise<
  | { ok: true; vehicle: VehicleDto }
  | { ok: false; reason: "not_found" | "duplicate_rego" }
> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  if (!existing) return { ok: false, reason: "not_found" };

  if (input.rego !== undefined) {
    const regoUpper = input.rego.toUpperCase();
    if (await regoTakenByOther(regoUpper, id)) {
      return { ok: false, reason: "duplicate_rego" };
    }
  }

  const patch: Partial<typeof vehicles.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.make !== undefined) patch.make = input.make.trim();
  if (input.model !== undefined) patch.model = input.model.trim();
  if (input.colour !== undefined) patch.colour = input.colour.trim();
  if (input.rego !== undefined) patch.rego = input.rego.toUpperCase();
  if (input.year !== undefined) patch.year = input.year;
  if (input.notes !== undefined) patch.notes = input.notes;

  const [row] = await db
    .update(vehicles)
    .set(patch)
    .where(eq(vehicles.id, id))
    .returning();
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, vehicle: mapRow(row) };
}

export async function setVehicleActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true; vehicle: VehicleDto } | { ok: false; reason: "not_found" }> {
  const db = getDb();
  const [row] = await db
    .update(vehicles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, vehicle: mapRow(row) };
}
