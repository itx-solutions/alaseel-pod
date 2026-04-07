import {
  jsonBadRequest,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { rejectShopifyQueueEntry } from "@/lib/data/shopify-queue";

type RouteContext = { params: Promise<{ id: string }> };

type RejectBody = {
  notes?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  let body: RejectBody = {};
  try {
    body = (await request.json()) as RejectBody;
  } catch {
    body = {};
  }

  const updated = await rejectShopifyQueueEntry(
    id,
    user.id,
    body.notes ?? null,
  );
  if (!updated) {
    return jsonBadRequest("Queue entry not found or not pending review");
  }

  return Response.json(updated);
}
