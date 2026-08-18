CREATE TYPE "public"."support_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_category" AS ENUM('technical', 'complaint', 'payment', 'billing', 'account', 'documents', 'safety', 'other');--> statement-breakpoint
ALTER TYPE "public"."support_ticket_status" ADD VALUE 'in_progress';--> statement-breakpoint
ALTER TYPE "public"."support_ticket_status" ADD VALUE 'escalated';--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "category" "support_ticket_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "subject" text NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "priority" "support_priority" DEFAULT 'medium' NOT NULL;