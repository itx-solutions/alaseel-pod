import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { createVehicle, listAllVehicles } from "@/lib/data/vehicles";
import type { PostVehicleBody, VehiclesListResponse } from "@/lib/types/vehicle";

function isValidVehicleYear(year: number): boolean {
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1990 && year <= max;
}

function parseYear(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const n =
    typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || !isValidVehicleYear(n)) return { ok: false };
  return { ok: true, value: n };
}

function nonEmptyString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const vehicles = await listAllVehicles();
  const payload: VehiclesListResponse = { vehicles };
  return Response.json(payload);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  let body: PostVehicleBody;
  try {
    body = (await request.json()) as PostVehicleBody;
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  const make = nonEmptyString(body.make);
  const model = nonEmptyString(body.model);
  const colour = nonEmptyString(body.colour);
  const rego = nonEmptyString(body.rego);
  if (!make) return jsonBadRequest("make is required");
  if (!model) return jsonBadRequest("model is required");
  if (!colour) return jsonBadRequest("colour is required");
  if (!rego) return jsonBadRequest("rego is required");

  const yearParsed = parseYear(body.year);
  if (!yearParsed.ok) return jsonBadRequest("Invalid year");

  const notesRaw = body.notes;
  const notes =
    notesRaw === undefined || notesRaw === null
      ? null
      : typeof notesRaw === "string"
        ? notesRaw.trim() || null
        : null;

  const result = await createVehicle({
    make,
    model,
    colour,
    rego,
    year: yearParsed.value,
    notes,
  });

  if (!result.ok) {
    if (result.reason === "duplicate_rego") {
      return jsonConflict("A vehicle with this registration already exists");
    }
    return jsonBadRequest("Could not create vehicle");
  }

  return Response.json(result.vehicle, { status: 201 });
}
