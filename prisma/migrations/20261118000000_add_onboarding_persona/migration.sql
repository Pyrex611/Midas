ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "onboarding_persona" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);