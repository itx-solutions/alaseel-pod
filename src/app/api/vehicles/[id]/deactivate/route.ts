import {
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { setVehicleActive } from "@/lib/data/vehicles";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const result = await setVehicleActive(id, false);
  if (!result.ok) return jsonNotFound();
  return Response.json(result.vehicle);
}
