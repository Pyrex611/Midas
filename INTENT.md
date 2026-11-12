# INTENT.md — System Philosophy, Mission & Functional Architecture

## 1. VISION & PURPOSE
MIDAS (Autonomous Email Management System) is an enterprise deliverability-first outbound sales and audience infrastructure. The platform eliminates the structural failure modes of modern email communication:
1. **Spam Fingerprinting:** Eliminates identical byte signatures via recursive Spintax `{Choice A|Choice B}` and variable fallbacks `{{name|there}}`.
2. **Domain Reputation Burnout:** Decouples root DNS credentials (`Domain`) from individual sending inboxes (`Sender`), enforcing warmup curves and daily quotas per mailbox.
3. **Delivery Bursts & Multi-Scheduler Spikes:** Enforces a bounded queue drainer (strictly capped at 5 sends per tick with a 20-second per-sender cooldown window) to protect sender health across overlapping schedulers (Vercel Cron + GitHub Actions + QStash).
4. **Siloed Inbound vs. Outbound:** Bridges cold prospecting sequences with permission-based newsletter publishing in one deliverability-controlled engine.

---

## 2. SYSTEM ARCHITECTURE & DOMAIN MODEL

### A. The Dual-Engine Topology (Campaigns vs. Town Crier)
The platform encapsulates two synchronized engines under a unified workspace:
- **MIDAS Campaigns (Outbound Engine):**
  - Designed for cold sales outreach.
  - Rotates horizontally across secondary burner mailboxes to respect daily sending limits (20–40 emails/day/mailbox).
  - Evaluates prospect replies via an autonomous State-Graph Engine (`sequenceAgent.service.ts`) that freezes sequences on Out-of-Office responses and generates contextual objection responses.
- **MIDAS Town-Crier (Inbound / Audience Engine):**
  - Designed for permission-based audience capture and newsletter publishing.
  - Operates via **Gong Channels** (dedicated publication streams with welcome autoresponders, cadence preferences, and Clerk-style embed themes).
  - Binds to a **Dedicated Brand Mailbox** (`community@domain.com`), completely isolating newsletter sending volume from cold sales mailboxes.
+---------------------------------------------------------------------------------------------------+
| THE MIDAS ECOSYSTEM |
+---------------------------------------------------------------------------------------------------+
| TENANT ROOT (User / Settings) |
| - Clerk User Session & RBAC |
| - Unified Scoped API Keys (midas_live_...) with permissions (, campaigns:, town_crier:*) |
| - Real-Time Notification Center (Inbound prospect replies + broadcast deliveries) |
| - Bi-Directional Webhooks (Dispatches lead.replied and gong.subscribed) |
+---------------------------------+---------------------------------+-------------------------------+
| |
▼ ▼
+---------------------------------------------------+ +---------------------------------------------+
| MIDAS CAMPAIGNS (Outbound) | | MIDAS TOWN-CRIER (Inbound) |
+---------------------------------------------------+ +---------------------------------------------+
| • DB: Campaign, Lead, Draft, PendingEmail | | • DB: Gong, Recipient, Broadcast, QueueItem |
| • API: /api/campaigns, /api/leads | | • API: /api/town-crier, /api/public/... |
| • Logic: Horizontal Mailbox Rotation | | • Logic: Dedicated Single Brand Mailbox |
| (Cycles secondary burners to stay under 40/day) | ( community@ domain isolation) |
| • Safety: 5-send sweep cap, 20s sender cooldown | | • Safety: Fair-share 50% capacity cap |
| • AI: State-Graph objection & OOO handler | | • Autoresponder: Sub-60s welcome deal email |
+---------------------------------------------------+ +---------------------------------------------+
Code
### B. The Domain vs. Sender Hierarchy
- **`Domain` (DNS & Credential Identity):** Represents the root domain or subdomain authenticated in Mailgun/ESP (DKIM, SPF, MX, Tracking, BIMI, DMARC). If a domain's bounce rate hits 5% or complaint rate hits 0.3%, an automated circuit breaker trips the status to `paused_health_risk`.
- **`Sender` (Mailbox Identity & Quota):** Represents an individual inbox (e.g., `sales@outreach.domain.com` or `community@domain.com`). Warmup schedules (`warmupDay`), daily sending caps (`dailyLimit`), and intraday send counters (`sentCountToday`) are enforced at the Sender level.
- **`CampaignSender`:** Junction model rotating active senders across campaigns.

### C. Developer-First Ergonomics (The 1-Line Embed Standard)
To eliminate custom modal boilerplate:
1. **Universal Drop-In Script (`/widget.js`):** Derives backend origin dynamically, binds click events globally via document-level delegation, and isolates styling inside native Shadow DOM.
2. **Progressive Profiling & Dynamic Schemas:** Modals dynamically render input fields (`name`, `email`, `company`, `cadence`) and boolean toggle switches with conditional follow-up expansions based on declarative attributes (`data-fields`, `data-schema`).
3. **Isomorphic NPM Package (`@midas/client`):** Subpath exports for pure Node.js environments (`.`) and first-party React components (`./react`) with automatic `MIDAS_API_KEY` environment variable resolution.