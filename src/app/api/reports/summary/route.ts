import {
  jsonBadRequest,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { getReportSummary } from "@/lib/data/reports";
import type { ReportSummaryDto } from "@/lib/types/report";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";
  if (!dateFrom || !dateTo) {
    return jsonBadRequest("date_from and date_to are required (YYYY-MM-DD)");
  }

  const summary = await getReportSummary(dateFrom, dateTo);
  if (!summary) {
    return jsonBadRequest("Invalid date_from or date_to (use YYYY-MM-DD, from ≤ to)");
  }

  const body: ReportSummaryDto = summary;
  return Response.json(body);
}
