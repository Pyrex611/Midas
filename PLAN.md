# PLAN.md — Master Engineering & Product Delivery Roadmap

**Project:** MIDAS Autonomous Email Management System  
**Version:** 3.1.0-PROD  
**Goal:** Enterprise-grade outbound orchestration & newsletter infrastructure with Royal Thistle (`#D8BFD8`) + Metallic Gold aesthetic, Lineicons iconography, and 5-minute developer onboarding.

---

## PHASE 1–3 & PRE-MAIN FOUNDATIONS (COMPLETED)
- [x] **Phases 1–3:** Strict CORS, RBAC (`requireCampaignRole`), cross-tenant protection, `CronLock`, atomic sender quotas, QStash verification, `Domain` vs `Sender` split, RFC-8058 unsubscribe, BYO Mailgun keys.
- [x] **Phases A, B & C.0/C.1:** Bounded `LIMIT 5` sweeps + 20s cooldowns, multi-provider AI Studio, Town Crier & Gong channels, Knowledge Bases, Artifacts, Multi-ESP, Dodo Payments billing, TS/React/Python/CLI SDKs, Royal Thistle UI & `/docs`.

---

## SEQUENCED EXECUTION ROADMAP (ACTIVE)

### STAGE 1: Stabilization Patch Sprint (COMPLETED IN THIS DELIVERY)
- [x] **PATCH-1.1 (Public Widget CORS):** Partitioned `publicCors` (`origin: '*'`) ahead of rate limiters on `/api/public/town-crier*`, `/api/track*`, and `/api/unsubscribe*` so third-party `widget.js` `OPTIONS` preflights and `429`/`413` responses succeed cleanly (`server/app.ts`).
- [x] **PATCH-1.2 (AI Grounding & Salvaged Campaign Editing):** Fixed `PromptManager.buildPrompt()` dropping `params.companyContext` (Knowledge Base & Artifact usage prompts), propagated `campaignId` from `campaign.core` & `campaign.drafts` controllers, and salvaged `context`, `reference`, and `senderName` editing from legacy `EditCampaignModal`/`EditSenderModal` directly into `EditStrategyModal.tsx`.
- [x] **PATCH-1.3 (Inbox Polling Closure):** Fixed 20s polling stale closure in `src/pages/Inbox.tsx` so active threads never snap back to index 0 mid-reply.
- [x] **PATCH-1.4 (Follow-Up, State-Graph OOO & Bounce Hygiene):**
  - Stored raw template copy in `FollowUpService` so `{{artifact:slug}}` tokens & Spintax resolve cleanly at dispatch time (`followUp.service.ts`).
  - Fixed `OUT_OF_OFFICE` sequence freeze via `OOO_FROZEN` status + `LeadActivityEvent` `frozenUntil` evaluation (`sequenceAgent.service.ts`, `followUp.service.ts`).
  - Propagated `userId`/`campaignId`, `brandOptions`, `PlanGuard`, atomic sender quota claiming, and `LeadActivityEvent` inside `SequenceAgentService`.
  - Purged `PendingEmail` rows on bounce/complaint webhooks (`webhooks.service.ts`) and skipped `BOUNCED` leads in `emailQueue.service.ts`.
- [x] **PATCH-1.5 (PlanGuard & Artifact Parity Across Queues):**
  - Enforced `isOverMonthlyEmailLimit()` and `recordEmailSent()` inside `emailQueue.service.ts` and `newsletterQueue.service.ts`.
  - Wired `artifactService` (`{{artifact:slug}}` + `MIME_ATTACHMENT` resolution) into `newsletterQueue.service.ts`.
  - Implemented & enforced remaining `PLAN_TIERS` quotas (`maxDomains`, `maxSenders`, `maxGongs`, `maxLeads`, `maxSubscribers`, `allowAutoReplyAgent`, `allowTeamInvites`, `allowCustomTrackingDomain`) with net-new deduplication checks.
- [x] **PATCH-1.6 (Multi-ESP, Auth, Webhooks, Invites & Cron Snapshots):**
  - Added `nodemailer` + `@types/nodemailer` to `package.json`; added live Resend/SMTP credential verification in `domain.service.ts`.
  - Scheduled `/api/cron/snapshots` in `vercel.json` and `.github/workflows/frequent-scheduler.yml`.
  - Hardened `webhookDispatch.service.ts` (`redirect: 'manual'`), `auth.middleware.ts` (`dual` mode 401 vs 500), `src/services/api.ts` (removed stale `midas_auth_token` LIFO interceptor), `lead.routes.ts` (`leads:*` API scopes), and `campaign.collab.controller.ts` (`sender` projection in `getMyInvites` + email verification & `upsert` in `acceptInvite`).

---

### STAGE 2: Sprint S2 — Cleanup, Consolidation & Pre-Public-Launch Gate (NEXT UP)
- [ ] **CLEANUP-2.1 (Dead File Purge):** Delete verified superseded backend services (`campaign.service.ts`, `draft.service.ts`, `autoReply.service.ts`, `lead.service.ts`) and 10 superseded frontend components (`CampaignRepliesModal.tsx`, `CustomDraftModal.tsx`, `EditCampaignModal.tsx`, `EditDraftModal.tsx`, `EditSenderModal.tsx`, `EmailSelectionModal.tsx`, `LeadEmailPreviewModal.tsx`, `MailboxStatsModal.tsx`, `UploadPreviewTable.tsx`, `UploadSummaryCard.tsx`).
- [ ] **CLEANUP-2.2 (Repo Docs Consolidation):** Audit and consolidate root documentation (`README.md`, `INTEGRATION.md`, `GUIDE.md`).
- [ ] **LAUNCH-2.3 (Pre-Public-Launch Gate):**
  - Generate consolidated Prisma baseline SQL migration covering all post-`20260926000000` schema additions before switching `package.json` `vercel-build` from `prisma db push` to `prisma migrate deploy`.
  - Remove hardcoded fallback passphrase/secret in `operatorAuth.ts` and remove default passphrase hint from `AdminDashboard.tsx`.

---

### STAGE 3: Sprint S3 — MCP Server, AEO/SEO & Self-Healing Autopilot
- [ ] **SPRINT3-3.1 (Remote Stateless MCP Server):** Implement `POST /api/mcp` authenticated via scoped `midas_live_` keys exposing `midas_create_gong_channel`, `midas_get_embed_snippet`, `midas_send_sandbox_test`, `midas_get_campaign_health`, and `midas_create_artifact`, plus `npx @midas-aem/client mcp` stdio bridge.
- [ ] **SPRINT3-3.2 (AEO & SEO Infrastructure):** Serve `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/docs.md`, `robots.txt`, `sitemap.xml`, and JSON-LD `SoftwareApplication` metadata.
- [ ] **SPRINT3-3.3 (First-3-Minutes Interactive Onboarding Drawer):** Guided workspace setup checklist inside `AppShell`.
- [ ] **SPRINT3-3.4 (Self-Healing Deliverability Warmup Autopilot):** Automatically scale `Sender.dailyLimit` up/down from 7-day `DomainHealthSnapshot` human-open vs bounce curves.