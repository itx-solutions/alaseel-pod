import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { getOrderDetailData } from "@/lib/data/orders";
import { approveShopifyQueueEntry } from "@/lib/data/shopify-queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;
  const result = await approveShopifyQueueEntry(id, user.id);
  if (!result) {
    return jsonBadRequest("Queue entry not found or not pending review");
  }

  const detail = await getOrderDetailData(result.orderId);
  if (!detail) return jsonNotFound();

  return Response.json(detail);
}
