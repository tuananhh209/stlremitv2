ALTER TYPE "public"."remittance_status" ADD VALUE IF NOT EXISTS 'cancelled' BEFORE 'funded';--> statement-breakpoint
ALTER TYPE "public"."remittance_status" ADD VALUE IF NOT EXISTS 'payout_submitted' AFTER 'processing';--> statement-breakpoint
ALTER TABLE "remittance_requests" ADD COLUMN IF NOT EXISTS "receiver_wallet" text;--> statement-breakpoint
ALTER TABLE "remittance_requests" ADD COLUMN IF NOT EXISTS "sender_wallet" text;--> statement-breakpoint
ALTER TABLE "remittance_requests" ADD COLUMN IF NOT EXISTS "sender_name" text;--> statement-breakpoint
ALTER TABLE "remittance_requests" ADD COLUMN IF NOT EXISTS "agent_wallet" text;
