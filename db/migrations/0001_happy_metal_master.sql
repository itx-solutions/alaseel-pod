CREATE TYPE "public"."shopify_queue_status" AS ENUM('pending_review', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "shopify_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_order_id" text NOT NULL,
	"shopify_order_number" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"recipient_email" text,
	"delivery_address" text NOT NULL,
	"items" jsonb NOT NULL,
	"order_total" text,
	"status" "shopify_queue_status" NOT NULL,
	"notes" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_queue_shopify_order_id_unique" UNIQUE("shopify_order_id")
);
--> statement-breakpoint
ALTER TABLE "shopify_queue" ADD CONSTRAINT "shopify_queue_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_queue" ADD CONSTRAINT "shopify_queue_created_order_id_orders_id_fk" FOREIGN KEY ("created_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;