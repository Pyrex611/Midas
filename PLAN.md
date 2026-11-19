# PLAN.md — Master Engineering & Product Delivery Roadmap (Full Context Ledger)

**Project:** MIDAS Autonomous Email Management System (`Golden Email Infrastructure`)  
**Current Version:** `v3.3.1-PROD`  
**Hosting & Runtime:** Vercel Serverless (`/api/index.ts`, Node 20, 30s `maxDuration`, 15s Express `requestTimeoutGuard`) + Vite React 18 SPA  
**Database & Storage:** Supabase PostgreSQL (`prisma/schema.prisma`, `@prisma/adapter-pg` + `pg.Pool` max 2; Neon backward-compatible) + Supabase Storage (`midas-uploads`) / Vercel Blob  
**Auth & Billing:** Supabase Auth (Google OAuth + MIDAS-delivered 6-Digit Email OTP + Password + OTP Password Set/Reset for Clerk-migrated accounts) + Legacy Clerk dual support + Dodo Payments (`SCOUT` / `CHIEF` / `SYNDICATE`)  

---

## 1. COMPLETED DEVELOPMENT ARCHIVE (THROUGH `v3.3.1-PROD`)

### Phase 1–3 & Pre-Main Foundations (Completed)
- [x] **Security & RBAC:** Tightened CORS, removed hardcoded secret fallbacks, added `requireCampaignRole` (`OWNER`/`EDITOR`/`VIEWER`), scoped cross-tenant reply matching to domain owners, modularized verification (`mock`, `bounceban`, `neverbounce`, `zerobounce`).
- [x] **Multi-Scheduler Safety:** `CronLock` table (`queue`, `leads`, `followups`, `newsletter`, `snapshots`), atomic conditional `Sender` quota claiming, Upstash QStash verification (`cronAuth.middleware.ts`), Campaign Automation UI tab.
- [x] **Deliverability Split:** Separated `Domain` (DNS/credentials/BIMI) from `Sender` (per-mailbox warmup & daily quotas), added RFC-8058 one-click unsubscribe (`/api/unsubscribe/:token`), BYO Mailgun encrypted keys, and `/admin` operator view.

### Phases A, B & C.0/C.1: Dual-Engine, AI Studio, Knowledge Base & SDKs (Completed)
- [x] **Dual-Engine Architecture:** Bounded `LIMIT 5` queue sweeps (`SEND_SWEEP_BATCH_SIZE = 5`) + 20s per-sender cooldowns (`SENDER_COOLDOWN_SECONDS = 20`) across **Campaigns** (outbound rotation) and **Town Crier** (`Gong` newsletter channels + sub-60s welcome autoresponders + Shadow-DOM `widget.js` with progressive profiling).
- [x] **Multi-ESP & DNS Telemetry:** Pluggable `EspRouterService` (`mailgun`, `resend` guarded against cold outreach, `smtp`), authoritative DNS/DMARC/BIMI inspector (`dns.service.ts`), bot-filtered open/click tracking (`isBotScanner` handling Apple MPP `17.0.0.0/8`), `DomainHealthSnapshot`, and Zero-Setup Sandbox (`sandbox.service.ts`).
- [x] **AI Studio, Grounding & Billing:** Multi-provider AI Studio (`aigateway`, `openrouter`, `gemini`, `openai`, `deepseek`, `ollama`, `mock`) with encrypted keys & topbar switcher; `KnowledgeBase` (Text, SSRF-guarded URL scrapes, pure-Node `.pdf`/`.docx`/`.md` extraction); `Artifact` smart links (`{{artifact:slug}}`) & MIME attachments; `SequenceAgentService` 9-intent state-graph classifier; `ComplianceService` pre-flight grader; `EnrichmentService`; Dodo Payments tiering (`SCOUT` Free, `CHIEF` $35/mo, `SYNDICATE` $99/mo); Priority Notification Center + desktop alerts; SSRF-guarded HMAC CRM Webhooks.
- [x] **Royal Thistle UI & SDKs:** `#F3EBF6` / `#4A2559` / `#D4AF37` design system (`src/index.css`), Lineicons 4.0 (`src/lib/icons.tsx`), `AppShell`, `Sheet` slide-over drawers, `ConfirmDialog`, `CommandPalette` (`Cmd+K`), `@midas-aem/client` (ESM/CJS/React/CLI), `midas-aem` Python SDK, `cli/midas.js`, standalone 3-column `/docs` portal.

### Stage 1: Stabilization Patch Sprint (Completed)
- [x] **PATCH-1.1 (Public Widget CORS):** Isolated `publicWildcardCors` (`origin: '*'`) ahead of rate limiters on `/api/public/town-crier*`, `/api/track*`, and `/api/unsubscribe*` in `server/app.ts`.
- [x] **PATCH-1.2 (AI Grounding & Salvaged Strategy Editing):** Injected `params.companyContext` in `PromptManager.buildPrompt()`, propagated `campaignId` from `campaign.core` & `campaign.drafts` controllers, and salvaged `context`, `reference`, and `senderName` from legacy `EditCampaignModal`/`EditSenderModal` into `EditStrategyModal.tsx` & `CampaignSettingsTab.tsx`.
- [x] **PATCH-1.3 (Inbox Polling Closure):** Fixed stale `activeThreadId` closure inside 20s polling interval in `src/pages/Inbox.tsx`.
- [x] **PATCH-1.4 (Follow-Up, OOO State-Graph & Bounce Hygiene):** Preserved raw templates inside `FollowUpService` so `{{artifact:slug}}` & Spintax resolve at dispatch time; implemented `OOO_FROZEN` + `frozenUntil` pause/resume cycle in `sequenceAgentService` & `followUpService`; propagated `userId`/`campaignId`/`brandOptions`/`PlanGuard` into `sequenceAgentService`; purged `PendingEmail` on bounces/complaints; skipped `BOUNCED` leads in `emailQueueService`; fixed `Set<string>` TS inference in `townCrier.public.routes.ts` & `townCrier.controller.ts`.
- [x] **PATCH-1.5 (PlanGuard & Artifact Parity Across Queues):** Enforced monthly caps & `recordEmailSent()` inside `emailQueueService` & `newsletterQueueService`; wired `artifactService` (`{{artifact:slug}}` + `MIME_ATTACHMENT`) into `newsletterQueueService`; added & wired `assertDomainCapacity`, `assertSenderCapacity`, `assertGongCapacity`, `assertLeadCapacity`, `assertSubscriberCapacity`, and `assertFeatureAccess`.
- [x] **PATCH-1.6 (Multi-ESP, Auth, Webhooks & Cron Snapshots):** Added `nodemailer` + `@types/nodemailer` and live Resend/SMTP credential verification inside `domainService.connectEspDomain()`; added `/api/cron/snapshots` to `vercel.json` & `frequent-scheduler.yml`; added `redirect: 'manual'` in `webhookDispatchService`; handled missing tokens with `401` in dual-auth mode; added `leads:*` API scopes; fixed `getMyInvites` (`sender` projection) & `acceptInvite` (email verification + `upsert`).

### Stage 2: Cleanup, Pre-Launch Gate & Build Fixes (Completed)
- [x] **CLEANUP-2.1:** Purged 17 superseded dead files (`campaign.service.ts`, `draft.service.ts`, `autoReply.service.ts`, `lead.service.ts`, 11 unused UI components, `midas-client-1.0.0.tgz`, `INTEGRATION.md`).
- [x] **CLEANUP-2.2:** Untracked `README.md` from `.gitignore`, created root `README.md`, cleaned formatting in `INTENT.md` and `GUIDE.md`.
- [x] **LAUNCH-2.3:** Created idempotent `20261117000000_enterprise_schema_sync` migration + `scripts/baseline-migrations.js --auto` so `vercel-build` runs `prisma migrate deploy` cleanly on Supabase; removed hardcoded production fallback secrets in `operatorAuth.ts` & `tracking.ts` and exposed passphrase hint from `AdminDashboard.tsx`.
- [x] **BUILD-FIX:** Replaced `react-dropzone` inside `src/components/UploadArea.tsx` with native HTML5 drag-and-drop and removed `react-dropzone` from `package.json`; fixed `NodeJS.Timeout` and global `process` TS errors in `AdminDashboard.tsx`, `UploadArea.tsx`, and `src/lib/townCrierClient.ts` so `tsconfig.client.json` (`npm run typecheck`) passes cleanly.

### Stage 3A: Auth v2, Supabase OTP Hook, `isAdmin` Bootstrap, Onboarding & Plan UI (Completed)
- [x] **Auth UI v2 (`AuthExperience.tsx`, `Login.tsx`, `SignUp.tsx`):** Claude.ai-inspired split card layout — Left static minimalist Town Crier Showcase Card (Page 1) & Outbound Showcase Card (Page 2) toggled via plain background-free `<` / `>` arrows; Right Auth Card with Google OAuth active, Apple OAuth frosted/disabled ("Soon"), 6-digit Email OTP (default), Password login, and **Set / Reset Password via 6-Digit OTP** (creates/recovers Supabase credentials cleanly for Clerk-migrated accounts via `POST /auth/v1/otp` `create_user: true` + `PUT /auth/v1/user`).
- [x] **Supabase Send Email Auth Hook (`authEmailHook.service.ts`):** Standard Webhooks verified `POST /api/webhooks/supabase/auth-email` dispatching 6-digit OTPs, magic links, email change tokens, and password change alerts through MIDAS's Royal Thistle card envelope & ESP router with link/open tracking disabled (`disableTracking: true`).
- [x] **`isAdmin` Zero-Lockout Bootstrap & Bypass:** `requireAdmin` verifies `isAdmin` directly from Postgres (zero stale cache); `GET /api/admin/access-status` enables Bootstrap Mode whenever `adminCount === 0`; `AdminDashboard.tsx` allows claiming first admin, managing admin roles (with Last-Admin revocation guard), and redirects non-admins to `/`; `PlanGuardService` grants `isAdmin` unlimited quotas.
- [x] **Persona Onboarding $\rightarrow$ Plan Selector Modal:** Added `onboarding_persona` & `onboarding_completed_at` to `UserSettings` (`20261118000000_add_onboarding_persona`); 2-step `PersonaOnboardingModal` calibrates persona (`TOWN_CRIER` | `OUTBOUND` | `HYBRID`) and immediately chains into `PlanSelectorModal` (`~~$50~~ $35` Chief Founding Rate, dynamic annual toggle when `annualAvailable: true`, `AppShell` live Plan Pill).

---

## 2. SCHEDULED & REMAINING DEVELOPMENT ROADMAP (GRANULAR EXECUTION SPEC)

### STAGE 3B: Web Engine Optimizations (AEO / SEO / GEO) & Remote MCP Server *(NEXT UP)*
- [ ] **TASK 3B.1 — Crawlable SSR / Pre-Rendered Public Discovery Pages:**
  - *Problem:* Current Vite SPA returns a bare `<div id="root"></div>` to HTTP crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`).
  - *Execution:* Serve semantic pre-rendered/SSR HTML snapshots from Express (before SPA fallback in `vercel.json`) for unauthenticated `/`, `/pricing`, `/docs`, `/deliverability-benchmarks`, and programmatic comparison pages (`/vs/instantly`, `/vs/smartlead`, `/vs/beehiiv`).
  - *Content Standards:* Place concise **40–60 word AEO answer blocks** immediately under question-led `<h2>` headings; publish dated primary benchmarks (e.g., 5-send sweep deliverability & Apple MPP filtering metrics) for E-E-A-T and GEO citations.
- [ ] **TASK 3B.2 — Machine-Readable Discovery Surfaces & JSON-LD Graph:**
  - Serve `GET /llms.txt` (v2 index), `GET /llms-full.txt`, `GET /docs.md` (token-efficient Markdown documentation twin), `GET /openapi.json` (OpenAPI 3.1 spec), `GET /robots.txt` (explicitly allowing `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `OAI-SearchBot`), and `GET /sitemap.xml`.
  - Embed validated Schema.org JSON-LD: `SoftwareApplication`, `Organization` (`sameAs` GitHub/NPM/PyPI, `knowsAbout`), `Article`, and `BreadcrumbList` (explicitly avoiding deprecated Google FAQ rich-result markup).
- [ ] **TASK 3B.3 — Remote Stateless MCP Server & CLI Stdio Bridge:**
  - Implement `POST /api/mcp` authenticated via scoped `midas_live_` Bearer keys (`dualAuth.middleware.ts`).
  - Expose JSON-RPC MCP tools: `midas_create_gong_channel`, `midas_get_embed_snippet`, `midas_send_sandbox_test`, `midas_get_campaign_health`, `midas_create_artifact`, and `midas_subscribe_contact`.
  - Add `npx @midas-aem/client mcp` stdio bridge inside `packages/client/src/cli.ts` for Claude Code, Cursor, and Codex.

### STAGE 3C: Zero-CLI `@midas-aem/client` & Security Key Scoping *(HELD PENDING USER SCOPE SIGN-OFF)*
- [ ] **TASK 3C.1 — Zero-CLI Server Proxy (`@midas-aem/client/next`):**
  - Remove risky `NEXT_PUBLIC_MIDAS_API_KEY` pattern from `packages/client/src/cli.ts`, `packages/client/src/react.tsx`, and `src/lib/townCrierClient.ts`.
  - Export `export { POST } from '@midas-aem/client/next'` reading server-only `process.env.MIDAS_API_KEY`, while `<MidasModal />` defaults to `/api/midas/subscribe` on same-origin.
- [ ] **TASK 3C.2 — Publishable HTML Ingestion Key (`midas_pk_...`):**
  - Optional write-only key prefix (`midas_pk_...`) strictly limited to `POST /api/public/town-crier/subscribe` for static HTML/Webflow embeds (zero read/campaign/lead/delete access + optional `allowedOrigins` pinning).
- [ ] **TASK 3C.3 — Developer Docs Environment Variable Matrix:**
  - Add exhaustive Environment Variables reference table (`MIDAS_API_KEY`, `MIDAS_BASE_URL`, `MIDAS_WEBHOOK_SECRET`, `MIDAS_PUBLISHABLE_KEY`) to `DeveloperDocs.tsx` and `GUIDE.md`.

### STAGE 3D: Smart AI Router, Perplexity Research, Town Crier 3-Draft Studio & Checklist
- [ ] **TASK 3D.1 — Cost-Optimized Task AI Router (`server/services/ai.service.ts`):**
  - Keep **Vercel AI Gateway** (`aigateway`) free-tier credit models (`openai/gpt-4o-mini`, `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`) as primary workhorse.
  - Auto-route any selected `gemini-*` model directly through `GeminiProvider` (`GEMINI_API_KEY` Google AI Studio) to conserve Vercel Gateway credits.
  - Route self-critique passes, long-context `KnowledgeBase` synthesis, and Gateway `402`/`429` failovers to `OpenRouterProvider` (`OPENROUTER_API_KEY`).
- [ ] **TASK 3D.2 — Perplexity `perplexity/sonar` Ultra-Personalization (`enrichment.service.ts`):**
  - Route live web-grounded company research through Vercel AI Gateway using **`perplexity/sonar`** (with `low` search context—explicitly avoiding costly `sonar-deep-research` loops).
  - Persist live citations, recent company achievements, and hiring hooks into `Lead.enrichedData` and expose `{{recent_achievement}}` and `{{company_specialization}}` interpolation tokens in `PersonalisationService`.
- [ ] **TASK 3D.3 — Town Crier Brand & Goal-Aware 3-Sample Iterative Content & Image Studio:**
  - Pull context from `Gong.description`, attached `KnowledgeBase`, attached `Artifact`s, **user-favorited historical `NewsletterBroadcast` drafts** (`isFavorite` / `rating` schema addition), and optional user activation inputs (`goal`, `contentType`, `description`, `sampleDraft`).
  - Synthesize **3 distinct tonal variants** in parallel (`Promise.allSettled`) $\rightarrow$ execute an automated **Self-Critique & Brand-Alignment Pass** via OpenRouter before returning $\rightarrow$ render interactive selection (`0–3` variants locked as fit) + natural-language feedback input to regenerate only unselected slots until approved.
  - Add AI hero image prompt generation $\rightarrow$ image generation (`gpt-image-1` / `imagen-3`) $\rightarrow$ permanent CDN upload via `BlobService` $\rightarrow$ auto-register as `Artifact` (`type: 'IMAGE'`) embedded inside `EmailTemplateService` (`card` / `editorial`).
- [ ] **TASK 3D.4 — First-3-Minutes Interactive Onboarding Checklist Drawer (`AppShell.tsx`):**
  - Contextual checklist tailored by `UserSettings.onboardingPersona` (`TOWN_CRIER` | `OUTBOUND` | `HYBRID`) tracking: 1-Click Sandbox Send $\rightarrow$ First Gong or Campaign $\rightarrow$ Domain/Sender Verification $\rightarrow$ API Key Provisioning.

### STAGE 4: Continuation Plan — 2026 Market & Deliverability Multipliers
- [ ] **TASK 4.1 — Peer-to-Peer Warmup Exchange Pool:** Opt-in cross-tenant real mailbox reply threads + spam-folder rescue loop (`WarmupPool` model + scheduled cron).
- [ ] **TASK 4.2 — Paid Town Crier Newsletters & Double Opt-In:** Dodo Payments subscription gating per `Gong` channel (`paid_only` tiers) + optional double opt-in confirmation links.
- [ ] **TASK 4.3 — Signal-Based Outbound Webhook Triggers:** `SignalTriggerRule` endpoints enrolling leads dynamically from Clay/Stripe/intent webhooks with `{{signal_context}}`.
- [ ] **TASK 4.4 — 2026 Copy & Timezone Peak Intelligence:** Update `ComplianceService` to warn on first touches `> 85` words (2026 `<50–80` word `1.47%` reply benchmark) and infer recipient timezone for **7am recipient-local send windows** (`1.34%` peak).
- [ ] **TASK 4.5 — Seed-List Inbox Placement Tester:** Automated Primary vs Promotions vs Spam diagnostic across seeded Gmail/Outlook/Yahoo accounts.
- [ ] **TASK 4.6 — Apple OAuth Activation:** Provision Apple Developer Services ID + `.p8` 6-month JWT rotation in Supabase and unblur the Apple OAuth button in `AuthExperience.tsx`.