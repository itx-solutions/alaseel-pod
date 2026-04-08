import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
  pgEnum,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["back_office", "driver"]);

export const orderSourceEnum = pgEnum("order_source", [
  "manual",
  "shopify",
  "email",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "assigned",
  "in_transit",
  "completed",
  "attempted",
  "cancelled",
]);

export const shopifyQueueStatusEnum = pgEnum("shopify_queue_status", [
  "pending_review",
  "approved",
  "rejected",
  "cancelled",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "assigned",
  "in_transit",
  "completed",
  "attempted",
]);

export const podTypeEnum = pgEnum("pod_type", ["signed", "unattended"]);

export const emailQueueStatusEnum = pgEnum("email_queue_status", [
  "pending_review",
  "approved",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Key-value platform configuration (e.g. notification email). */
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: orderSourceEnum("source").notNull(),
  shopifyOrderId: text("shopify_order_id"),
  shopifyOrderNumber: text("shopify_order_number"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  recipientEmail: text("recipient_email"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryAddressLat: numeric("delivery_address_lat", { precision: 10, scale: 7 }),
  deliveryAddressLng: numeric("delivery_address_lng", { precision: 10, scale: 7 }),
  items: jsonb("items")
    .$type<
      Array<{
        name: string;
        quantity: number;
        notes?: string;
        variant_title?: string | null;
      }>
    >()
    .notNull(),
  specialInstructions: text("special_instructions"),
  status: orderStatusEnum("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  driverId: uuid("driver_id")
    .notNull()
    .references(() => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: deliveryStatusEnum("status").notNull(),
  notes: text("notes"),
});

export const pods = pgTable("pods", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id),
  podType: podTypeEnum("pod_type").notNull(),
  receiverName: text("receiver_name"),
  signatureUrl: text("signature_url"),
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const podPhotos = pgTable("pod_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  podId: uuid("pod_id")
    .notNull()
    .references(() => pods.id),
  photoUrl: text("photo_url").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailQueue = pgTable("email_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  rawFrom: text("raw_from").notNull(),
  rawSubject: text("raw_subject").notNull(),
  rawBody: text("raw_body").notNull(),
  parsedData: jsonb("parsed_data")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  status: emailQueueStatusEnum("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
});

export const shopifyQueue = pgTable("shopify_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  shopifyOrderNumber: text("shopify_order_number").notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  recipientEmail: text("recipient_email"),
  deliveryAddress: text("delivery_address").notNull(),
  items: jsonb("items")
    .$type<
      Array<{
        name: string;
        quantity: number;
        variant_title?: string | null;
      }>
    >()
    .notNull(),
  orderTotal: text("order_total"),
  status: shopifyQueueStatusEnum("status").notNull(),
  notes: text("notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdOrderId: uuid("created_order_id").references(() => orders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  colour: text("colour").notNull(),
  rego: text("rego").notNull().unique(),
  year: integer("year"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
