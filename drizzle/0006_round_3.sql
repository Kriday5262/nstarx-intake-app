-- Round 3: update project_type and status enums, migrate existing values.
-- PostgreSQL does not allow renaming enum values directly, so we:
-- 1. Add new labels to project_type enum
-- 2. Alter the column to text temporarily
-- 3. Rename the enum and recreate with desired labels
-- 4. Map old project_type values to new labels
-- 5. Update status enum to new flow and map old values
-- 6. Set default sort-friendly dueDate ordering in application code

-- Add new enum entries (harmless no-ops if already present)
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'Presentation';
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'Document';
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'Video';
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'Website';
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'Graphics';
ALTER TYPE "public"."project_type" ADD VALUE IF NOT EXISTS 'UI/UX';

-- Step A: convert project_type column to text, migrate values, then attach new enum.
ALTER TABLE "public"."requests" ALTER COLUMN "project_type" DROP DEFAULT;
ALTER TABLE "public"."requests" ALTER COLUMN "project_type" TYPE text USING "project_type"::text;

UPDATE "public"."requests" SET "project_type" = CASE "project_type"
  WHEN 'Deck Redesign' THEN 'Presentation'
  WHEN 'Document Branding' THEN 'Document'
  WHEN 'Video Creation' THEN 'Video'
  WHEN 'Website Work' THEN 'Website'
  ELSE "project_type"
END;

-- Recreate project_type enum with the final labels only.
DROP TYPE "public"."project_type";
CREATE TYPE "public"."project_type" AS ENUM('Presentation', 'Document', 'Video', 'Website', 'Graphics', 'UI/UX', 'Other');

ALTER TABLE "public"."requests" ALTER COLUMN "project_type" TYPE "public"."project_type" USING "project_type"::"public"."project_type";
ALTER TABLE "public"."requests" ALTER COLUMN "project_type" SET DEFAULT 'Other';

-- Step B: update status enum values.
ALTER TYPE "public"."status" ADD VALUE IF NOT EXISTS 'Not Started';

ALTER TABLE "public"."requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."requests" ALTER COLUMN "status" TYPE text USING "status"::text;

UPDATE "public"."requests" SET "status" = CASE "status"
  WHEN 'Planned' THEN 'Not Started'
  ELSE "status"
END;

DROP TYPE "public"."status";
CREATE TYPE "public"."status" AS ENUM('Submitted', 'Not Started', 'In Progress', 'In Review', 'Completed', 'Rejected');

ALTER TABLE "public"."requests" ALTER COLUMN "status" TYPE "public"."status" USING "status"::"public"."status";
ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DEFAULT 'Submitted';
