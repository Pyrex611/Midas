import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/lib/encryption';

const prisma = new PrismaClient();

async function main() {
  const usersWithSettings = await prisma.user.findMany({
    where: { settings: { isNot: null } },
    include: { settings: true },
  });

  for (const user of usersWithSettings) {
    const settings = user.settings!;
    // Check if user already has any mailbox
    const existing = await prisma.mailbox.findFirst({ where: { userId: user.id } });
    if (existing) continue; // skip

    await prisma.mailbox.create({
      data: {
        userId: user.id,
        name: 'Default',
        email: settings.emailFrom ? settings.emailFrom.match(/<(.+)>/)?.[1] || settings.emailFrom : '',
        senderName: settings.senderName,
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
  }
  console.log('Default mailboxes created for existing users.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());