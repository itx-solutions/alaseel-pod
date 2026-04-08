import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateDriverProfile } from "@/lib/data/drivers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: { phone?: string | null };
  try {
    body = (await request.json()) as { phone?: string | null };
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  if (!("phone" in body)) {
    return jsonBadRequest("phone is required (use null to clear)");
  }

  if (body.phone !== null && body.phone !== undefined && typeof body.phone !== "string") {
    return jsonBadRequest("phone must be a string or null");
  }

  const phone =
    body.phone === undefined || body.phone === null
      ? null
      : body.phone.trim() === ""
        ? null
        : body.phone.trim();

  const result = await updateDriverProfile(id, phone);

  if (!result.ok) {
    if (result.reason === "not_driver") return jsonForbidden();
    return jsonNotFound();
  }

  return Response.json(result.user);
}
