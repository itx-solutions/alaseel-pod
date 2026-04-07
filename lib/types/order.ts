/**
 * API request/response shapes for orders, drivers, and dashboard stats.
 * Import these in pages and components — do not duplicate inline.
 */

export type OrderStatus =
  | "pending"
  | "assigned"
  | "in_transit"
  | "completed"
  | "attempted"
  | "cancelled";

export type OrderSource = "manual" | "shopify" | "email";

export type DeliveryStatus =
  | "assigned"
  | "in_transit"
  | "completed"
  | "attempted";

export type PodType = "signed" | "unattended";

/** Line item stored in `orders.items` jsonb */
export type OrderItemLine = {
  name: string;
  quantity: number;
  notes?: string;
  variant_title?: string | null;
};

/** GET /api/orders — each row */
export type OrderListRow = {
  id: string;
  recipientName: string;
  deliveryAddress: string;
  items: OrderItemLine[];
  itemsCount: number;
  status: OrderStatus;
  source: OrderSource;
  driverName: string | null;
  driverId: string | null;
  createdAt: string;
};

/** GET /api/orders */
export type PaginatedOrdersResponse = {
  orders: OrderListRow[];
  page: number;
  pageSize: number;
  totalCount: number;
};

/** Query params accepted by GET /api/orders */
export type OrdersListQuery = {
  status?: OrderStatus | "";
  page?: number;
  search?: string;
};

export type DriverPublicDto = {
  id: string;
  name: string;
  email: string;
};

/** GET /api/drivers */
export type DriversListResponse = {
  drivers: DriverPublicDto[];
};

export type DeliveryDetailDto = {
  id: string;
  orderId: string;
  driverId: string;
  status: DeliveryStatus;
  assignedAt: string;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
};

export type PodSummaryDto = {
  id: string;
  podType: PodType;
  receiverName: string | null;
  submittedAt: string;
  photo_count: number;
  signature_thumbnail_url: string | null;
};

/** Core order fields returned in detail and create responses */
export type OrderCoreDto = {
  id: string;
  source: OrderSource;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: string;
  items: OrderItemLine[];
  specialInstructions: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

/** GET /api/orders/[id], POST /api/orders (created order envelope) */
export type OrderDetailResponse = {
  order: OrderCoreDto;
  delivery: DeliveryDetailDto | null;
  driver: DriverPublicDto | null;
  pod: PodSummaryDto | null;
};

/** POST /api/orders — request body */
export type PostOrderRequestBody = {
  recipient_name: string;
  delivery_address: string;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  items?: OrderItemLine[];
  special_instructions?: string | null;
  driver_id?: string | null;
};

/** PATCH /api/orders/[id] — request body */
export type PatchOrderRequestBody = {
  recipient_name?: string;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  delivery_address?: string;
  items?: OrderItemLine[];
  special_instructions?: string | null;
};

/** POST /api/orders/[id]/assign — request body */
export type PostAssignRequestBody = {
  driver_id: string;
};

/** GET /api/dashboard/stats */
export type DashboardStatsResponse = {
  total_today: number;
  completed_today: number;
  in_transit: number;
  pending_assignment: number;
  pods_today: number;
  shopify_pending: number;
};

/** Helper: short display id for tables */
export function formatOrderNumber(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
