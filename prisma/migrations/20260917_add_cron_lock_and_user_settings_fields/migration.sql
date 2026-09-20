-- CronLock: cross-instance mutual exclusion for the three scheduled jobs.
CREATE TABLE "CronLock" (
  "name"       TEXT PRIMARY KEY,
  "locked_at"  TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL
);

INSERT INTO "CronLock" ("name", "locked_at", "updated_at") VALUES
  ('queue', NULL, NOW()),
  ('leads', NULL, NOW()),
  ('followups', NULL, NOW());

-- UserSettings: give the model real columns instead of being a no-op stub.
ALTER TABLE "UserSettings" ADD COLUMN "send_limit" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN "send_period" TEXT;
