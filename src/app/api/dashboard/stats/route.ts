import { getDashboardStatsData } from "@/lib/data/orders";
import {
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import type { DashboardStatsResponse } from "@/lib/types/order";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const stats: DashboardStatsResponse = await getDashboardStatsData();
  return Response.json(stats);
}
