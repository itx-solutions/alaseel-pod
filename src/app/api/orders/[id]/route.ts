import {
  getOrderDetailData,
  updateOrderData,
} from "@/lib/data/orders";
import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import type { PatchOrderRequestBody } from "@/lib/types/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const detail = await getOrderDetailData(id);
  if (!detail) return jsonNotFound();

  return Response.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: PatchOrderRequestBody;
  try {
    body = (await request.json()) as PatchOrderRequestBody;
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  try {
    const detail = await updateOrderData(id, {
      recipient_name: body.recipient_name,
      recipient_phone: body.recipient_phone,
      recipient_email: body.recipient_email,
      delivery_address: body.delivery_address,
      items: body.items,
      special_instructions: body.special_instructions,
    });
    if (!detail) return jsonNotFound();
    return Response.json(detail);
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_EDITABLE") {
      return jsonBadRequest(
        "Order cannot be edited in the current status",
      );
    }
    throw e;
  }
}
