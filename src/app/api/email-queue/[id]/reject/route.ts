import {
  jsonBadRequest,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { rejectEmailQueueEntry } from "@/lib/data/email-queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { id } = await context.params;

  const updated = await rejectEmailQueueEntry(id, user.id);
  if (!updated) {
    return jsonBadRequest("Queue entry not found or not pending review");
  }

  return Response.json(updated);
}
