# @midas-aem/client

Zero-dependency TypeScript SDK, React Drop-In Components, and Interactive CLI Scaffolder for **MIDAS — Golden Email & Outbound Infrastructure**.

## Install

```bash
npm install @midas-aem/client
60-Second CLI Setup
Run the zero-dependency interactive scaffolder in any Next.js or Vite React project:
Bash
npx @midas-aem/client init
This creates .env.local placeholders, generates a Next.js App Router proxy (/api/newsletter/route.ts) or Vite React starter, and drops in <MidasModal />.
Server / Node.js Usage
Ts
import { MidasClient } from '@midas-aem/client';

// Automatically reads process.env.MIDAS_API_KEY and process.env.MIDAS_BASE_URL
const midas = new MidasClient();

// Subscribe a lead to a Town Crier Gong channel by slug
await midas.subscribe({
  email: 'founder@acme.com',
  name: 'Alex Mercer',
  gongId: 'weekly-alpha',
  cadence: 'weekly',
  metadata: { isDeveloper: true },
});

// Trigger a bounded cold-outreach sweep
await midas.dispatchCampaign('campaign_cuid_123');
React Drop-In Modal
Tsx
'use client';
import { MidasModal } from '@midas-aem/client/react';

export function NewsletterCTA() {
  return (
    <MidasModal
      gongId="weekly-alpha"
      headline="Join 15,000+ Founders"
      accent="#4A2559"
      developerToggle
      className="px-4 py-2 rounded-xl bg-[#4A2559] text-white font-bold"
    >
      Subscribe
    </MidasModal>
  );
}
Documentation
Full API reference, webhook HMAC verification, and progressive profiling schemas:
https://midas-aem.vercel.app/docs