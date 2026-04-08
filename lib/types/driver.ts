import type { DeliveryStatus } from "@/lib/types/order";

/** Shared delivery stats for a driver (list + detail). */
export type DriverDeliveryStats = {
  totalDeliveries: number;
  completedDeliveries: number;
  attemptedDeliveries: number;
  /** `null` when there are no completed+attempted deliveries. */
  completionRate: number | null;
  lastDeliveryAt: string | null;
};

/** GET /api/drivers/list — each row */
export type DriverListItemDto = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
} & DriverDeliveryStats;

export type DriversListApiResponse = {
  drivers: DriverListItemDto[];
};

/** PATCH deactivate/reactivate — updated user row (safe fields). */
export type DriverUserRecordDto = {
  id: string;
  clerkId: string;
  role: "driver";
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

/** Server-side driver detail + recent deliveries */
export type DriverRecentDeliveryRow = {
  deliveryId: string;
  orderId: string;
  recipientName: string;
  deliveryAddress: string;
  status: DeliveryStatus;
  /** ISO string — coalesce(completed_at, assigned_at) for display */
  displayAt: string;
};

export type DriverDetailView = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  stats: DriverDeliveryStats;
  recentDeliveries: DriverRecentDeliveryRow[];
};
