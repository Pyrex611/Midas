# Phase 1 fixes — integration guide

This bundle contains the files changed for Phase 1 (security + "does automation
actually run" + modular, opt-in email verification). It is NOT a full copy of
the repo — only touched/added files are included, mirroring the original
project's folder structure. Copy each file over its counterpart in the real
repo (`github.com/Pyrex611/Midas`), then follow the steps below.

## 1. Install / no new dependencies required
Nothing new added to `package.json` — `fetch`/`FormData`/`Blob` used in the
verification providers are Node 18+ globals (already required by Vercel's
Node runtime and by `papaparse`'s usage elsewhere in the project).

## 2. Database migration
Two new columns on `UploadJob`: `verify_emails` (boolean, default false) and
`pendingRows` (text, nullable — replaces the old overload of the `error`
column during the `VERIFYING` state).

```bash
npx prisma migrate dev --name add_upload_job_verification_fields
# or, if you prefer to apply the included raw SQL directly against Neon:
# psql "$DATABASE_URL" -f prisma/migrations/20260916_add_upload_job_verification_fields/migration.sql
npx prisma generate
```

## 3. Environment variables — additions/changes
Add to `.env` / your Vercel project's environment variables:

```
# No default anymore — REQUIRED, min 32 chars. Generate with: openssl rand -hex 32
CRON_SECRET=<generate one>

# Was previously allowed to fall back to a hardcoded value — now REQUIRED, min 32 hex chars.
ENCRYPTION_KEY=<generate one, e.g. openssl rand -hex 32>

# Restricts which *.vercel.app preview URLs are trusted for credentialed CORS
# requests. Use your actual Vercel project name.
CORS_VERCEL_PROJECT_PREFIX=midas-aem

# Mailgun region — only set to 'eu' if your Mailgun account was created on
# the EU region (check your Mailgun dashboard).
MAILGUN_REGION=us

# Modular email verification (all optional — omit entirely to keep the
# "Verify emails" checkbox disabled in the UI, exactly as it is today)
VERIFICATION_PROVIDER=mock
# BOUNCEBAN_API_KEY=
# NEVERBOUNCE_API_KEY=
# ZEROBOUNCE_API_KEY=
```

In local development, if `CRON_SECRET`/`ENCRYPTION_KEY` are left unset the
app now auto-generates a temporary value at boot (with a console warning)
instead of using a hardcoded fallback — this keeps `npm run dev` working
without any setup, but **production must set both explicitly** or the app
will refuse to start (this is intentional — see the Phase 1 write-up on why
hardcoded secret defaults were a real vulnerability).

## 4. Turning on real email verification later
When you get an API key from BounceBan, NeverBounce, or ZeroBounce:
1. Set `VERIFICATION_PROVIDER=bounceban` (or `neverbounce` / `zerobounce`).
2. Set the matching `*_API_KEY` env var.
3. Redeploy the **backend only** — no frontend changes or redeploy needed.
   `GET /api/config` will now report `verification.available: true`, and
   the "Verify emails" checkbox on the upload page enables itself
   automatically.

To add a vendor that isn't one of the three included:
1. Create `server/services/verification/providers/<vendor>.provider.ts`
   implementing the `VerificationProvider` interface in
   `server/services/verification/types.ts`.
2. Register it in `PROVIDER_REGISTRY` in
   `server/services/verification/index.ts`.
3. Add `<vendor>` to the `VERIFICATION_PROVIDER` enum in
   `server/config/env.ts` and add its API key var.

## 5. Scheduling — see `docs/SCHEDULING.md`
`vercel.json` now includes the previously-missing `/api/cron/followups`
job, and all three cron routes accept both GET and POST (Vercel Cron always
sends GET — this was silently broken before). Read `docs/SCHEDULING.md` for
the free-tier options (GitHub Actions workflow included, cron-job.org,
Upstash QStash) that get you from "once a day" to "every few minutes"
before paying for Vercel Pro.

## 6. Campaign authorization — behavior change to be aware of
`requireCampaignRole` middleware now actually enforces OWNER/EDITOR/VIEWER
on every campaign-scoped route. Concretely:
- A **VIEWER** can no longer edit/delete a campaign, drafts, domains, or
  follow-up steps via the API (previously anyone with a valid session could,
  regardless of stated role — see Phase 1 write-up).
- Deleting a campaign now requires **OWNER** specifically (not just EDITOR).
- If you have existing campaigns/members created before this change, no
  data migration is needed — the middleware derives role from existing
  `Campaign.userId` / `CampaignMember.role` rows.
- The frontend (`getCampaigns`/`getCampaignDetails` responses) now includes
  a `role` field per campaign — wire this into `CampaignDetail.tsx` to hide
  Rename/Delete/Edit-Strategy/Invite buttons for non-OWNER/EDITOR viewers
  (this UI work is scoped as a Phase 2 item; the API is safe/enforced
  regardless of what the UI shows).

## 7. Dead code — recommend deleting from the real repo
Not included in this bundle (nothing to change, just remove):
- `server/controllers/auth.controller.ts`
- `server/routes/auth.routes.ts` (never imported by `app.ts` — confirm
  before deleting, then remove)
- `server/lib/encryption.ts` (unused — confirm no other branch imports it)
- `src/pages/Dashboard.tsx` (unrouted, and references a stale `UploadArea`
  prop that no longer exists — `onUploadSuccess` vs. the real
  `onJobComplete`)

## 8. Files touched in this bundle
```
server/app.ts                                        (CORS tightened, mounts /api/config)
server/config/env.ts                                 (no hardcoded secret defaults; new verification/CORS/region vars)
server/routes/cron.routes.ts                          (GET+POST, returns summaries)
server/routes/campaign.routes.ts                      (role-gated on every endpoint)
server/routes/config.routes.ts                        (new — public feature-flag endpoint)
server/controllers/campaign.controller.ts             (removed duplicate/incomplete checks now done by middleware; fixed mass-assignment in updateCampaign; domain-ownership check in addDomainToCampaign; AI_REQUEST_DELAY_MS now actually used)
server/controllers/lead.controller.ts                 (verifyEmails wiring, blocklist IDOR fix, collaborator lead visibility, updateLead whitelist)
server/middleware/campaignAccess.middleware.ts        (new — requireCampaignRole)
server/services/emailQueue.service.ts                 (returns summary; unchanged core logic)
server/services/followUp.service.ts                   (returns summary; unchanged core logic)
server/services/leadQueue.service.ts                  (optional/modular verification, fast path when skipped)
server/services/webhooks.service.ts                   (cross-tenant reply-matching fix; real bounce-rate denominator)
server/services/email.service.ts                      (Mailgun EU region support)
server/services/domain.service.ts                     (Mailgun EU region support)
server/services/verification/                         (new — modular provider architecture)
prisma/schema.prisma                                  (UploadJob.verifyEmails, UploadJob.pendingRows)
prisma/migrations/20260916_.../migration.sql          (new)
src/services/api.ts                                   (leadAPI.upload(file, verifyEmails), configAPI)
src/components/UploadArea.tsx                         (verification checkbox, feature-flagged)
vercel.json                                            (adds /api/cron/followups)
.github/workflows/frequent-scheduler.yml               (new — free scheduling backup)
docs/SCHEDULING.md                                     (new)
```

## Phase 2 additions

### Migration
A second migration is included: `prisma/migrations/20260917_add_cron_lock_and_user_settings_fields/`.
Adds the `CronLock` table (seeded with 3 rows: `queue`, `leads`, `followups`)
and real `send_limit`/`send_period` columns on `UserSettings`.

```bash
npx prisma migrate dev --name add_cron_lock_and_user_settings_fields
npx prisma generate
```

### New dependency
```bash
npm install @upstash/qstash
```

### New environment variables
```
# Optional — only needed if you want QStash's signature cryptographically
# verified (see docs/QSTASH_SETUP.md, "Option B"). If omitted, QStash
# requests are still accepted as long as they forward the CRON_SECRET header
# (Option A) — no code changes needed either way.
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

### QStash
See `docs/QSTASH_SETUP.md` for the full procurement checklist and setup
commands. In short: create a free Upstash account, grab `QSTASH_TOKEN` (+
signing keys if using Option B), and create 3 schedules pointing at
`/api/cron/queue`, `/api/cron/leads`, `/api/cron/followups`.

### Cross-scheduler safety (Vercel Cron + GitHub Actions + QStash together)
Two real fixes, not just documentation:
- `server/lib/cronLock.ts` — a DB-backed lock wraps every cron job so only
  one scheduler's invocation runs a given job at a time, regardless of how
  many are configured. `followUp.service.ts`'s old in-memory `isRunning`
  flag (which did nothing across separate serverless instances) was removed
  in favor of this.
- `emailQueue.service.ts` — the domain daily-send-limit check was
  read-then-write (a real race once multiple schedulers can run
  concurrently); it's now a single atomic conditional `UPDATE ... WHERE
  "sentCountToday" < "dailyLimit"`, which closes the overshoot race
  regardless of concurrency.

### Domain "connect existing Mailgun domain" flow
For Mailgun plans that block/limit programmatic domain creation:
- `domain.service.ts::connectExistingDomain` — adopts a domain already
  created in Mailgun's own dashboard via a read-only `GET /v3/domains/:name`
  call (works on every Mailgun tier).
- `POST /api/domains/connect` (`domain.routes.ts`), `domainAPI.connect()`
  (`api.ts`), and a mode toggle in `Domains.tsx` ("Create automatically" vs
  "I already added this in Mailgun").

### CampaignDetail Automation tab
`src/pages/CampaignDetail.tsx` — new "Automation" tab exposing the
previously backend-only auto-reply toggle, send-hour selector, active-hours
+ timezone window, and a full follow-up-step editor (add/edit delay/remove/
generate AI draft per step, save sequence). All of it — plus the existing
Rename/Delete/Edit-Strategy/Invite controls — is now gated by the `role`
field `GET /campaigns` and `GET /campaigns/:id` return: VIEWERs see
automation settings read-only and never see mutating controls; only OWNER
sees Delete Campaign.

### UserSettings
`userSettings.controller.ts::updateSettings` now actually validates and
persists `sendLimit`/`sendPeriod` instead of silently discarding the
request body. **Not yet wired into enforcement** (the queue doesn't check
it yet) — that's a fast-follow, tracked in the Phase 3 list, so it's
honest about current scope but no longer a fake save.

### Not yet done from the original Phase 2 scope (tracked, not silently dropped)
- Deleting the confirmed dead files (`auth.controller.ts`, `auth.routes.ts`,
  `Dashboard.tsx`) — still just a deletion, no code depends on this bundle.
- Unsubscribe/`List-Unsubscribe` compliance — scoped for the next pass.
- Wiring `UserSettings.sendLimit` into `emailQueue.service.ts`'s send
  decision.

