import {
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { setDriverActive } from "@/lib/data/drivers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const result = await setDriverActive(id, false);

  if (!result.ok) {
    if (result.reason === "not_driver") return jsonForbidden();
    return jsonNotFound();
  }

  return Response.json(result.user);
}
