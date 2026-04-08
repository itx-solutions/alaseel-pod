ALTER TABLE "email_queue" ALTER COLUMN "parsed_data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "parsed_data" SET NOT NULL;