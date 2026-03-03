-- CreateTable
CREATE TABLE "UserSettings" (
    "user_id" UUID NOT NULL,
    "email_from" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN,
    "smtp_user" TEXT,
    "smtp_pass" TEXT,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "imap_secure" BOOLEAN,
    "imap_user" TEXT,
    "imap_pass" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
