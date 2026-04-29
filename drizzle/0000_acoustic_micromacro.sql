CREATE TYPE "public"."company_kind" AS ENUM('holding', 'producer', 'packing_facility', 'importer', 'carrier', 'freight_forwarder', 'customs_broker', 'buyer', 'consultant', 'lawyer', 'other');--> statement-breakpoint
CREATE TYPE "public"."vetting_status" AS ENUM('unvetted', 'vetted', 'disqualified', 'dead');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('owner', 'co_owner', 'operator', 'attorney', 'accountant', 'consultant', 'buyer_contact', 'carrier_contact', 'advisor', 'other');--> statement-breakpoint
CREATE TYPE "public"."compliance_area" AS ENUM('registration', 'fsvp', 'phytosanitary', 'customs', 'documentation', 'logistics', 'labeling', 'prior_notice', 'other');--> statement-breakpoint
CREATE TYPE "public"."compliance_jurisdiction" AS ENUM('ecuador', 'us_federal', 'us_state', 'carrier', 'other');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('todo', 'in_flight', 'consultant_claims_done', 'verified', 'blocked', 'not_applicable');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"legal_name" text,
	"kind" "company_kind" NOT NULL,
	"parent_id" uuid,
	"country" text,
	"address_line" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"website" text,
	"primary_email" text,
	"primary_phone" text,
	"tax_id" text,
	"duns" text,
	"ein" text,
	"fda_registration_no" text,
	"agrocalidad_registration_no" text,
	"vetting_status" "vetting_status" DEFAULT 'unvetted' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"role" "person_role" NOT NULL,
	"company_ids" uuid[],
	"primary_email" text,
	"alt_emails" text[],
	"primary_phone" text,
	"whatsapp" text,
	"country" text,
	"vetting_status" "vetting_status" DEFAULT 'unvetted' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"jurisdiction" "compliance_jurisdiction" NOT NULL,
	"area" "compliance_area" NOT NULL,
	"item" text NOT NULL,
	"description" text,
	"owner_company_id" uuid,
	"responsible_person_id" uuid,
	"status" "compliance_status" DEFAULT 'todo' NOT NULL,
	"evidence_source" text,
	"evidence_url" text,
	"identifier" text,
	"due_date" date,
	"notes" text,
	"last_touched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
