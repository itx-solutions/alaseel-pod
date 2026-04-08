import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  jsonUnprocessableEntity,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { assignDriverVehicle } from "@/lib/data/drivers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: { vehicleId?: string | null };
  try {
    body = (await request.json()) as { vehicleId?: string | null };
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  if (!("vehicleId" in body)) {
    return jsonBadRequest("vehicleId is required (use null to unassign)");
  }

  if (body.vehicleId !== null && typeof body.vehicleId !== "string") {
    return jsonBadRequest("vehicleId must be a string or null");
  }

  const result = await assignDriverVehicle(id, body.vehicleId ?? null);

  if (!result.ok) {
    if (result.reason === "not_driver") return jsonForbidden();
    if (result.reason === "not_found") return jsonNotFound();
    if (result.reason === "vehicle_not_found") return jsonNotFound();
    if (result.reason === "vehicle_inactive") {
      return jsonUnprocessableEntity("Vehicle is inactive");
    }
    return jsonBadRequest("Could not assign vehicle");
  }

  return Response.json(result.data);
}
