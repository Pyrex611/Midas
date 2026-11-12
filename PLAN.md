# PLAN.md — Master Engineering & Product Delivery Roadmap

**Project:** MIDAS Autonomous Email Management System  
**Version:** 2.5.0-PROD  
**Tracking Mode:** Non-Exhaustive / Continuous Delivery  

---

## 1. COMPLETED SPRINT LEDGER

[x] PHASE A: DELIVERABILITY SAFETY, AI RELIABILITY & BRANDED ENVELOPE
    ├─ [x] 5-Send Sweep Cap & 20s Cooldown Guard (SEND_SWEEP_BATCH_SIZE = 5)
    ├─ [x] AI Reasoning-Model Overhaul (thinkingBudget: 0, 3500+ token ceilings)
    ├─ [x] Responsive Branded Card Envelope (emailTemplate.service.ts)
    ├─ [x] Strict Mustache Interpolation Engine & Queue Repersonalization
    └─ [x] Modular Campaign Controllers (server/controllers/campaign/*)

[x] PHASE B: "TOWN CRIER" NEWSLETTER MODULE & UI CONSOLIDATION
    ├─ [x] Sender Avatar BIMI Inspector & DMARC Checker
    ├─ [x] Bounded Queue Drainer for Newsletters (LIMIT 5)
    ├─ [x] In-App Notification Center & Desktop Alerts (Bell Icon, Unread Counter)
    ├─ [x] Modular TownCrier.tsx and Domains.tsx Subcomponents
    └─ [x] Webhook Deliverability Attribution for Newsletter Bounces & Complaints

[x] PHASE C.0: DEVELOPER INFRASTRUCTURE & TOWN CRIER MVP
    ├─ [x] Global Scoped API Key Engine (midas_live_... and tc_live_...) with 15-key ceiling
    ├─ [x] Relocated API Key management to Workspace Settings (/profile?tab=apiKeys)
    ├─ [x] "Gong" Channels Model with Preset Welcome Autoresponder Automation
    ├─ [x] In-Place Newsletter Mailbox Provisioning (community@domain.com)
    ├─ [x] Bi-Directional CRM Outbound Webhook Engine (HMAC-SHA256, Delivery Logs, Test Ping)
    ├─ [x] Standalone Developer CLI (cli/midas.js)
    ├─ [x] Clerk-Style Modal & Dynamic Fields (data-fields, data-accent, data-theme)
    ├─ [x] Progressive Profiling Engine with Conditional Boolean Toggles
    ├─ [x] 4 Selectable Email Envelope Templates (Card, Editorial, Minimal, Plain)
    ├─ [x] Publication Cadence Mechanics (Daily, Weekly, Bi-Weekly, Monthly)
    ├─ [x] Type Alignment in EmailService for BrandEnvelopeOptions
    └─ [x] Comprehensive Developer Docs Page (/docs) with 1-Click PDF Export

[x] PHASE C.1: STANDALONE CLIENT PACKAGE & DOGFOODING
    ├─ [x] packages/client scaffolding with dual tsup build targets (ESM + CJS + .d.ts)
    ├─ [x] Subpath exports configuration (. for Node core, ./react for 'use client' components)
    ├─ [x] First-party React wrappers: <MidasModal />, <TownCrierModal />, <MidasEmbed />
    ├─ [x] Supabase-style instant setup modal upon Gong creation (GongQuickstartModal.tsx)
    ├─ [x] Auto-detection of process.env.MIDAS_API_KEY with zero runtime dependencies
    └─ [x] Task 3 (Cloudflare DNS Provisioner): Explicitly held off / deferred per directive

---

## 2. ACTIVE NEXT SPRINT: ECOSYSTEM EXPANSION & MULTI-LANGUAGE SDKS

[ ] SPRINT C.2: NPM REGISTRY RELEASE & INTERACTIVE CLI SCAFFOLDER
    ├─ [ ] Publish @pyrexxai/client (or @midas/client) to public npm registry.
    ├─ [ ] Build interactive terminal scaffolder (npx midas init / npx town-crier init).
    ├─ [ ] Auto-generate components/Newsletter.tsx in Next.js and Vite test projects.
    └─ [ ] Validate zero-CSP Server Action proxy generation.

[ ] SPRINT C.3: PYTHON SDK (pip install town-crier / pyrexx-midas)
    ├─ [ ] Standalone PyPI package built on httpx for AI/LLM startups and FastAPI backends.
    ├─ [ ] Support midas.subscribe(email, gong="weekly", cadence="weekly").
    └─ [ ] Auto-detect os.environ["MIDAS_API_KEY"].

[ ] SPRINT C.4: HYBRID SUBDOMAIN DELEGATION ARCHITECTURE (OPTION 3)
    ├─ [ ] Design Managed Subdomain NS Delegation engine (e.g., mail.client.com NS ns1.midasdns.com).
    ├─ [ ] Backend zone generation via Cloudflare API behind the scenes.
    ├─ [ ] Automated injection of Mailgun/Resend SPF, DKIM, and MX records into delegated zones.
    └─ [ ] UI: "1-Click Connect Subdomain" requiring only 2 NS records from users.

[ ] SPRINT C.5: MULTI-ESP INFRASTRUCTURE (RESEND INTEGRATION)
    ├─ [ ] ESPProvider interface abstraction (Mailgun vs. Resend vs. SendByte vs. SMTP).
    ├─ [ ] Per-domain ESP routing: allow users to dispatch cold email via Mailgun and newsletters via Resend.
    └─ [ ] Resend Webhook normalizer for delivered, bounced, and complained events.

---

## 3. FUTURE ROADMAP: ULTRA-PERSONALIZATION & GROUNDED AGENTS

[ ] PHASE D: ULTRA-PERSONALIZATION & GROUNDED RESEARCH AGENTS
    ├─ [ ] Autonomous Account Research Agent (Perplexity / Gemini Grounded Web Search).
    ├─ [ ] Dual-Track Draft Synthesis (Standard vs. Ultra-Enriched Draft Routing).
    ├─ [ ] Dynamic Token Interpolation ({{recent_funding}}, {{company_specialization}}).
    └─ [ ] Automated LinkedIn & Company Profile Scraping Hook.