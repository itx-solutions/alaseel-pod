import {
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { listPodsForBackOffice } from "@/lib/data/pods";
import type { PodType } from "@/lib/types/order";

function parsePodType(v: string | null): PodType | undefined {
  if (v === "signed" || v === "unattended") return v;
  return undefined;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const type = parsePodType(searchParams.get("type"));
  const search = searchParams.get("search") ?? undefined;
  const date_from = searchParams.get("date_from") ?? undefined;
  const date_to = searchParams.get("date_to") ?? undefined;

  const data = await listPodsForBackOffice({
    page,
    type,
    search,
    dateFrom: date_from,
    dateTo: date_to,
  });

  return Response.json(data);
}
