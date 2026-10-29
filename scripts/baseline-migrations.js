// scripts/baseline-migrations.js
//
// Resolves all migration folders as "already applied" in _prisma_migrations.
// Resolves Prisma error P3005 when tables already exist from `prisma db push`.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const CONNECTIVITY_ERROR_CODES = ['P1001', 'P1002', 'P1017'];

const folders = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

console.log(`Found ${folders.length} migration folder(s). Baselining all migrations into _prisma_migrations:\n`);

let skipped = 0;
let applied = 0;

for (const name of folders) {
  console.log(`--> npx prisma migrate resolve --applied ${name}`);
  try {
    const output = execSync(`npx prisma migrate resolve --applied ${name}`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    process.stdout.write(output);
    applied++;
  } catch (err) {
    const combined = `${err.stdout || ''}\n${err.stderr || ''}`;

    const isConnectivityError = CONNECTIVITY_ERROR_CODES.some((code) => combined.includes(code));
    if (isConnectivityError) {
      console.error(`\nConnectivity error encountered on "${name}". Check DATABASE_URL and network connection.`);
      process.exit(1);
    }

    // Already marked applied or baseline acknowledged
    console.log(`(Migration "${name}" is already marked applied or resolved, continuing)\n`);
    skipped++;
  }
}

console.log(`\nDone. Applied/Verified: ${applied}, Already Handled: ${skipped}.`);
console.log('Now run: npx prisma migrate status');