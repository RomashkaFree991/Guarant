CREATE TYPE "public"."language" AS ENUM('ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('WAITING_CONFIRMATION', 'WAITING_PAYMENT', 'PAID', 'SELLER_FULFILLED', 'DISPUTE', 'CANCELLED', 'COMPLETED', 'WAITING_PAYOUT_BUYER', 'WAITING_PAYOUT_SELLER', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"language" "language",
	"completed_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"dispute_count" integer DEFAULT 0 NOT NULL,
	"payout_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"creator_id" bigint NOT NULL,
	"counterparty_id" bigint NOT NULL,
	"buyer_id" bigint NOT NULL,
	"seller_id" bigint NOT NULL,
	"amount_nano" bigint NOT NULL,
	"payment_method" text DEFAULT 'TON' NOT NULL,
	"terms" text NOT NULL,
	"status" "deal_status" NOT NULL,
	"previous_status" "deal_status",
	"payment_tx_hash" text,
	"payout_tx_hash" text,
	"payout_address" text,
	"payout_to_user_id" bigint,
	"dispute_opened_by" bigint,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" bigint,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_callbacks" (
	"callback_id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_transactions" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deals_buyer_idx" ON "deals" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "deals_seller_idx" ON "deals" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deal_events_deal_idx" ON "deal_events" USING btree ("deal_id");