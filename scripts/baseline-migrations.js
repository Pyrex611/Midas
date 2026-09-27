// scripts/baseline-migrations.js
//
// Marks every existing migration folder as "already applied" in
// _prisma_migrations, EXCEPT the newest one (route_id), which is genuinely
// new and should actually run via `prisma migrate deploy` afterward.
//
// Why this is needed: prisma/schema.prisma's tables already exist in
// production — every previous deploy ran the OLD vercel-build script,
// which used `prisma db push --accept-data-loss`. `db push` diffs
// schema.prisma against the live DB and applies the difference directly —
// it never writes to `_prisma_migrations` at all. So the tables are real
// and (assuming schema.prisma was kept in sync at each deploy, which is
// what db push guarantees) match what these migrations would produce, but
// Prisma Migrate has no record of any of them ever running. That mismatch
// — real schema, empty history — is exactly what P3005 means. This is
// standard "baselining an existing database":
// https://pris.ly/d/migrate-baseline
//
// Usage (from the project root, with your .env pointing at the SAME
// database Vercel deploys against):
//   node scripts/baseline-migrations.js
//
// Then run `npx prisma migrate status` to confirm a clean baseline before
// redeploying — it should list only the new route_id migration as pending,
// nothing else.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");

// This is the one migration that is genuinely new (adds Domain.routeId) and
// has never been applied anywhere — do NOT mark this one as applied. It
// should be left for `prisma migrate deploy` to actually run for real.
const SKIP = "20260926000000_add_domain_route_id";

const folders = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort(); // migration folder names are timestamp-prefixed, so this is chronological

const toBaseline = folders.filter((name) => name !== SKIP);

if (!folders.includes(SKIP)) {
  console.warn(
    `Warning: expected to find ${SKIP} in prisma/migrations but didn't — ` +
    `baselining ALL found migrations instead. Double-check nothing new got ` +
    `swept up before continuing.`
  );
}

console.log(`Found ${folders.length} migration folder(s). Baselining ${toBaseline.length}, skipping "${SKIP}":\n`);

for (const name of toBaseline) {
  console.log(`--> prisma migrate resolve --applied ${name}`);
  execSync(`npx prisma migrate resolve --applied ${name}`, { stdio: "inherit" });
}

console.log("\nDone. Now run: npx prisma migrate status");
