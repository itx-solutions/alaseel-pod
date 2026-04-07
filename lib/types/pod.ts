import type { OrderItemLine, PodType } from "@/lib/types/order";

/** GET /api/pods — one row */
export type PodListRowDto = {
  id: string;
  pod_type: PodType;
  receiver_name: string | null;
  submitted_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  delivery_address: string;
  order_recipient_name: string;
  driver_name: string;
  photo_count: number;
  order_id: string;
};

/** GET /api/pods */
export type PaginatedPodsResponse = {
  items: PodListRowDto[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type PodDetailOrderDto = {
  id: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  delivery_address: string;
  items: OrderItemLine[];
  special_instructions: string | null;
};

export type PodDetailDeliveryDto = {
  id: string;
  order_id: string;
  driver_id: string;
  notes: string | null;
};

/** GET /api/pods/[id] — full detail with signed URLs */
export type PodDetailResponse = {
  pod: {
    id: string;
    delivery_id: string;
    pod_type: PodType;
    receiver_name: string | null;
    submitted_at: string;
    gps_lat: number | null;
    gps_lng: number | null;
  };
  delivery: PodDetailDeliveryDto;
  order: PodDetailOrderDto;
  driver_name: string;
  signature_signed_url: string | null;
  photo_signed_urls: { id: string; url: string; uploaded_at: string }[];
};
