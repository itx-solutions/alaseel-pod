import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateVehicle } from "@/lib/data/vehicles";
import type { PatchVehicleBody } from "@/lib/types/vehicle";

type RouteContext = { params: Promise<{ id: string }> };

function isValidVehicleYear(year: number): boolean {
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1990 && year <= max;
}

function parseYearOptional(
  raw: unknown,
): { ok: true; value: number | null | undefined } | { ok: false } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  const n =
    typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || !isValidVehicleYear(n)) return { ok: false };
  return { ok: true, value: n };
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: PatchVehicleBody;
  try {
    body = (await request.json()) as PatchVehicleBody;
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  const patch: Parameters<typeof updateVehicle>[1] = {};

  if (body.make !== undefined) {
    if (typeof body.make !== "string" || !body.make.trim()) {
      return jsonBadRequest("make cannot be empty");
    }
    patch.make = body.make;
  }
  if (body.model !== undefined) {
    if (typeof body.model !== "string" || !body.model.trim()) {
      return jsonBadRequest("model cannot be empty");
    }
    patch.model = body.model;
  }
  if (body.colour !== undefined) {
    if (typeof body.colour !== "string" || !body.colour.trim()) {
      return jsonBadRequest("colour cannot be empty");
    }
    patch.colour = body.colour;
  }
  if (body.rego !== undefined) {
    if (typeof body.rego !== "string" || !body.rego.trim()) {
      return jsonBadRequest("rego cannot be empty");
    }
    patch.rego = body.rego;
  }
  if (body.year !== undefined) {
    const y = parseYearOptional(body.year);
    if (!y.ok) return jsonBadRequest("Invalid year");
    patch.year = y.value;
  }
  if (body.notes !== undefined) {
    if (body.notes === null) {
      patch.notes = null;
    } else if (typeof body.notes === "string") {
      patch.notes = body.notes.trim() || null;
    } else {
      return jsonBadRequest("notes must be a string or null");
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonBadRequest("No fields to update");
  }

  const result = await updateVehicle(id, patch);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonNotFound();
    if (result.reason === "duplicate_rego") {
      return jsonConflict("A vehicle with this registration already exists");
    }
    return jsonBadRequest("Could not update vehicle");
  }

  return Response.json(result.vehicle);
}
