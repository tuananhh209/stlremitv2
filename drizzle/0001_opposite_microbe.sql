ALTER TYPE "public"."remittance_status" ADD VALUE 'pending_agent' BEFORE 'funded';--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"bank_name" text,
	"account_number" text,
	"account_holder" text,
	"qr_image_url" text,
	"agent_bank_name" text,
	"agent_account_number" text,
	"agent_account_holder" text,
	"agent_qr_image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
