import {
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { listDriversWithStats } from "@/lib/data/drivers";
import type { DriversListApiResponse } from "@/lib/types/driver";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const drivers = await listDriversWithStats();
  const payload: DriversListApiResponse = { drivers };
  return Response.json(payload);
}
