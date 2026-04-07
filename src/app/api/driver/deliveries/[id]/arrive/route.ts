import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { arriveDeliveryForDriver } from "@/lib/data/deliveries";
import type { DriverDeliveryPatchResponse } from "@/lib/types/delivery";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const { id } = await context.params;

  try {
    const delivery = await arriveDeliveryForDriver(id, user.id);
    if (!delivery) return jsonNotFound();
    const payload: DriverDeliveryPatchResponse = { delivery };
    return Response.json(payload);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_STATE") {
      return jsonBadRequest("Cannot mark arrived in the current state");
    }
    throw e;
  }
}
