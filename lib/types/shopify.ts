export type ShopifyQueueEntryStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "cancelled";

/** Shopify REST Admin order webhook payload (subset used for queue + mapping). */
export interface ShopifyOrderPayload {
  id: number;
  order_number: number;
  email: string | null;
  total_price: string;
  shipping_address: {
    name: string;
    phone: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
  } | null;
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    variant_title: string | null;
  }>;
  note_attributes?: Array<{
    name: string;
    value: string;
  }> | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
}

export type ShopifyQueueListRowDto = {
  id: string;
  shopify_order_number: string;
  recipient_name: string;
  delivery_address: string;
  items_count: number;
  order_total: string | null;
  created_at: string;
  status: ShopifyQueueEntryStatus;
};

export type PaginatedShopifyQueueResponse = {
  items: ShopifyQueueListRowDto[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ShopifyQueueDetailDto = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  delivery_address: string;
  items: Array<{
    name: string;
    quantity: number;
    variant_title?: string | null;
  }>;
  order_total: string | null;
  status: ShopifyQueueEntryStatus;
  notes: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  created_order_id: string | null;
  created_at: string;
  updated_at: string;
  raw_payload: Record<string, unknown>;
};
