# AGENTS.md — Master Architecture Blueprint & Engineering Protocol

This document establishes the non-negotiable operational directives, architectural invariants, past incident postmortems, and module ownership maps for human engineers and AI agents contributing to the **MIDAS Autonomous Email Management System** (`v3.3.1-PROD`).

---

## 1. MANDATORY CODE GENERATION & WORKFLOW LAWS

### Law 1: Full, Unabridged Code Delivery (Zero Truncation)
- **No Partial Snippets:** Never output partial diffs, `// ... rest unchanged`, or omitted sections. Every modified or newly created file must be delivered **in full from line 1 to EOF**.

### Law 2: Strict Client (`src/`) vs. Server (`server/`) Boundary Isolation
- **`server/` (Node.js Runtime):** Compiled under `tsconfig.server.json`. Must never import React, JSX, or DOM packages.
- **`src/` (Browser Vite SPA):** Compiled under `tsconfig.client.json` (`"types": ["vite/client"]`).
  - **CRITICAL:** Never import `prisma`, `pg`, `fs`, `crypto`, `server/`, and **never reference `NodeJS` types (`NodeJS.Timeout`) or the global `process` identifier** in `src/`. Use `ReturnType<typeof setTimeout>` / `ReturnType<typeof setInterval>` and `import.meta.env` (or `globalThis` safe accessors if isomorphic).

### Law 3: Non-Destructive Evolutionary Migrations
- **Zero Feature Drops:** When consolidating UI modals into `Sheet` drawers or splitting controllers, verify every prior editable field remains accessible (e.g., `campaign.context`, `reference`, and `senderName` salvaged from legacy modals into `EditStrategyModal.tsx` & `CampaignSettingsTab.tsx`).

### Law 4: Strict TypeScript Set/Map Parameterization
- Whenever constructing `Set` or `Map` instances from untyped `req.body` or `any[]` rows, explicitly parameterize generics (`new Set<string>(...)`, `const uniqueEmails: string[] = ...`) so TypeScript 5.3 never infers `unknown[]`.

### Law 5: Windows CMD (`cmd.exe`) CLI Compatibility
- Deliver operator shell commands formatted for **Windows CMD** (`\` path separators, `del /f /q`, `^` line continuations) unless Unix bash is explicitly requested.

---

## 2. NON-NEGOTIABLE ARCHITECTURAL INVARIANTS

1. **Zero Bulk Loops on Outbound Sends:** Every campaign or newsletter send must insert queue items (`PendingEmail` or `NewsletterQueueItem`) and drain through bounded sweeper ticks (`SEND_SWEEP_BATCH_SIZE = 5`, `SENDER_COOLDOWN_SECONDS = 20`) locked via `CronLock` (`withCronLock`) and interactive `prisma.$transaction` `FOR UPDATE SKIP LOCKED`.
2. **Delimiter Separation & Raw Queue Templates:** Variable interpolation (`{{name}}`, `{{artifact:slug}}`) executes **FIRST**; pipe-delimited Spintax (`{Option A|Option B}`) executes **SECOND** (never stripping braces without `|`). `PendingEmail` rows (`createCampaign`, `queueReconciliationService`, `followUpService`, `repersonalizeCampaignQueue`) MUST store **raw templates** so `emailQueueService` resolves artifacts, dynamic spintax, and unsubscribe links cleanly at dispatch time.
3. **Public CORS Isolation:** External drop-in widget & tracking routes (`/api/public/town-crier*`, `/api/track*`, `/api/unsubscribe*`) must execute `publicWildcardCors` (`origin: '*'`) in `server/app.ts` **ahead** of rate limiters and restrictive dashboard CORS so third-party `OPTIONS` preflights and `429`/`413` responses never fail CORS.
4. **Auth/OTP Delivery Guard:** Supabase Send Email Hook dispatches (`authEmailHook.service.ts`) MUST set `disableTracking: true` (disabling Mailgun `o:tracking*` flags) so corporate security scanners cannot pre-consume 6-digit OTPs or confirmation links.
5. **`isAdmin` Zero-Lockout & PlanGuard Bypass:** `requireAdmin.middleware.ts` checks `User.isAdmin` fresh against PostgreSQL (never trusting stale 3-minute auth caches), unlocks `/admin` in Bootstrap Mode when `adminCount === 0`, blocks revoking the final admin, and `PlanGuardService` bypasses all caps for `isAdmin` accounts.
6. **OOO Freeze Without Cadence Termination:** `SequenceAgentService` marks `OUT_OF_OFFICE` replies as `status: 'FOLLOW_UP', outreachStatus: 'OOO_FROZEN'` with `LeadActivityEvent` `frozenUntil`. `FollowUpService` treats incoming OOO records (`intent === 'OUT_OF_OFFICE'`) as non-terminal and resumes sequential steps once `now >= frozenUntil`.
7. **Prisma Migration Safety (`vercel-build`):** Production builds run `prisma generate && node scripts/baseline-migrations.js --auto && prisma migrate deploy && tsc -p tsconfig.server.json && vite build` (never `prisma db push --accept-data-loss`). New schema additions must include idempotent SQL migration folders under `prisma/migrations/`.

---

## 3. MODULE OWNERSHIP & INTERCONNECTION MAP

| Subsystem | Authoritative Backend Modules | Authoritative Frontend Modules |
| :--- | :--- | :--- |
| **Auth, OTP Hook & Admin RBAC** | `auth.middleware.ts`, `requireAdmin.middleware.ts`, `dualAuth.middleware.ts`, `authEmailHook.service.ts`, `operatorAuth.ts`, `admin.controller.ts` | `AuthContext.tsx`, `supabaseAuth.ts`, `AuthExperience.tsx`, `Login.tsx`, `SignUp.tsx`, `AdminDashboard.tsx` |
| **Billing & Quotas (Dodo)** | `services/billing/plans.ts`, `dodo.service.ts`, `planGuard.service.ts`, `routes/billing.routes.ts` | `PlanSelectorModal.tsx`, `PersonaOnboardingModal.tsx`, `BillingSettings.tsx`, `AppShell.tsx` |
| **Cold Campaigns & Queues** | `controllers/campaign/*`, `emailQueue.service.ts`, `followUp.service.ts`, `queueReconciliation.service.ts`, `sequenceAgent.service.ts` | `Campaigns.tsx`, `CampaignDetail.tsx`, `CampaignHeader.tsx`, `SequenceCanvas.tsx`, `EditStrategyModal.tsx`, `DeliverabilityGrader.tsx`, `SpintaxSimulator.tsx` |
| **Leads & Ingestion** | `lead.controller.ts`, `leadQueue.service.ts`, `enrichment.service.ts`, `services/verification/*` | `Home.tsx`, `Leads.tsx`, `UploadArea.tsx`, `LeadDrawer.tsx` |
| **Town Crier & Embeds** | `townCrier.controller.ts`, `routes/public/townCrier.public.routes.ts` (`widget.js`), `newsletterQueue.service.ts` | `TownCrier.tsx`, `TownCrierComposerDrawer.tsx`, `TownCrierGongDrawer.tsx`, `TownCrierEmbedDrawer.tsx`, `GongQuickstartModal.tsx` |
| **Domains, Multi-ESP & Telemetry** | `domain.service.ts`, `sender.service.ts`, `dns.service.ts`, `services/esp/*`, `sandbox.service.ts`, `snapshot.service.ts`, `track.controller.ts`, `webhooks.service.ts` | `Domains.tsx`, `DomainCard.tsx`, `ConnectDomainDrawer.tsx`, `BimiAvatarDrawer.tsx`, `SandboxCard.tsx`, `Inbox.tsx` |
| **AI Studio, KB, Artifacts & Webhooks** | `ai.service.ts`, `promptManager.service.ts`, `knowledgeBase.service.ts`, `artifact.service.ts`, `webhookDispatch.service.ts`, `notification.service.ts` | `UserSettings.tsx`, `KnowledgeBasePanel.tsx`, `ArtifactsPanel.tsx`, `ApiKeySettings.tsx`, `WebhookSettings.tsx`, `DeveloperDocs.tsx` |

---

## 4. HISTORICAL INCIDENTS, BUGS & TRAPS (DO NOT REINTRODUCE)

1. **Prisma `P3005` on DB-Push Databases:** Historical migrations 1–8 referenced `"User"` instead of `"users"`. Solved via idempotent `20261117000000_enterprise_schema_sync` + `scripts/baseline-migrations.js --auto`.
2. **Mailgun 401 Plain-Text JSON Crash:** Mailgun returns plain-text `Forbidden` on bad keys. Always read `await res.text()` and parse JSON inside `try/catch`.
3. **Circular Service Import (`TS2303`/`TS2459`):** Never import `email.service.ts` into itself.
4. **Vercel AI Gateway 404:** Canonical endpoint is `https://ai-gateway.vercel.sh/v1` (never `api.vercel.ai`).
5. **Reasoning Model Token Burnout:** Thinking models (`nemotron`, `deepseek-r1`) exhaust tokens before emitting JSON; allocate `3500+` tokens and disable Gemini `thinkingBudget` for structured outputs.
6. **ToastContext Flicker:** Always wrap context `toast` methods in `useMemo`.
7. **Spintax Stripping Variables:** Variables interpolate first; Spintax regex strictly requires a pipe `|`.
8. **Vite/Rollup `react-dropzone` Cache Error:** Without committed `package-lock.json`, Vercel build cache pruning broke `react-dropzone` resolution. Solved permanently by native HTML5 drag-and-drop in `UploadArea.tsx`.
9. **`Set<unknown>` Inference (`TS2322`/`TS2345`):** `Array.from(new Set(anyArray))` infers `unknown[]` in TS 5.3; always use `new Set<string>(...)`.
10. **Client TypeScript `NodeJS` / `process` Failure:** `tsconfig.client.json` enforces `"types": ["vite/client"]`; never use `NodeJS.Timeout` or global `process` in `src/` (use `ReturnType<typeof setTimeout>` and `globalThis` safe lookup).
11. **Clerk-Migrated Password Reset Silent `200 OK`:** Calling Supabase `/auth/v1/recover` for users missing from `auth.users` silently no-ops. Solved via `POST /auth/v1/otp` (`create_user: true`) + `PUT /auth/v1/user`.
12. **Dodo Monthly/Annual Separate Products:** Dodo requires separate `product_id`s per billing interval; `annualAvailable` gates the UI toggle dynamically.
13. **Global CORS Blocking Widget Preflights:** Always mount `publicWildcardCors` ahead of rate limiters and dashboard CORS.
14. **PromptManager Dropping `companyContext` & FollowUp Stripping Artifacts:** `PromptManager.buildPrompt` must explicitly append `params.companyContext`, and `FollowUpService` must enqueue raw templates.

---

## 5. COMPLETE AGENT CONTRIBUTION LOG

| Date | Engineer / Agent | Milestone / Files Modified | Notes & Verification |
|---|---|---|---|
| 2026-10-29 | Staff Principal | Milestone 1 Hardening | Decoupled AI draft loops, interactive Prisma queue claims. |
| 2026-11-04 | Staff Principal | Phases A & B | Town Crier, BIMI/DMARC, Lineicons, Knowledge Base, Artifacts, Dodo Billing. |
| 2026-11-17 | Staff Principal | Stage 1 & 2 | Fixed widget CORS, KB grounding, OOO freeze, salvaged `EditCampaignModal`/`EditSenderModal`, purged 17 dead files, locked down `operatorAuth.ts`, switched `vercel-build` to `prisma migrate deploy`, removed `react-dropzone`. |
| 2026-11-18 | Staff Principal | Stage 3A | Claude-style Auth UI v2 (Town Crier static default + arrow toggle, Google active, Apple blurred), Supabase Send Email Hook OTPs, `isAdmin` zero-lockout bootstrap & PlanGuard bypass, Persona Onboarding $\rightarrow$ Plan Selector Modal, OTP Set/Reset Password for Clerk migration. |
| 2026-11-19 | Staff Principal | Stage 3A CI Fix & Docs Sync | Replaced `NodeJS.Timeout` & global `process` in `AdminDashboard.tsx`, `UploadArea.tsx`, and `townCrierClient.ts`; consolidated complete roadmap & handover context into `PLAN.md` and `AGENTS.md`. |