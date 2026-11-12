# MIDAS & Town Crier Developer Integration Guide (v2.5)

Welcome to the **MIDAS Autonomous Email & Town Crier Audience Engine** enterprise developer manual.

---

## 1. System Topology & Architecture

MIDAS enforces strict deliverability partitioning between cold outreach and permission-based audience communications:
- **Cold Sequence Engine:** Rotates horizontally across secondary burner mailboxes with bounded dispatches (≤5/tick) and 20s cooldowns to insulate root domain reputation.
- **Town Crier Audience Engine:** Powers permission-based publication channels (Gongs) with isolated dedicated senders (e.g., `community@domain.com`), sub-60s welcome autoresponders, and Shadow-DOM embeds.

---

## 2. Authentication & Scoped API Keys

API requests require Bearer token authentication:
```http
Authorization: Bearer midas_live_YOUR_KEY
Permission Scopes Matrix:
*: Full Super Admin access.
campaigns:*: Read, create, pause, and dispatch cold campaigns.
leads:*: Query, upload CSVs, and manage suppression rules.
town_crier:*: Manage Gongs, ingest subscribers, and dispatch broadcasts.
analytics:read: Read-only telemetry and reporting probes.
3. Zero-Config Environment Variables
Define MIDAS_API_KEY in your .env or .env.local:
Env
MIDAS_API_KEY=midas_live_a1b2c3d4e5f6...
MIDAS_BASE_URL=https://your-midas-domain.vercel.app
Initialize with zero parameters in Node.js or Next.js using the official NPM package:
TypeScript
import { MidasClient } from '@midas-aem/client';

// Automatically resolves process.env.MIDAS_API_KEY
const midas = new MidasClient();

await midas.subscribe({
  email: 'subscriber@acme.com',
  name: 'Alex Mercer',
  cadence: 'weekly',
  metadata: { isAgency: true, clientCount: 14 }
});
4. Universal Drop-In Script (Shadow DOM Isolated)
Include our universal script tag in <head> or <body>:
Html
<script src="https://your-midas-domain.vercel.app/api/public/town-crier/widget.js" async></script>
5. Clerk-Style Modal Engine
Add data-town-crier-modal to any button or link:
Html
<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,cadence"
  data-headline="Join 15,000+ Founders"
  data-accent="#7C3AED"
  data-button="Get Instant Access">
  Subscribe to Newsletter
</button>
6. Progressive Profiling & Dynamic Schemas
Pass a declarative JSON schema via data-schema supporting typed inputs, dropdowns, frequency pills, and boolean switches with conditional follow-up expansions:
Html
<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_KEY"
  data-headline="Join Developer Preview"
  data-accent="#2563EB"
  data-schema='[
    {"name":"name","type":"text","label":"Full Name","placeholder":"Alex Mercer"},
    {"name":"email","type":"email","label":"Work Email","required":true},
    {"name":"cadence","type":"cadence","label":"Delivery Frequency"},
    {
      "name":"isDeveloper",
      "type":"boolean",
      "label":"Are you a developer or technical founder?",
      "followUp":{"name":"githubUrl","type":"url","label":"GitHub / Portfolio URL","placeholder":"https://github.com/username"}
    }
  ]'>
  Join with Progressive Profiling
</button>
7. Gong Channels & Preset Welcome Autoresponders
A Gong is a publication channel or lead-magnet offer stream. When a subscriber signs up to a Gong with welcomeEmailEnabled: true, Midas automatically personalizes and dispatches the welcome lead-magnet email in <60 seconds.
Headless Gong Creation:
Bash
curl -X POST https://your-midas-domain.vercel.app/api/public/town-crier/gongs \
  -H "Authorization: Bearer midas_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Architecture",
    "slug": "weekly-arch",
    "cadence": "weekly",
    "welcomeEmailEnabled": true,
    "welcomeSubject": "Welcome! Here is your download link",
    "welcomeBody": "Hi {{name}},\n\nThanks for joining! Access your guide here..."
  }'
8. Dedicated Newsletter Mailbox (community@domain.com)
To protect your cold outreach reputation score, newsletters send from a single, stable sender address:
In Town Crier 
→
→
 Gongs, click "+ Create Mailbox in Place".
Select your verified domain, type community, and save.
The mailbox is created immediately and bound exclusively to that Gong channel.
9. Selectable Email Envelopes
Choose from 4 email envelope designs (card is enabled by default):
card (Default): Centered 580px rounded card envelope with brand logo badge.
editorial: Long-form Substack/Beehiiv publication layout with serif reading typography.
minimal: Clean top brand accent line with high-contrast whitespace.
plain: Conversational raw HTML for maximum inbox placement.
10. Framework SDKs (Next.js & React Hook)
Bash
npm install @midas-aem/client
Tsx
'use client';
import { MidasModal } from '@midas-aem/client/react';

export function HeroCta() {
  return (
    <MidasModal 
      gongId="weekly-alpha"
      headline="Join 15,000+ Developers"
      accent="#2563EB"
      developerToggle
      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
    >
      Subscribe to Newsletter
    </MidasModal>
  );
}
11. Programmatic Campaign Outreach SDK & API
Automate your outbound sequencing and lead staging natively using the Node.js SDK:
TypeScript
import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient();

// 1. Trigger Bounded Send Sweep (≤5 emails)
await midas.dispatchCampaign('campaign_123');

// 2. Add Verified Leads to Active Sequence
await midas.addLeadsToCampaign('campaign_123', ['lead_88', 'lead_99']);
12. Outbound Webhooks & HMAC-SHA256 Verification
Verify signatures in Node.js:
TypeScript
import crypto from 'crypto';

export function verifyMidasWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
}
13. Headless Developer CLI (cli/midas.js)
Bash
node cli/midas.js login --key midas_live_YOUR_KEY
node cli/midas.js stats
node cli/midas.js gongs list
node cli/midas.js broadcast --gong <gongId> --subject "Issue #42" --body "Weekly updates..."
Code
---