import {
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPodDetailForBackOffice } from "@/lib/data/pods";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const detail = await getPodDetailForBackOffice(id);
  if (!detail) return jsonNotFound();

  return Response.json(detail);
}
