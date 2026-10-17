CREATE TYPE "public"."assignee" AS ENUM('Shantanu', 'Sujay');
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "assignee" "assignee" NOT NULL DEFAULT 'Shantanu';
--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "assignee" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "drive_url" text;
--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "actor_name" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "name" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"author_name" varchar(255) NOT NULL,
	"author_email" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;
