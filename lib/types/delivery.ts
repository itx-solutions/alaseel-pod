/**
 * Driver API request/response shapes. Import in routes and driver UI — do not duplicate inline.
 */

import type { DeliveryStatus, OrderStatus, PodType } from "@/lib/types/order";

export type DriverOrderSummary = {
  id: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: string;
  items: { name: string; quantity: number; notes?: string }[];
  specialInstructions: string | null;
  status: OrderStatus;
};

export type DriverDeliveryRow = {
  id: string;
  orderId: string;
  driverId: string;
  status: DeliveryStatus;
  assignedAt: string;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  order: DriverOrderSummary;
};

/** GET /api/driver/deliveries */
export type DriverDeliveriesListResponse = {
  deliveries: DriverDeliveryRow[];
};

/** GET /api/driver/deliveries/[id] */
export type DriverDeliveryDetailResponse = {
  delivery: DriverDeliveryRow;
};

export type DriverDeliveryPatchResponse = {
  delivery: DriverDeliveryRow;
};

/** POST /api/driver/deliveries/[id]/pod — created POD (keys in DB, not signed URLs) */
export type DriverPodCreatedResponse = {
  pod: {
    id: string;
    deliveryId: string;
    podType: PodType;
    receiverName: string | null;
    signatureUrl: string | null;
    gpsLat: string | null;
    gpsLng: string | null;
    submittedAt: string;
  };
  photoKeys: string[];
};

export type CompletedDeliveryPhoto = {
  id: string;
  signedUrl: string;
};

export type CompletedDeliveryRow = {
  deliveryId: string;
  orderId: string;
  recipientName: string;
  deliveryAddress: string;
  completedAt: string;
  podType: PodType;
  signatureSignedUrl: string | null;
  photos: CompletedDeliveryPhoto[];
};

/** GET /api/driver/deliveries/completed */
export type DriverCompletedListResponse = {
  deliveries: CompletedDeliveryRow[];
};
