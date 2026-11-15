# PLAN.md — Master Engineering & Product Delivery Roadmap

**Project:** MIDAS Autonomous Email Management System  
**Version:** 3.0.0-PROD  
**Goal:** Enterprise-grade outbound orchestration & newsletter infrastructure with Royal Thistle (`#D8BFD8`) + Metallic Gold aesthetic, Lineicons iconography, and 5-minute developer onboarding.

---

## PHASE 1–3: DELIVERABILITY & SECURITY FOUNDATIONS (COMPLETED)
- [x] **Phase 1:** Strict CORS, fail-fast secrets, `requireCampaignRole` RBAC, cross-tenant reply protection, modular `verification/` providers.
- [x] **Phase 2:** `CronLock` mutual exclusion, atomic conditional sender quota claiming, Upstash QStash verification, Campaign Automation UI.
- [x] **Phase 3:** `Domain` vs `Sender` split, RFC-8058 one-click unsubscribe, BYO encrypted Mailgun keys, `/admin` operator view.

---

## PHASE A, B & C.0/C.1: DUAL-ENGINE & DEVELOPER INFRASTRUCTURE (COMPLETED)
- [x] **Phase A:** Bounded `LIMIT 5` sweeps + 20s per-sender cooldown, multi-provider AI Studio (`aigateway`, `openrouter`, `gemini`, `openai`, `deepseek`), variable-first/pipe-Spintax engine, modular `campaign/*` controllers.
- [x] **Phase B:** Town Crier bounded newsletter engine, DMARC/BIMI DNS verification, priority Notification Center + desktop alerts.
- [x] **Phase C.0 & C.1:** Scoped API keys (`midas_live_`), Gong channels + preset welcome autoresponders, CRM webhook engine, Shadow-DOM `widget.js` with progressive profiling, 4 email envelopes, `@midas-aem/client` dual-build SDK + `GongQuickstartModal`.

---

## PRE-MAIN DEVELOPMENT SPRINT (PM-1 THROUGH PM-4) — COMPLETED

### Sprint PM-1: Critical Integrity, Wiring & Reliability
- [x] **Dual-Auth SDK Support:** Created `dualAuth.middleware.ts` (`requireAuthOrApiKey` + `requireScopeIfApiKey`) so `@midas-aem/client` campaign/lead endpoints authenticate seamlessly via `midas_live_` keys.
- [x] **Live CRM Webhooks:** Fixed `webhookSubscription.routes.ts`, mounted `/api/user/webhooks` in `app.ts`, and wired live dispatch events (`lead.replied`, `deliverability.circuit_tripped`, `gong.subscribed`, `deal.booked`).
- [x] **Town Crier End-to-End Parity:** Persisted `Gong.dedicatedSenderId` in `schema.prisma`, preserved `gongId`/`templateStyle`/`tagFilter` across `createBroadcast` & `queueBroadcast`, loaded Gongs on mount in `TownCrier.tsx`, resolved Gong slugs in bulk/broadcast public routes, wrapped async work in `safeWaitUntil()`, and removed native `alert()` from `widget.js`.
- [x] **Sequencer & AI Parity:** Eliminated N+1 queries and wired `preferredSenderId` in `followUp.service.ts`; extracted `queueReconciliation.service.ts`; added bare-URL auto-linking in `email.service.ts`; added direct-send quota/telemetry parity in `campaign.leads.controller.ts`; restored `OllamaProvider` and fixed `MockProvider` intent detection; unified `APP_URL` in `unsubscribe.ts`.

### Sprint PM-2: Security Hardening, CI Gate & Hygiene Purge
- [x] **Public Rate Limiting & Decryption Visibility:** Added zero-dep `rateLimit.middleware.ts` + 16 KB `metadata` cap on `/subscribe`; surfaced `keyDecryptionFailed` / `aiKeyDecryptionFailed` alerts on `ENCRYPTION_KEY` mismatches. *(Operator passphrase display intentionally retained in `AdminDashboard.tsx` until operator removal).*
- [x] **Codebase Purge & CI Gate:** Purged dead legacy auth/modal/TownCrier API-key UI artifacts and duplicate `/town-crier/api-keys` routes; added root `tsconfig.json`, `npm run typecheck`, `baseUrl` prop on `@midas-aem/client/react`, and `.github/workflows/ci.yml`.

### Sprint PM-3: Royal Thistle + Pastel Purple + Gold & Lineicons Overhaul
- [x] **Design System (`src/index.css`):** Set `#F3EBF6` pastel purple canvas, Royal Plum (`#4A2559`) `btn-royal` actions, Metallic Gold separators (`border-gold-500/40`), and `.card-midas` golden hover glows.
- [x] **100% Lineicons & Interaction Consolidation:** Replaced all raw emojis and hand-rolled SVGs with Lineicons 4.0 (`src/lib/icons.tsx`), replaced `window.confirm()`/`alert()` with `<ConfirmDialog />` & `useToast()`, and upgraded `TownCrierHeader`'s Export menu to click-toggle.

### Sprint PM-4: Standalone Enterprise Developer Docs
- [x] **Vercel/Claude-Grade Docs Portal (`/docs`):** Removed Docs from workspace sidebar (retained in `Cmd+K`), detached `/docs` into a standalone 3-column portal with live search, full REST/Auth/Webhook payload references, `npm install @midas-aem/client` + Gong slug quickstarts, and live `<iframe srcDoc>` envelope previews.

---

## NEXT UP: POST PRE-MAIN ROADMAP (PHASE C.2 ONWARD)

### Sprint C.2: Automated NPM CI/CD & CLI Scaffolder
- [ ] **GitHub Actions NPM Release Workflow (`.github/workflows/npm-publish.yml`):** Tag-triggered `tsup` build $\rightarrow$ `npm publish --provenance` with `NODE_AUTH_TOKEN`.
- [ ] **Package Hygiene Polish:** Add `LICENSE` and `README.md` inside `packages/client/` when ready for next minor bump.
- [ ] **Interactive CLI Scaffolder (`npx @midas-aem/client init`):** Scaffold framework newsletter modals and Next.js server actions automatically.

### Sprint C.3: Zero-Setup Sandbox Mode & Ecosystem Distribution
- [ ] **Shared Sandbox Domain/Sender:** Allow newly onboarded developers to test `.subscribe()` and `.dispatchCampaign()` to their own verified email within 3 minutes—no DNS/Mailgun prerequisite.
- [ ] **Ecosystem Connectors:** Publish Zapier, Make, n8n, and One-Click Vercel Deploy templates.

### Sprint C.4: Multi-Language SDKs & Subdomain NS Delegation
- [ ] **Python SDK (`midas-python`):** Async `httpx` client for AI startups & FastAPI teams.
- [ ] **Automated Subdomain NS Delegation:** Provision `mail.clientdomain.com` DNS records behind the scenes via Cloudflare Zones API.

### Sprint C.5: Multi-ESP Abstraction & Time-Series Domain Telemetry
- [ ] **Pluggable `ESPProvider` Adapter:** Support Resend, Postmark, and SMTP alongside Mailgun.
- [ ] **Time-Series `DomainHealthSnapshot` & Apple MPP Open Filtering:** Track daily reputation trends and suppress scanner pre-fetch false opens.

### Phase D: Ultra-Personalization & Account Research Agents
- [ ] **Web-Grounded Research Agent:** Add `Lead.enrichedData` column and synthesize live company intelligence into dynamic tokens (`{{recent_achievement}}`).

### Phase E: Auth Evolution — Neon Auth (Managed Better Auth)
- [ ] **Migrate from Clerk to Neon Auth:** Consolidate auth tables directly into Neon Postgres (60k MAU free, branch-isolated auth, zero webhook sync lag) and build 100% custom Royal Thistle & Gold login/signup interfaces.