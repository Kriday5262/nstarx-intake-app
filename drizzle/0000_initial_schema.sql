CREATE TYPE "public"."priority" AS ENUM('Low', 'Medium', 'High', 'Urgent');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('Deck Redesign', 'Document Branding', 'Video Creation', 'Website Work', 'Other');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('Submitted', 'In Review', 'Planned', 'In Progress', 'Completed', 'Rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"actor_email" varchar(255) NOT NULL,
	"field" varchar(255) NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" integer NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"stored_path" varchar(1000) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_reference" varchar(32) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"department" varchar(255) NOT NULL,
	"project_type" "project_type" NOT NULL,
	"project_title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"desired_deadline" date,
	"priority" "priority" DEFAULT 'Medium' NOT NULL,
	"status" "status" DEFAULT 'Submitted' NOT NULL,
	"due_date" date,
	"internal_notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "requests_public_reference_unique" UNIQUE("public_reference")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
