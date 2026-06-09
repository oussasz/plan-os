ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "effortSize" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "importanceLevel" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "urgencyLevel" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "urgencyOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "focusDemand" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "overImmersionRisk" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "flexibility" TEXT NOT NULL DEFAULT 'flexible';

UPDATE "Project" SET "importanceLevel" = GREATEST(1, LEAST(5, CEIL("importanceWeight" / 2.0))) WHERE "importanceLevel" = 3;
UPDATE "Project" SET "focusDemand" = CASE WHEN "requiresDeepFocus" THEN 'high' ELSE 'medium' END WHERE "focusDemand" = 'medium';
