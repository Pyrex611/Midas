-- This migration's original migration.sql was lost/never copied over.
-- The UploadJob.verificationId / verifyEmails / pendingRows columns it
-- would have added already exist in production (applied via the old
-- `db push`-based deploy process, like every other migration from this
-- era) -- confirmed against current schema.prisma. This is a documented
-- no-op baseline placeholder, not a real pending change.
SELECT 1;