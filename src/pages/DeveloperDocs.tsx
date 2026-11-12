import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';

export const DeveloperDocs: React.FC = () => {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(id);
    toast.success('Snippet copied to clipboard', 'Copied');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadPdf = () => {
    toast.info('Opening print dialog. Select "Save as PDF" to download the manual.', 'Generating PDF');
    window.print();
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app';

  const sections = [
    { id: 'system-overview', label: '1. System Topology & Architecture' },
    { id: 'auth-keys', label: '2. Authentication & Scoped Keys' },
    { id: 'env-vars', label: '3. Zero-Config Environment Variables' },
    { id: 'dropin-widget', label: '4. Drop-In Universal Script' },
    { id: 'modal-engine', label: '5. Clerk-Style Modal Engine' },
    { id: 'progressive', label: '6. Progressive Profiling & Schemas' },
    { id: 'gongs-channels', label: '7. Gongs & Welcome Autoresponders' },
    { id: 'sender-isolation', label: '8. Dedicated Mailbox Isolation' },
    { id: 'email-templates', label: '9. Selectable Email Envelopes' },
    { id: 'framework-sdks', label: '10. Next.js, Node.js & React SDKs' },
    { id: 'campaigns-api', label: '11. Outbound Campaigns SDK & API' },
    { id: 'webhooks-crm', label: '12. Outbound Webhooks & HMAC-SHA256' },
    { id: 'cli-reference', label: '13. Standalone Developer CLI' },
    { id: 'error-matrix', label: '14. Error Code & Diagnostic Matrix' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 print:p-0 print:m-0 print:max-w-none">
      {/* Top Banner & PDF Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-200 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Enterprise Developer Manual</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              v2.5 Standard
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Complete architectural reference: APIs, progressive profiling, Shadow DOM modals, webhooks, and CLI commands.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span>📄 Download Guide as PDF</span>
        </button>
      </div>

      <div className="flex gap-8 items-start">
        <aside className="w-64 hidden lg:block sticky top-24 space-y-1 text-xs no-print">
          <p className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider mb-2">Documentation Index</p>
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="block py-1.5 px-3 rounded-lg text-zinc-600 hover:text-blue-600 hover:bg-zinc-100 transition-colors font-medium truncate"
            >
              {sec.label}
            </a>
          ))}
        </aside>

        <div className="flex-1 space-y-12 min-w-0 print:space-y-6">
          
          <section id="system-overview" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">1. System Topology & Architecture</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              MIDAS is a dual-engine outbound marketing and audience infrastructure built to resolve deliverability degradation, spam fingerprinting, and mailbox burnout:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="font-bold text-blue-700 uppercase text-[10px]">1. Cold Sequence Engine</span>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  Cycles horizontally across secondary burner mailboxes with bounded dispatches (≤5/tick) and 20s cooldowns to insulate root domain reputation.
                </p>
              </div>
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="font-bold text-purple-700 uppercase text-[10px]">2. Town Crier Audience Engine</span>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  Powers permission-based publication channels (Gongs) with isolated dedicated senders (e.g., community@), sub-60s welcome autoresponders, and Shadow-DOM embeds.
                </p>
              </div>
            </div>
          </section>

          <section id="auth-keys" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">2. Authentication & Scoped API Keys</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              API requests require Bearer token authentication in the HTTP header (<code className="font-mono text-zinc-900 font-bold">Authorization: Bearer midas_live_...</code>). Keys are provisioned under <strong>Settings & Profile</strong> (<code className="font-mono text-blue-600">/profile?tab=apiKeys</code>) with an account ceiling of 15 keys.
            </p>
            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-zinc-200 text-left">
                <thead className="bg-zinc-50 text-zinc-500 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Scope</th>
                    <th className="py-2.5 px-3">Authorization Level</th>
                    <th className="py-2.5 px-3">Allowed Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[11px] font-medium text-zinc-700">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">*</td>
                    <td className="py-2 px-3 font-bold">Super Admin</td>
                    <td className="py-2 px-3">Full programmatic control over all campaigns, leads, broadcasts, and webhooks.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-zinc-800">campaigns:*</td>
                    <td className="py-2 px-3">Campaign Admin</td>
                    <td className="py-2 px-3">Read, create, pause, resume campaigns, and trigger send sweeps.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-zinc-800">leads:*</td>
                    <td className="py-2 px-3">Leads Ingestion</td>
                    <td className="py-2 px-3">Read, query, upload CSVs, and update lead statuses.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-zinc-800">town_crier:*</td>
                    <td className="py-2 px-3">Audience Admin</td>
                    <td className="py-2 px-3">Manage Gongs, subscribe users, publish broadcasts, and export data.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-zinc-800">analytics:read</td>
                    <td className="py-2 px-3">Read Telemetry</td>
                    <td className="py-2 px-3">Query real-time subscriber counts, delivery stats, and sequence performance.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="env-vars" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">3. Zero-Config Environment Variables</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Standard client libraries detect credentials from the runtime environment. Define <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">MIDAS_API_KEY</code> in your environment, and the NPM SDK (<code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">@midas-aem/client</code>) initializes with zero arguments:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>.env.local / Environment Configuration</span>
                <button
                  type="button"
                  onClick={() => copyCode(`MIDAS_API_KEY=midas_live_YOUR_KEY\nMIDAS_BASE_URL=${origin}`, 'env')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'env' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`# Add to your .env or .env.local file
MIDAS_API_KEY=midas_live_a1b2c3d4e5f6...
MIDAS_BASE_URL=${origin}`}
              </pre>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm mt-3">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>Node.js / Next.js Client Usage</span>
                <button
                  onClick={() => copyCode(`import { MidasClient } from '@midas-aem/client';\n\n// Zero arguments needed — auto-picks process.env.MIDAS_API_KEY\nconst midas = new MidasClient();`, 'env-usage')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'env-usage' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`import { MidasClient } from '@midas-aem/client';

// Zero arguments needed — automatically reads process.env.MIDAS_API_KEY
const midas = new MidasClient();

await midas.subscribe({
  email: 'subscriber@acme.com',
  name: 'Alex Mercer',
  cadence: 'weekly'
});`}
              </pre>
            </div>
          </section>

          <section id="dropin-widget" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">4. Universal Drop-In Script (Shadow DOM Isolated)</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              If you aren't using the NPM package, drop our universal script tag into your website's <code className="font-mono text-zinc-800 font-bold">&lt;head&gt;</code> or <code className="font-mono text-zinc-800 font-bold">&lt;body&gt;</code>. It automatically derives the API origin and delegates click events globally across SPA route changes:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>HTML Script Tag</span>
                <button
                  type="button"
                  onClick={() => copyCode(`<script src="${origin}/api/public/town-crier/widget.js" async></script>`, 'widget')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'widget' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
                {`<script src="${origin}/api/public/town-crier/widget.js" async></script>`}
              </pre>
            </div>
          </section>

          <section id="modal-engine" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">5. Clerk-Style Modal Engine</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Attach <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">data-town-crier-modal</code> to any button or link. The widget intercepts clicks, mounts a high-contrast Shadow DOM modal with background blur, and traps focus:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>modal-trigger.html</span>
                <button
                  type="button"
                  onClick={() => copyCode(`<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,cadence"
  data-headline="Join 15,000+ Founders"
  data-accent="#7C3AED"
  data-button="Get Instant Access">
  Subscribe to Newsletter
</button>`, 'modal-btn')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'modal-btn' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,cadence"
  data-headline="Join 15,000+ Founders"
  data-accent="#7C3AED"
  data-button="Get Instant Access">
  Subscribe to Newsletter
</button>`}
              </pre>
            </div>
          </section>

          <section id="progressive" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">6. Progressive Profiling & Dynamic Schemas</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Capture structured B2B lead intelligence without writing custom state machines. Pass a declarative JSON schema via <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">data-schema</code> supporting typed inputs, dropdowns, frequency pills, and boolean switches with conditional follow-up expansions:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>progressive-schema-modal.html</span>
                <button
                  type="button"
                  onClick={() => copyCode(`<button 
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
</button>`, 'schema-code')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'schema-code' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`<button 
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
</button>`}
              </pre>
            </div>
          </section>

          <section id="gongs-channels" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">7. Gong Channels & Preset Welcome Autoresponders</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              A <strong>Gong</strong> is a publication channel or lead-magnet offer stream (e.g., <em>"Weekly Alpha"</em> or <em>"15% Discount Voucher"</em>). When a subscriber signs up to a Gong with <code className="font-mono font-bold text-zinc-900">welcomeEmailEnabled: true</code>, Midas automatically personalizes and dispatches the welcome lead-magnet email in &lt;60 seconds.
            </p>
          </section>

          <section id="sender-isolation" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">8. Dedicated Newsletter Mailbox (community@)</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Cold prospecting cycles across rotating secondary mailboxes, but newsletters must send from a <strong>single stable sender address</strong> (e.g. <code className="font-mono text-blue-700 font-bold">community@pyrexxai.com</code>).
            </p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              In <strong>Town Crier</strong> $\rightarrow$ <strong>Gongs</strong>, click <strong>"+ Create Mailbox in Place"</strong>. Select your verified domain, type <code className="font-mono font-bold text-zinc-900">community</code>, and save. The sender is created and bound immediately without leaving the channel drawer.
            </p>
          </section>

          <section id="email-templates" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">9. Selectable Email Envelope Templates</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Every broadcast issue and welcome autoresponder supports 4 pre-built email envelope styles, with <strong>Card Envelope enabled as default</strong>:
            </p>
            <ul className="list-disc pl-5 text-xs text-zinc-600 space-y-1">
              <li><code className="font-mono font-bold text-zinc-900">card</code> (Default): Centered 580px rounded card envelope with brand logo badge and drop shadow.</li>
              <li><code className="font-mono font-bold text-zinc-900">editorial</code>: Long-form Substack/Beehiiv publication styling with serif reading typography.</li>
              <li><code className="font-mono font-bold text-zinc-900">minimal</code>: Clean top brand accent line with high-contrast whitespace.</li>
              <li><code className="font-mono font-bold text-zinc-900">plain</code>: Conversational raw HTML without borders for maximum primary inbox deliverability.</li>
            </ul>
          </section>

          <section id="framework-sdks" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">10. First-Party React Wrapper (NPM Package)</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Using the <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">@midas-aem/client</code> package, you can import native React components directly into Next.js or Vite to bypass Content Security Policy (CSP) headers completely.
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>Next.js Client Component</span>
                <button
                  type="button"
                  onClick={() => copyCode(`'use client';
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
}`, 'react-wrapper')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'react-wrapper' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`'use client';
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
}`}
              </pre>
            </div>
          </section>

          <section id="campaigns-api" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">11. Programmatic Campaign Outreach SDK & API</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Automate cold outreach sequences via the NPM SDK or standard REST endpoints:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>Node.js / Next.js SDK</span>
                <button
                  type="button"
                  onClick={() => copyCode(`import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient();

// 1. Trigger Bounded Send Sweep (≤5 emails)
await midas.dispatchCampaign('campaign_123');

// 2. Add Verified Leads to Active Sequence
await midas.addLeadsToCampaign('campaign_123', ['lead_88', 'lead_99']);`, 'sdk-camp')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'sdk-camp' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient();

// 1. Trigger Bounded Send Sweep (≤5 emails)
await midas.dispatchCampaign('campaign_123');

// 2. Add Verified Leads to Active Sequence
await midas.addLeadsToCampaign('campaign_123', ['lead_88', 'lead_99']);`}
              </pre>
            </div>
          </section>

          <section id="webhooks-crm" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">12. Outbound Webhooks & HMAC-SHA256 Verification</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              MIDAS dispatches signed JSON events to your CRM (HubSpot, Salesforce, Slack) with the header <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-900">X-Midas-Signature: t=&lt;timestamp&gt;,v1=&lt;signature&gt;</code>. Verify signatures in Node.js:
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>verifyMidasSignature.ts</span>
                <button
                  type="button"
                  onClick={() => copyCode(`import crypto from 'crypto';

export function verifyMidasWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(\`\${parts.t}.\${rawBody}\`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
}`, 'wh-verify')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'wh-verify' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`import crypto from 'crypto';

export function verifyMidasWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(\`\${parts.t}.\${rawBody}\`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
}`}
              </pre>
            </div>
          </section>

          <section id="cli-reference" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">13. Headless Developer CLI (cli/midas.js)</h2>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>Terminal Session</span>
                <button
                  onClick={() => copyCode(`node cli/midas.js login --key midas_live_YOUR_KEY\nnode cli/midas.js stats\nnode cli/midas.js gongs list`, 'cli-ref')}
                  className="text-xs text-zinc-300 hover:text-white font-bold no-print"
                >
                  {copiedKey === 'cli-ref' ? '✓ Copied' : '1-Click Copy'}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-xs overflow-x-auto select-all">
{`# 1. Authenticate CLI
node cli/midas.js login --key midas_live_YOUR_KEY

# 2. Check Live Telemetry Radar
node cli/midas.js stats

# 3. List Gong Channels
node cli/midas.js gongs list

# 4. Dispatch Headless Broadcast
node cli/midas.js broadcast --gong gong_123 --subject "Issue #42" --body "Weekly updates..."`}
              </pre>
            </div>
          </section>

          <section id="error-matrix" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">14. Error Code & Diagnostic Matrix</h2>
            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-zinc-200 text-left">
                <thead className="bg-zinc-50 text-zinc-500 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Error Code</th>
                    <th className="py-2.5 px-3">Root Cause & Remediation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[11px] font-medium text-zinc-700">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-rose-600">400</td>
                    <td className="py-2 px-3 font-mono">VALIDATION_ERROR</td>
                    <td className="py-2 px-3">Missing email or invalid Gong identifier. Verify parameters.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-rose-600">401</td>
                    <td className="py-2 px-3 font-mono">UNAUTHORIZED</td>
                    <td className="py-2 px-3">Missing or invalid Bearer key. Verify prefix <code className="font-mono">midas_live_</code> or <code className="font-mono">tc_live_</code>.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-rose-600">403</td>
                    <td className="py-2 px-3 font-mono">FORBIDDEN_SCOPE</td>
                    <td className="py-2 px-3">API Key lacks required permission. Regenerate key with appropriate scope in Settings.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-amber-600">404</td>
                    <td className="py-2 px-3 font-mono">GONG_NOT_FOUND</td>
                    <td className="py-2 px-3">Channel slug or ID does not exist in your workspace.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-rose-600">503</td>
                    <td className="py-2 px-3 font-mono">TIMEOUT_GUARD</td>
                    <td className="py-2 px-3">Request exceeded the 15s execution ceiling. Upstream dependency latency.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};