import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { approveEmailQueueEntry } from "@/lib/data/email-queue";
import { getOrderDetailData } from "@/lib/data/orders";
import type { PostEmailQueueApproveBody } from "@/lib/types/email";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: PostEmailQueueApproveBody = {};
  try {
    body = (await request.json()) as PostEmailQueueApproveBody;
  } catch {
    body = {};
  }

  const result = await approveEmailQueueEntry(id, user.id, body);
  if (!result) {
    return jsonBadRequest(
      "Queue entry not found, not pending review, or missing required fields (recipient, address, items).",
    );
  }

  const detail = await getOrderDetailData(result.orderId);
  if (!detail) return jsonNotFound();

  return Response.json(detail);
}
