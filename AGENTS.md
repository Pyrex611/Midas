# AGENTS.md — Autonomous Engineering & AI Agent Protocol

This document establishes the non-negotiable operational directives, safety constraints, and code generation standards for AI coding agents (and human engineers) contributing to the **MIDAS Autonomous Email Management System**.

---

## 1. MANDATORY CODE GENERATION LAWS

### Law 1: Full, Unabridged Code Delivery (Zero Truncation)
- **No Partial Code:** Never output partial diffs, incomplete snippets, or placeholders like `// ... rest of code unchanged`.
- **Complete File Replacement:** When modifying an existing file or introducing a new module, always deliver the **entire, unabridged file from line 1 to EOF**. This completely eliminates copy-paste merge corruptions and import dropouts.
- **Verification Before Delivery:** Every generated file must be syntax-checked against the current repository state and existing interfaces.

### Law 2: Strict Client vs. Server Boundary Isolation
- **`server/` (Backend / Node.js Runtime):**
  - Compiled by `tsconfig.server.json`.
  - Allowed dependencies: `@prisma/client`, `pg`, `crypto`, `fs`, `winston`, `multer`, `express`.
  - Must never import React, JSX, DOM globals, or browser APIs.
- **`src/` (Frontend / Vite + React Runtime):**
  - Bundled by Vite / Rollup.
  - Allowed dependencies: React, Clerk React, Axios (`services/api.ts`), Tailwind CSS.
  - **CRITICAL:** Must **never** import `prisma`, `pg`, `fs`, `crypto`, or any file from `server/lib/` or `server/services/`. All backend interactions must strictly traverse HTTP endpoints through `src/services/api.ts`.

### Law 3: Non-Destructive Evolutionary Migrations
- **Preserve Verified Code:** Never rewrite a functional, tested component from scratch when a targeted patch or surgical enhancement achieves the goal.
- **No Feature Drops:** In redesigns, all original capabilities (buttons, modals, role checks, time windows, auto-reply flags) must be verified via a feature trace matrix before presenting the output.

---

## 2. AUTOMATED REGRESSION & INTEGRITY GUARDS

To answer: *"Is it necessary to integrate checks into the codebase to ensure features are not lost or degraded?"*
**Yes, it is essential.** In an AI-assisted engineering workflow, the following automated checks must guard the repository:

### Layer A: Double TypeScript Verification Pipeline
Add this script to `package.json` to verify both server and client TypeScript boundaries simultaneously before every push:
```json
"scripts": {
  "typecheck": "tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.json --noEmit"
}

# AGENTS.md — Master Architecture Blueprint & Engineering Protocol

> **Project:** MIDAS (Autonomous Email Management System)  
> **Status:** Active Production Development Lifecycle  
> **Branch Strategy:** Work strictly on `main` / `vercel`  

---

## 1. PURPOSE & INTENT OF THE PLATFORM

MIDAS is an autonomous B2B outbound email and audience broadcast infrastructure designed to replace legacy sequencing tools. The core architecture solves four structural failure modes of outbound marketing:
1. **Spam Fingerprinting:** Eliminates identical template byte signatures via recursive Spintax `{Option A|Option B}` combined with mustache variable fallbacks.
2. **Domain Reputation Burnout:** Strictly separates root DNS identity (`Domain`) from individual sending inboxes (`Sender`), enforcing warmup curves and daily send caps per mailbox.
3. **Delivery Bursts & Compounding Multi-Schedulers:** Enforces a bounded queue drainer (strictly capped at 5 sends per tick, with a 20-second per-sender cooldown window) to safeguard reputation across overlapping schedulers (Vercel Cron + GitHub Actions + QStash).
4. **Disjointed Cold Sequences:** Replaces linear day-based counters with an autonomous behavioral State-Graph Engine (`sequenceAgent.service.ts`) that freezes outreach on Out of Office replies, synthesizes objection-handling drafts, and routes high-intent prospects to conversion tools.
5. **Town Crier Broadcast Engine:** A rate-controlled newsletter module bounded by the same `LIMIT 5` drainer, ensuring broadcasts cannot blast in bulk or starve campaign inboxes.

---

## 2. NON-NEGOTIABLE ARCHITECTURAL INVARIANTS

### Rule 1: Zero Bulk Loops on Dispatches
- No function in the codebase may loop over an in-memory recipient array and synchronously call `sendEmailNow()`.
- Every dispatch must insert queue rows (`PendingEmail` or `NewsletterQueueItem`) and rely on the bounded `LIMIT 5` queue sweeper.

### Rule 2: Strict Client vs. Server Bundle Boundaries
- **`server/` (Node.js runtime):** Uses Prisma Client, native crypto, pg pools, and Winston. Must never import React or DOM packages.
- **`src/` (Vite / React browser bundle):** Must **never** import `prisma`, `pg`, `fs`, `crypto`, or any file from `server/lib/` or `server/services/`. All backend interactions must traverse Axios HTTP endpoints through `src/services/api.ts`.

### Rule 3: Zero Code Truncation
- When modifying any file, always deliver the **complete, unabridged code from line 1 to EOF**. Never emit partial snippets or placeholders like `// ... rest unchanged`.

### Rule 4: Delimiter Separation (Variables vs. Spintax)
- Variable interpolation must run **FIRST** using single or double braces (`{{variable}}`, `{variable}`, `{{variable|fallback}}`).
- Spintax `{Option A|Option B}` must run **SECOND** and strictly requires at least one pipe `|`. Spintax must never match single tokens without pipes, or it will strip braces and corrupt copy into literal words (`Hello name`).

---

## 3. MASTER ROADMAP & DEVELOPMENT SPRINT LEDGER

```
========================================================================================
MIDAS DEVELOPMENT ROADMAP (RE-SEQUENCED)
========================================================================================

[ COMPLETED ] PHASE A: DELIVERABILITY SAFETY, AI RELIABILITY & BRANDED ENVELOPE
  ├─ [x] 5-Send Sweep Cap & Compounding Trigger Cooldown (SEND_SWEEP_BATCH_SIZE = 5, Cooldown = 20s)
  ├─ [x] AI Reasoning-Model Overhaul (Thinking budget disabled for structured JSON, 3500+ tokens)
  ├─ [x] PyrexxAI / Resend Branded Card Email Envelope (emailTemplate.service.ts)
  ├─ [x] Strict Mustache Variable Engine & Queue Refresh from Reserves
  ├─ [x] Lead Ingestion Studio with Interactive Two-Stage Column Mapping (UploadArea.tsx)
  ├─ [x] Operator Admin: Clearance Gateway (midas_operator_2026), 60min Auto-Lock, Action Protection
  ├─ [x] Flicker Elimination: Referential stability in ToastContext & isFirstLoadRef in CampaignDetail
  └─ [x] Modularized Campaign Controllers (server/controllers/campaign/*)

[ COMPLETED ] PHASE B: "TOWN CRIER" NEWSLETTER MODULE, SENDER AVATARS & UI CONSOLIDATION
  ├─ [x] SPRINT B.1: Sender Avatar & BIMI / DMARC Verification Suite (Domain.bimi*, DNS checks)
  ├─ [x] SPRINT B.2: Town Crier Data Models & Bounded Queue Drainer (LIMIT 5)
  ├─ [x] SPRINT B.3: Public Subscriber Ingestion API & CSV Import (POST /recipients/import)
  ├─ [x] SPRINT B.4: Lineicons Design System Migration across UI (src/lib/icons.tsx)
  └─ [x] SPRINT B.5: Town Crier Dashboard & Broadcast Composer in AppShell (/town-crier)

[ ACTIVE NEXT ] PHASE C: MULTI-ESP INFRASTRUCTURE & ADVANCED HEALTH TELEMETRY
  ├─ [ ] SPRINT C.1: Multi-ESP Provider Abstraction & Resend Integration (ESPProvider interface)
  ├─ [ ] SPRINT C.2: Resend Inbound & Deliverability Webhook Normalization
  ├─ [ ] SPRINT C.3: Time-Series Deliverability Health (DomainHealthSnapshot Model & Daily Cron)
  └─ [ ] SPRINT C.4: Apple MPP / Proxy Open Rate Filtering & DNSBL Blocklist Monitor

[ FUTURE ] PHASE D: ULTRA-PERSONALIZATION & GROUNDED RESEARCH AGENTS
  ├─ [ ] Autonomous Account Research Agent (Perplexity / Gemini Grounded Search)
  ├─ [ ] Dual-Track Draft Synthesis (Standard vs Ultra-Enriched Draft Routing)
  └─ [ ] Dynamic Token Interpolation ({{recent_achievement}}, {{company_specialization}})
```

---

## 4. NOTABLE BUMPS, TRAPS & PAST INCIDENTS

1. **Prisma P3005 on Fresh Neon DBs:**
   - Historical migrations 1–8 did not rename `"User"` to `"users"`. When creating fresh databases, use `npx prisma db push --accept-data-loss` instead of `prisma migrate deploy`.
2. **The 27ms Mailgun 401 JSON Crash:**
   - Mailgun returns plain-text `Forbidden` on invalid credentials. Calling `await res.json()` directly causes a SyntaxError. Always read `await res.text()` and attempt JSON parsing inside a `try/catch`.
3. **The Circular Import Incident:**
   - An accidental `import { emailService } from './email.service'` inside `server/services/email.service.ts` caused circular alias compiler errors `TS2303` and `TS2459` across 5 controllers. Never import a module from itself.
4. **Vercel AI Gateway 404:**
   - `api.vercel.ai` is a non-existent domain. The canonical endpoint is `https://ai-gateway.vercel.sh/v1`.
5. **Reasoning Model Token Burnout:**
   - Thinking models (`nemotron`, `deepseek-r1`) consume all `max_tokens` on internal reasoning before writing text. Always allocate 3,500+ tokens and disable thinking budgets on Gemini (`thinkingBudget: 0`) for structured JSON tasks.
6. **Toast Context Re-Render Flicker:**
   - Instantiating un-memoized object literals in React Context providers triggers component-wide re-render cascades. Always wrap Context values in `useMemo`.
7. **Spintax Stripping Mustache Braces:**
   - `resolveSpintax` using `\{([^{}]+)\}` matched `{name}` inside `{{name}}` and stripped the braces. Invert order: variables interpolate first, and Spintax strictly requires a pipe `|`.

---

## 5. AGENT CONTRIBUTION LOG (RECORD ALL UPDATES HERE)

| Date | Engineer / Agent | Milestone / Files Modified | Notes & Verification |
|---|---|---|---|
| 2026-10-29 | Staff Principal | Milestone 1 Hardening | Decoupled synchronous AI draft loop (<600ms), wrapped queue in interactive Prisma transactions. |
| 2026-10-29 | Staff Principal | Phase 2 UI Overhaul | AppShell navigation, Sheet drawer, LeadDrawer, CommandPalette (Cmd+K), Sonner Toast system. |
| 2026-10-30 | Staff Principal | Admin Security Gate | Added Operator Clearance Gateway (`midas_operator_2026`), 60-min auto-lock, Action Protection modal. |
| 2026-10-30 | Staff Principal | Modular AI Engine | Built registry factory supporting Gemini, OpenRouter, and Vercel AI Gateway with model presets. |
| 2026-10-31 | Staff Principal | Phase A (Safety & Branding) | 5-send cap, 20s cooldown, PyrexxAI card envelope, strict mustache engine, modular controllers. |
| 2026-11-04 | Staff Principal | Sprint B.1 (BIMI & DMARC) | DMARC policy inspector via Node DNS, Domain BIMI fields, flicker eliminated via Toast useMemo. |
| 2026-11-04 | Staff Principal | Sprints B.2–B.5 (Town Crier) | Delivered Town Crier module, ApiKey auth, Lineicons design system, and /town-crier UI dashboard. |