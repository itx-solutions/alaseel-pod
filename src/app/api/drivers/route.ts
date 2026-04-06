import { getActiveDriversData } from "@/lib/data/orders";
import {
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import type { DriversListResponse } from "@/lib/types/order";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const drivers = await getActiveDriversData();
  const payload: DriversListResponse = { drivers };
  return Response.json(payload);
}
