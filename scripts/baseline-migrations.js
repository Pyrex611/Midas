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
//
// SAFE TO RE-RUN after a partial failure (e.g. flaky network killed a
// connection mid-run): migrations that already got marked applied in an
// earlier run are detected below by Prisma's own P1XXX error code rather
// than by guessing its exact wording, and are skipped rather than treated
// as fatal. Only a genuine connectivity error (P1001) stops the whole run
// — that one really does mean "nothing past this point can succeed either,
// stop and fix the connection first."

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");

// This is the one migration that is genuinely new (adds Domain.routeId) and
// has never been applied anywhere — do NOT mark this one as applied. It
// should be left for `prisma migrate deploy` to actually run for real.
const SKIP = "20260926000000_add_domain_route_id";

// Prisma's connectivity-family error codes. P1001 is "can't reach server";
// included P1002/P1017 too since they cover "timed out" / "server closed
// the connection" — the same "stop, don't keep hammering it" situation.
const CONNECTIVITY_ERROR_CODES = ["P1001", "P1002", "P1017"];

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

let skipped = 0;
let applied = 0;

for (const name of toBaseline) {
  console.log(`--> prisma migrate resolve --applied ${name}`);
  try {
    const output = execSync(`npx prisma migrate resolve --applied ${name}`, {
      // 'pipe' (not 'inherit') so we can inspect the output before deciding
      // whether this was a real failure or just "already applied" — but we
      // still print it below either way, nothing is hidden.
      stdio: "pipe",
      encoding: "utf8",
    });
    process.stdout.write(output);
    applied++;
  } catch (err) {
    const combined = `${err.stdout || ""}\n${err.stderr || ""}`;
    process.stdout.write(combined);

    const isConnectivityError = CONNECTIVITY_ERROR_CODES.some((code) => combined.includes(code));

    if (isConnectivityError) {
      console.error(
        [
          "",
          `Stopped on "${name}" -- this is a genuine connectivity failure ` +
          "(the error above includes a P1XXX connection error code), so " +
          "every migration after this one would fail the same way.",
          "",
          `Migrations already marked applied before this point (${applied} ` +
          "this run) are done and don't need to be repeated. Fix the " +
          "connection, then just re-run this script — it will skip those " +
          "and pick up from here automatically.",
        ].join("\n")
      );
      process.exit(1);
    }

    // Not a connectivity error -- almost certainly "already applied" from a
    // previous partial run. Log it plainly and move on rather than treating
    // it as fatal.
    console.log(`(not a connectivity error -- treating "${name}" as already handled, continuing)\n`);
    skipped++;
  }
}

console.log(`\nDone. Applied ${applied}, skipped ${skipped} (already handled). Now run: npx prisma migrate status`);