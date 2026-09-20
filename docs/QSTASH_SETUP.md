# Upstash QStash integration

QStash is a managed HTTP task queue/scheduler from Upstash. It's the
**primary, most reliable** scheduler in the 3-way stack (Vercel Cron +
GitHub Actions + QStash) because — unlike a plain cron ping — it retries
failed deliveries automatically and gives you delivery logs in a dashboard.

## What to procure

1. Create a free Upstash account: https://console.upstash.com (no credit
   card required for the free tier).
2. In the console, open the **QStash** tab (it's account-wide — there's
   nothing per-project to provision, unlike their Redis/Kafka products).
3. Copy three values from the QStash tab's "Request Builder" / API keys
   section:
   - `QSTASH_TOKEN` — used to create/manage schedules via their REST API.
   - `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` — used to
     verify that an incoming request genuinely came from QStash (optional
     but recommended — see Option B below).
4. Free tier covers 500 messages/day, which comfortably fits the schedule
   recommended below (see "Recommended frequency split").

## Install

```bash
npm install @upstash/qstash
```

(Already referenced by `server/middleware/cronAuth.middleware.ts` in this
bundle — nothing else in the code needs it.)

## Environment variables

```
# Only needed if you want QStash's signature verified (Option B below).
# If omitted, QStash requests are still accepted as long as they carry the
# forwarded CRON_SECRET header (Option A) — the auth middleware in this
# bundle supports both simultaneously.
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

## Creating the three schedules

You have two options for how QStash authenticates to your API. Pick one —
both are equally valid and the code accepts either without further changes.

### Option A — forward the existing CRON_SECRET (simplest, no new env vars needed on the QStash side)

QStash lets you forward arbitrary headers to the destination using the
`Upstash-Forward-<Header-Name>` convention. This reuses the exact same
static-secret check that already protects Vercel Cron and the GitHub
Actions workflow — no signature verification setup required.

```bash
curl -X POST "https://qstash.upstash.io/v2/schedules/https://your-app.vercel.app/api/cron/queue" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Upstash-Cron: */2 * * * *" \
  -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET"

curl -X POST "https://qstash.upstash.io/v2/schedules/https://your-app.vercel.app/api/cron/leads" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Upstash-Cron: */5 * * * *" \
  -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET"

curl -X POST "https://qstash.upstash.io/v2/schedules/https://your-app.vercel.app/api/cron/followups" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Upstash-Cron: */10 * * * *" \
  -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET"
```

### Option B — verified QStash signature (more secure, no shared secret sent over the wire)

Skip the `Upstash-Forward-Authorization` header entirely and instead set
`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` on your backend. The
`verifyCronRequest` middleware in this bundle will verify the
`Upstash-Signature` header QStash automatically attaches, cryptographically
confirming the request came from Upstash — nothing else changes.

```bash
curl -X POST "https://qstash.upstash.io/v2/schedules/https://your-app.vercel.app/api/cron/queue" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Upstash-Cron: */2 * * * *"
# (repeat for /leads at */5 and /followups at */10, same as above, just
#  without the Upstash-Forward-Authorization header)
```

Both can also be set up from the Upstash console UI under QStash →
Schedules → Create Schedule, if you prefer clicking over curl.

## Recommended frequency split across all three schedulers

Running all three (Vercel Cron, GitHub Actions, QStash) at maximum
frequency simultaneously is unnecessary and adds avoidable load on Neon's
free-tier connection limit (every invocation opens a DB connection, however
briefly). Recommended allocation once all three are live:

| Job | Vercel Cron (native, Hobby = 1x/day) | GitHub Actions (backup) | QStash (primary) |
|---|---|---|---|
| `/api/cron/queue` | `0 9 * * *` (kept as an ultimate fallback) | every ~10 min | every 2 min |
| `/api/cron/leads` | `0 10 * * *` | every ~15 min | every 5 min |
| `/api/cron/followups` | `0 11 * * *` | every ~15 min | every 10 min |

This gives you a genuinely responsive primary path (QStash, with retries)
plus two independent, much slower backups — rather than three schedulers
all hammering the same endpoint every 1-2 minutes, which buys you nothing
(the lock in `server/lib/cronLock.ts` would just make two of the three
no-op on every tick) while using up connection/log budget for no benefit.

**This is safe by construction, not just by convention** — see
"Why three overlapping schedulers can't corrupt anything" below.

## Why three overlapping schedulers can't corrupt anything

1. **Job-level**: every cron route is wrapped in `withCronLock()`
   (`server/lib/cronLock.ts`), a database row-based lock. If Vercel Cron,
   GitHub Actions, and QStash all happen to fire within the same minute,
   exactly one of them actually runs the job body — the others get
   `{ skipped: true }` back immediately and cost nothing but a cheap UPDATE.
2. **Row-level** (defense in depth, in case the job-level lock is ever
   bypassed or mid-transition): `emailQueue.service.ts` and
   `leadQueue.service.ts` claim individual rows with
   `SELECT ... FOR UPDATE SKIP LOCKED`, so even fully concurrent execution
   can't double-send the same email or double-import the same upload job.
3. **Domain daily-limit race** (the specific "different sort of issue" this
   was checked for): sending an email now atomically claims a slot via
   `UPDATE "Domain" SET "sentCountToday" = "sentCountToday" + 1 WHERE
   "sentCountToday" < "dailyLimit"` — two concurrent instances can never
   both believe they have room left when only one slot remains.
