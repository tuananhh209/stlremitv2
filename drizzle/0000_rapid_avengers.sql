CREATE TYPE "public"."remittance_status" AS ENUM('funded', 'processing', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE "agent_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"total_collateral" numeric(20, 7) DEFAULT '0' NOT NULL,
	"reserved_usdc" numeric(20, 7) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_requests" (
	"tx_id" text PRIMARY KEY NOT NULL,
	"vnd_amount" numeric(20, 2) NOT NULL,
	"usdc_equivalent" numeric(20, 7) NOT NULL,
	"php_payout" numeric(20, 2) NOT NULL,
	"receiver_name" text NOT NULL,
	"receiver_account" text NOT NULL,
	"status" "remittance_status" DEFAULT 'funded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sender_proof_ref" text,
	"agent_proof_ref" text,
	"stellar_tx_hash" text
);
