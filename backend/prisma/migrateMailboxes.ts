import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Simple encryption/decryption (copied from src/lib/encryption.ts)
const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_KEY!; // must be 32 bytes hex (64 chars)
const ivLength = 16;
const tagLength = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

async function main() {
  console.log('Starting mailbox migration...');

  // 1. Create default mailboxes for users with settings
  const usersWithSettings = await prisma.user.findMany({
    where: { settings: { isNot: null } },
    include: { settings: true },
  });

  for (const user of usersWithSettings) {
    const settings = user.settings!;
    // Check if user already has a mailbox
    const existing = await prisma.mailbox.findFirst({ where: { userId: user.id } });
    if (existing) {
      console.log(`User ${user.id} already has a mailbox, skipping.`);
      continue;
    }

    // Extract email from emailFrom (e.g., "Name <email@example.com>")
    let email = settings.emailFrom || '';
    const match = settings.emailFrom?.match(/<(.+)>/);
    if (match) email = match[1];

    await prisma.mailbox.create({
      data: {
        userId: user.id,
        name: 'Default',
        email,
        senderName: settings.smtpUser || '',
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpPass: settings.smtpPass ? encrypt(settings.smtpPass) : null,
        imapHost: settings.imapHost,
        imapPort: settings.imapPort,
        imapSecure: settings.imapSecure,
        imapUser: settings.imapUser,
        imapPass: settings.imapPass ? encrypt(settings.imapPass) : null,
        sendLimit: settings.sendLimit,
        sendPeriod: settings.sendPeriod,
        isPrimary: true,
      },
    });
    console.log(`Created default mailbox for user ${user.id}`);
  }

  // 2. Link existing OutboundEmail records to the user's primary mailbox
  await prisma.$executeRaw`
    UPDATE "OutboundEmail" oe
    SET "mailbox_id" = m.id
    FROM "Mailbox" m
    WHERE m.user_id = oe.user_id AND m.is_primary = true
  `;

  // 3. Link existing PendingEmail records similarly
  await prisma.$executeRaw`
    UPDATE "PendingEmail" pe
    SET "mailbox_id" = m.id
    FROM "Mailbox" m
    WHERE m.user_id = pe.user_id AND m.is_primary = true
  `;

  console.log('Mailbox IDs populated for existing emails.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());