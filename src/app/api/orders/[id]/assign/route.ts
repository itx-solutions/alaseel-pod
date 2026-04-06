import { assignDriverData } from "@/lib/data/orders";
import { requireBackOfficeUser } from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import type { PostAssignRequestBody } from "@/lib/types/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireBackOfficeUser(user)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: PostAssignRequestBody;
  try {
    body = (await request.json()) as PostAssignRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.driver_id?.trim()) {
    return Response.json({ error: "driver_id is required" }, { status: 400 });
  }

  try {
    const detail = await assignDriverData(id, body.driver_id.trim());
    if (!detail) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({
      order: detail.order,
      delivery: detail.delivery,
      driver: detail.driver,
      pod: detail.pod,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid driver") {
      return Response.json({ error: "Invalid driver_id" }, { status: 400 });
    }
    throw e;
  }
}
