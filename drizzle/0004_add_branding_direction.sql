CREATE TYPE "public"."branding_direction" AS ENUM('NStarX', 'SHI', 'NStarX + SHI', 'Not sure', 'Other');
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "branding_direction" "branding_direction" NOT NULL DEFAULT 'NStarX';
--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "branding_direction" DROP DEFAULT;
