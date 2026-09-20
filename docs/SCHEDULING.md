# Scheduling on Vercel's free (Hobby) plan — and how to get near-real-time sending without paying for Pro yet

## The problem

Vercel Cron on the **Hobby (free) plan** can only invoke a given cron job
**once per day**. `vercel.json` in this repo schedules three jobs (queue,
leads, followups) once a day each — which means, natively, the email send
queue, lead-verification pipeline, and follow-up sequencer would each only
tick once every 24 hours. That is not "smooth" lead upload or campaign
management; it's "check back tomorrow".

Two other bugs compounded this before this fix:
1. The cron routes only accepted `POST`, but **Vercel Cron always sends
   `GET`** — so even the once-a-day invocation was silently 404ing.
   (Fixed: `server/routes/cron.routes.ts` now accepts both.)
2. `/api/cron/followups` wasn't in `vercel.json` at all, so follow-up steps
   had **no** scheduled trigger, ever. (Fixed: added to `vercel.json`.)

## The fix: layer several free triggers instead of relying on Vercel's native cron alone

All three `/api/cron/*` endpoints are **idempotent and safe to call
concurrently** — they claim work with `SELECT ... FOR UPDATE SKIP LOCKED`,
so multiple schedulers hitting the same endpoint around the same time will
never double-send an email or double-process an upload. That means you can
freely stack several free schedulers on top of each other with zero risk.

### 1. GitHub Actions (included — `.github/workflows/frequent-scheduler.yml`)

Free for any GitHub repo, runs every ~5 minutes (GitHub's stated minimum
granularity; under load it can slip by a few extra minutes — treat it as
"roughly every 5 minutes"). Setup:

1. In your GitHub repo settings → Secrets and variables → Actions, add:
   - `MIDAS_BASE_URL` — e.g. `https://your-app.vercel.app`
   - `MIDAS_CRON_SECRET` — the same value as your `CRON_SECRET` env var
2. That's it — the workflow is already in the repo and will start running
   on the next scheduled tick (or trigger it manually from the Actions tab
   to test immediately).

This alone gets you from "once a day" to "every ~5 minutes" for $0.

### 2. cron-job.org (zero code, most reliable free option)

[cron-job.org](https://cron-job.org) is a free scheduler that can hit a URL
as often as **once a minute**, with a simple web UI, retry/failure alerts,
and no code to maintain.

Setup: create three jobs, each:
- URL: `https://your-app.vercel.app/api/cron/queue` (repeat for `/leads`
  and `/followups`)
- Method: `POST`
- Custom header: `Authorization: Bearer <your CRON_SECRET>`
- Schedule: every 1–2 minutes for `queue`, every 5 minutes for `leads` and
  `followups` (verification jobs and follow-up windows don't need
  sub-minute precision)

This is the recommended primary scheduler if you want the tightest loop
before upgrading Vercel, because unlike GitHub Actions it isn't subject to
GitHub's own scheduler load/backpressure.

### 3. Upstash QStash (best long-term fit, still has a generous free tier)

[Upstash QStash](https://upstash.com/docs/qstash) is a proper HTTP task
queue with built-in scheduling, delivery retries, and dead-letter handling
— free tier includes 500 messages/day. This is now the **primary**
scheduler in the recommended 3-way stack (Vercel Cron + GitHub Actions +
QStash) — see `docs/QSTASH_SETUP.md` for the full procurement checklist
(Upstash account, `QSTASH_TOKEN` + signing keys), both integration options
(forwarded static secret vs. verified signature), and the exact commands to
create the three schedules.

**Running all three together is safe by construction**, not just by
convention: every cron route is wrapped in a database-backed lock
(`server/lib/cronLock.ts`) so only one scheduler's invocation actually runs
a given job at a time, on top of the existing row-level
`FOR UPDATE SKIP LOCKED` claiming and an atomic per-send domain-limit claim
that closes a real overshoot race that would otherwise appear once multiple
schedulers can trigger genuinely concurrent instances. Full detail in
`docs/QSTASH_SETUP.md`'s "Why three overlapping schedulers can't corrupt
anything" section. The recommended frequency split (QStash tight, GitHub
Actions as a slower backup, Vercel Cron kept as the once-a-day ultimate
fallback) is also there — don't run all three at max frequency; it wastes
Neon connection budget for zero benefit once QStash is live.

### 4. Opportunistic triggering (already implemented, free, zero setup)

Independent of any external scheduler, the app now calls
`emailQueueService.processQueue()` in a fire-and-forget way right after
events that create new work — e.g. right after a campaign is created with
leads, or leads are added to an active campaign (see
`server/controllers/campaign.controller.ts`). This means that whenever a
user is actively using the app, sends start moving immediately rather than
waiting for the next scheduler tick — the scheduled triggers above are the
safety net for when nobody's actively using the app, not the only path.

## Once you upgrade to Vercel Pro

Vercel Pro allows cron schedules down to once per minute and more cron
jobs. At that point:
1. Tighten the schedules in `vercel.json` (e.g. `*/2 * * * *` for `queue`).
2. You can disable the GitHub Actions workflow and/or the cron-job.org jobs
   — or just leave them running as a redundant backup (they're free and
   harmless to keep, per the concurrency-safety note above).

## Beyond cron: where this architecture should go next

Polling on any schedule — free or paid — means worst-case latency equal to
the poll interval. If true near-real-time sending matters (e.g. firing a
follow-up the instant its delay window opens, or sending the first email
seconds after a campaign launches with leads), the durable next step is to
replace polling with **event-driven dispatch**: when a `PendingEmail` row
is created, immediately enqueue an Upstash QStash (or similar) message
scheduled for exactly the right time, rather than waiting for the next
`processQueue()` sweep to notice it. This is a Phase 3 item — see the main
plan — because the current polling model, once actually running every few
minutes via the options above, is good enough for a cold-email cadence
(which is never truly instant regardless, since domain warmup/daily limits
throttle sends anyway).
