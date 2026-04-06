import { createOrderData, listOrdersData } from "@/lib/data/orders";
import {
  jsonBadRequest,
  jsonForbidden,
  jsonUnauthorized,
  requireBackOfficeUser,
} from "@/lib/api/back-office";
import { getAuthenticatedUser } from "@/lib/auth";
import type {
  OrderStatus,
  PaginatedOrdersResponse,
  PostOrderRequestBody,
} from "@/lib/types/order";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "assigned",
  "in_transit",
  "completed",
  "attempted",
];

function parseStatus(s: string | null): OrderStatus | undefined {
  if (!s || s === "all") return undefined;
  if (ORDER_STATUSES.includes(s as OrderStatus)) return s as OrderStatus;
  return undefined;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const search = searchParams.get("search") ?? undefined;
  const status = parseStatus(searchParams.get("status"));

  const data: PaginatedOrdersResponse = await listOrdersData({
    page,
    search,
    status,
  });

  return Response.json(data);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  if (!requireBackOfficeUser(user)) return jsonForbidden();

  let body: PostOrderRequestBody;
  try {
    body = (await request.json()) as PostOrderRequestBody;
  } catch {
    return jsonBadRequest("Invalid JSON");
  }

  if (!body.recipient_name?.trim() || !body.delivery_address?.trim()) {
    return jsonBadRequest("recipient_name and delivery_address are required");
  }

  try {
    const detail = await createOrderData({
      recipient_name: body.recipient_name.trim(),
      delivery_address: body.delivery_address.trim(),
      recipient_phone: body.recipient_phone,
      recipient_email: body.recipient_email,
      items: body.items,
      special_instructions: body.special_instructions,
      driver_id: body.driver_id ?? null,
    });
    return Response.json(detail, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid driver") {
      return jsonBadRequest("Invalid driver_id");
    }
    throw e;
  }
}
