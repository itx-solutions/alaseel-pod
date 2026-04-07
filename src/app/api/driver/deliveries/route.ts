import {
  jsonForbidden,
  jsonUnauthorized,
} from "@/lib/api/back-office";
import { requireDriverUser } from "@/lib/api/driver";
import { getAuthenticatedUser } from "@/lib/auth";
import { listTodayDeliveriesForDriver } from "@/lib/data/deliveries";
import type { DriverDeliveriesListResponse } from "@/lib/types/delivery";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireDriverUser(user)) return jsonForbidden();

  const deliveries = await listTodayDeliveriesForDriver(user.id);
  const payload: DriverDeliveriesListResponse = { deliveries };
  return Response.json(payload);
}
