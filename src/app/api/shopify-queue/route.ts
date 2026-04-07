import {
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import { listShopifyQueueEntries } from "@/lib/data/shopify-queue";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const status = searchParams.get("status") ?? "pending_review";
  const search = searchParams.get("search") ?? undefined;

  const data = await listShopifyQueueEntries({
    page,
    status: status === "all" ? undefined : status,
    search,
  });

  return Response.json(data);
}
