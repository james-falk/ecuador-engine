CREATE TYPE "public"."compliance_bucket" AS ENUM('importing', 'exporting', 'shipment');--> statement-breakpoint
CREATE TYPE "public"."expense_category_type" AS ENUM('labor_water', 'labor_harvest', 'labor_overhead', 'equipment', 'services', 'taxes', 'transfer_out', 'other');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"country" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "harvest_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"harvest_id" uuid NOT NULL,
	"settlement_date" date NOT NULL,
	"kg_manifested" numeric(10, 2) NOT NULL,
	"kg_processed" numeric(10, 2) NOT NULL,
	"kg_waste" numeric(10, 2) NOT NULL,
	"waste_pct" numeric(5, 2),
	"grade_1_5_kg" numeric(10, 2),
	"grade_2_kg" numeric(10, 2),
	"grade_small_kg" numeric(10, 2),
	"grade_1_5_rate_usd" numeric(8, 4),
	"grade_2_rate_usd" numeric(8, 4),
	"grade_small_rate_usd" numeric(8, 4),
	"grade_breakdown" jsonb,
	"subtotal_usd" numeric(12, 2) NOT NULL,
	"retention_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_pay_usd" numeric(12, 2) NOT NULL,
	"paid_to_account_id" uuid NOT NULL,
	"paid_date" date,
	"pdf_url" text,
	"waste_observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_touched_at" timestamp with time zone,
	CONSTRAINT "harvest_settlements_harvest_id_unique" UNIQUE("harvest_id")
);
--> statement-breakpoint
CREATE TABLE "harvests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"harvest_date" date NOT NULL,
	"week_start_date" date NOT NULL,
	"processor_company_id" uuid NOT NULL,
	"lot_number" text,
	"kg_delivered" numeric(10, 2) NOT NULL,
	"notes" text,
	"evidence_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_touched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expense_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"entry_date" date NOT NULL,
	"week_start_date" date NOT NULL,
	"category_type" "expense_category_type" NOT NULL,
	"category_label" text,
	"amount_usd" numeric(12, 2) NOT NULL,
	"account_id" uuid NOT NULL,
	"payee" text,
	"payee_person_id" uuid,
	"payee_company_id" uuid,
	"notes" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_touched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD COLUMN "bucket" "compliance_bucket" NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD COLUMN "responsible" text;--> statement-breakpoint
ALTER TABLE "harvest_settlements" ADD CONSTRAINT "harvest_settlements_harvest_id_harvests_id_fk" FOREIGN KEY ("harvest_id") REFERENCES "public"."harvests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_settlements" ADD CONSTRAINT "harvest_settlements_paid_to_account_id_accounts_id_fk" FOREIGN KEY ("paid_to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_processor_company_id_companies_id_fk" FOREIGN KEY ("processor_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_payee_person_id_people_id_fk" FOREIGN KEY ("payee_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_payee_company_id_companies_id_fk" FOREIGN KEY ("payee_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_unique" UNIQUE("slug");