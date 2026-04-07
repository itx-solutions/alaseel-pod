import {
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDeliveryForDriver } from "@/lib/data/deliveries";
import type { DriverDeliveryDetailResponse } from "@/lib/types/delivery";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const delivery = await getDeliveryForDriver(id, user.id);
  if (!delivery) return jsonNotFound();

  const payload: DriverDeliveryDetailResponse = { delivery };
  return Response.json(payload);
}
