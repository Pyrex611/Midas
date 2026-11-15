import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

type EnvelopeStyle = 'card' | 'editorial' | 'minimal' | 'plain';

function buildEnvelopePreviewHtml(style: EnvelopeStyle): string {
  const sampleBody = `
    <p style="margin:0 0 12px 0;">Hi Alex,</p>
    <p style="margin:0 0 12px 0;">Here is your weekly breakdown on keeping outbound domains above 98% primary inbox placement while automating reply triage.</p>
    <p style="margin:0 0 16px 0;"><strong>Key takeaway:</strong> Decouple newsletter broadcasts (<code>community@</code>) from cold sequence burners.</p>
    <p style="margin:0;">Best,<br/>Pyrexx AI Team</p>
  `;

  if (style === 'plain') {
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1f1124;background:#fff;">${sampleBody}</body></html>`;
  }
  if (style === 'minimal') {
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:-apple-system,sans-serif;background:#fff;"><div style="max-width:520px;margin:0 auto;border-top:3px solid #4A2559;padding-top:16px;"><div style="font-size:13px;font-weight:800;color:#1F1124;margin-bottom:16px;">Pyrexx AI</div><div style="font-size:14px;line-height:1.65;color:#27272a;">${sampleBody}</div></div></body></html>`;
  }
  if (style === 'editorial') {
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F3EBF6;font-family:Georgia,serif;"><div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid rgba(212,175,55,0.45);border-radius:8px;overflow:hidden;"><div style="padding:24px 28px 14px;text-align:center;border-bottom:2px solid #D4AF37;"><div style="font-family:-apple-system,sans-serif;font-size:18px;font-weight:900;color:#1F1124;letter-spacing:-0.02em;text-transform:uppercase;">Pyrexx AI</div><div style="font-family:-apple-system,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#9E6E9E;margin-top:4px;">Official Publication Edition</div></div><div style="padding:28px;color:#27272a;font-size:15px;line-height:1.7;">${sampleBody}</div></div></body></html>`;
  }
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F3EBF6;font-family:-apple-system,sans-serif;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid rgba(212,175,55,0.45);box-shadow:0 4px 12px rgba(31,17,36,0.06);overflow:hidden;"><div style="padding:20px 24px 16px;border-bottom:1px solid rgba(212,175,55,0.35);display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:8px;background:#4A2559;color:#F3D98B;font-weight:800;font-size:11px;line-height:28px;text-align:center;">PX</div><span style="font-size:14px;font-weight:700;color:#1F1124;">Pyrexx AI</span></div><div style="padding:24px;color:#1F1124;font-size:14px;line-height:1.65;">${sampleBody}</div></div></body></html>`;
}

const NAV_GROUPS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'overview', label: 'Architecture Overview' },
      { id: 'quickstart', label: '5-Minute SDK & Sandbox' },
      { id: 'python-sdk', label: 'Python SDK (midas-aem)' },
      { id: 'auth-model', label: 'Authentication & Scopes' },
    ],
  },
  {
    group: 'Town Crier & Embeds',
    items: [
      { id: 'dropin-widget', label: 'Universal Drop-In Script' },
      { id: 'progressive', label: 'Progressive Profiling' },
      { id: 'gongs-channels', label: 'Gong Slugs & Autoresponders' },
      { id: 'email-envelopes', label: 'Live Email Envelopes' },
    ],
  },
  {
    group: 'REST API Reference',
    items: [
      { id: 'api-campaigns', label: 'Campaigns & Sequences' },
      { id: 'api-leads', label: 'Leads & Blocklist' },
      { id: 'api-domains', label: 'Domains, DNS & Multi-ESP' },
      { id: 'api-inbox-ai', label: 'Inbox, KB & Artifacts' },
    ],
  },
  {
    group: 'Webhooks, Automation & CLI',
    items: [
      { id: 'webhooks', label: 'Webhook Payloads & HMAC' },
      { id: 'ecosystems', label: 'Zapier, Make & n8n' },
      { id: 'cli', label: 'Standalone CLI & Scaffolder' },
      { id: 'errors', label: 'Error & Status Matrix' },
    ],
  },
];

export const DeveloperDocs: React.FC = () => {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [previewEnvelope, setPreviewEnvelope] = useState<EnvelopeStyle>('card');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app';

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedKey(id);
      toast.success('Copied to clipboard', 'Snippet Ready');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Clipboard permission denied', 'Copy Failed');
    }
  };

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return NAV_GROUPS;
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const CodeBlock = ({ id, filename, code }: { id: string; filename: string; code: string }) => (
    <div className="rounded-2xl border border-gold-500/40 bg-royal-950 overflow-hidden shadow-md">
      <div className="flex justify-between items-center px-4 py-2 bg-royal-800/70 border-b border-gold-500/30 text-[11px] font-mono text-thistle-300">
        <span className="flex items-center gap-2">
          <Icons.Terminal className="text-gold-400" />
          <span>{filename}</span>
        </span>
        <button
          type="button"
          onClick={() => copyCode(code, id)}
          className="px-2.5 py-1 rounded-lg bg-royal-950/70 hover:bg-royal-700 text-xs text-thistle-100 font-bold flex items-center gap-1.5 border border-gold-500/35 no-print transition-colors"
        >
          <Icons.Copy className="text-gold-400" />
          <span>{copiedKey === id ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-thistle-100 font-mono text-xs overflow-x-auto leading-relaxed select-all">
        {code}
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-thistle-canvas text-royal-950 flex flex-col">
      <header className="h-16 sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gold-500/40 px-4 sm:px-8 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 rounded-lg text-royal-700 hover:bg-thistle-100"
            aria-label="Toggle Docs Navigation"
          >
            <Icons.Menu />
          </button>

          <Link to="/docs" className="flex items-center gap-2.5">
            <span className="text-xl font-black bg-gradient-to-r from-royal-700 via-royal-600 to-gold-500 bg-clip-text text-transparent tracking-wider">
              MIDAS
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-thistle-100 text-royal-800 border border-gold-500/35">
              Developers
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold-200/70 text-royal-950 border border-gold-400/50">
              v2.6
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block w-64">
            <span className="absolute left-3 top-2.5 text-thistle-500">
              <Icons.Search className="text-sm" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter documentation..."
              className="w-full pl-9 pr-3 py-1.5 bg-thistle-canvas border border-gold-500/35 rounded-xl text-xs text-royal-950 placeholder-thistle-500 focus:outline-none focus:border-gold-500"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl border border-gold-500/40 bg-white hover:bg-thistle-50 text-xs font-bold text-royal-800 glow-gold-hover flex items-center gap-1.5"
          >
            <Icons.Download className="text-gold-600" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-xl btn-royal text-xs font-bold flex items-center gap-1.5"
          >
            <span>Workspace</span>
            <Icons.ChevronLeft className="rotate-180" />
          </Link>
        </div>
      </header>

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex">
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-16 left-0 z-30 block shadow-2xl' : 'hidden'
          } lg:block w-68 shrink-0 border-r border-gold-500/40 bg-white/85 backdrop-blur-sm p-5 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16 no-print`}
        >
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.group} className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-thistle-500 px-2.5">
                  {group.group}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeId === item.id;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={() => {
                          setActiveId(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`block px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                          isActive
                            ? 'bg-royal-700 text-white font-bold border-gold-400/60 shadow-xs'
                            : 'border-transparent text-royal-950/75 hover:text-royal-800 hover:bg-thistle-100/70'
                        }`}
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-5 sm:px-10 lg:px-14 py-10 space-y-14 max-w-4xl">
          <section id="overview" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-gold-500/40 text-[11px] font-bold text-royal-800">
              <Icons.Book className="text-gold-600" />
              <span>MIDAS Infrastructure Reference</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-royal-950 tracking-tight">
              Dual-Engine Outbound &amp; Audience SDK
            </h1>
            <p className="text-sm text-royal-950/80 leading-relaxed">
              MIDAS is a deliverability-first orchestration layer that sits across Mailgun, Resend (newsletters), and Custom SMTP. It separates cold outreach sequences (rotated across mailboxes with bounded 5-send sweeps and 20s cooldowns) from permission-based newsletters via <strong>Town Crier Gong</strong> channels.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl card-midas space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-royal-800">
                  <Icons.Campaigns className="text-gold-600" />
                  <span>Cold Sequences Engine</span>
                </div>
                <p className="text-xs text-royal-950/75 leading-relaxed">
                  Multi-sender rotation, recursive Spintax, Company Knowledge Base grounding, tracked Artifacts, and AI State-Graph reply handling.
                </p>
              </div>
              <div className="p-4 rounded-2xl card-midas space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-royal-800">
                  <Icons.TownCrier className="text-gold-600" />
                  <span>Town Crier &amp; Gongs</span>
                </div>
                <p className="text-xs text-royal-950/75 leading-relaxed">
                  Slug-addressed newsletter channels, Shadow-DOM modals, progressive profiling, and sub-60s welcome autoresponders.
                </p>
              </div>
            </div>
          </section>

          <section id="quickstart" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">5-Minute SDK &amp; Zero-Setup Sandbox</h2>
            <p className="text-xs text-royal-950/80 leading-relaxed">
              Install <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gold-500/30">@midas-aem/client</code> or run the interactive CLI scaffolder:
            </p>
            <CodeBlock id="install" filename="Terminal" code={`npm install @midas-aem/client\nnpx @midas-aem/client init`} />
            <CodeBlock
              id="sdk-init"
              filename="lib/newsletter.ts"
              code={`import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient();

// 1. Fire a Zero-Setup Sandbox test email to your own inbox (no DNS needed)
await midas.sendSandboxTest({ subject: 'Hello from Midas SDK' });

// 2. Subscribe directly to a Gong channel by slug
await midas.subscribe({
  email: 'alex@acme.com',
  name: 'Alex Mercer',
  gongId: 'weekly-alpha',
  cadence: 'weekly',
  metadata: { role: 'Founder', isDeveloper: true },
});

// 3. Trigger a bounded cold-outreach sweep (<= 5 sends/tick)
await midas.dispatchCampaign('campaign_cuid_123');`}
            />
          </section>

          <section id="python-sdk" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Python SDK (<code className="font-mono text-royal-700">midas-aem</code>)</h2>
            <p className="text-xs text-royal-950/80 leading-relaxed">
              Official synchronous and <code className="font-mono">asyncio</code> client built on <code className="font-mono">httpx</code> for FastAPI backends and AI agent pipelines.
            </p>
            <CodeBlock
              id="py-install"
              filename="Python (Sync & Async)"
              code={`pip install midas-aem

# example.py
from midas_aem import MidasClient, AsyncMidasClient

client = MidasClient(api_key="midas_live_YOUR_KEY", base_url="${origin}")
client.subscribe(email="lead@acme.com", name="Alex", gong_id="weekly-alpha")
client.send_sandbox_test()

# Async FastAPI / LangGraph usage
async with AsyncMidasClient(api_key="midas_live_YOUR_KEY", base_url="${origin}") as async_client:
    await async_client.dispatch_campaign("campaign_cuid_123")`}
            />
          </section>

          <section id="auth-model" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Authentication Model &amp; Scopes</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-gold-500/25 text-left text-xs">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-3 px-4">Plane</th>
                    <th className="py-3 px-4">Credential Format</th>
                    <th className="py-3 px-4">Supported Surfaces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20 text-royal-950/80">
                  <tr>
                    <td className="py-3 px-4 font-bold text-royal-800">Scoped API Key</td>
                    <td className="py-3 px-4 font-mono">Authorization: Bearer midas_live_...</td>
                    <td className="py-3 px-4">/api/public/town-crier/*, /api/campaigns/*, /api/leads/*, /api/sandbox/*</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-royal-800">Dashboard Session</td>
                    <td className="py-3 px-4 font-mono">Clerk Session JWT</td>
                    <td className="py-3 px-4">All UI routes (/api/domains, /api/inbox, /api/knowledge, /api/artifacts)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-royal-800">Cron Scheduler</td>
                    <td className="py-3 px-4 font-mono">Bearer CRON_SECRET / QStash Sig</td>
                    <td className="py-3 px-4">/api/cron/queue, /leads, /followups, /newsletter, /snapshots</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="dropin-widget" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Universal Drop-In Script &amp; React SDK</h2>
            <CodeBlock
              id="html-modal"
              filename="index.html"
              code={`<script src="${origin}/api/public/town-crier/widget.js" async></script>

<button
  data-town-crier-modal
  data-key="midas_live_YOUR_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,cadence"
  data-headline="Join 15,000+ Founders"
  data-accent="#4A2559"
  data-button="Get Instant Access">
  Subscribe to Weekly Alpha
</button>`}
            />
            <CodeBlock
              id="react-comp"
              filename="components/NewsletterButton.tsx"
              code={`'use client';
import { MidasModal } from '@midas-aem/client/react';

export function NewsletterButton() {
  return (
    <MidasModal
      gongId="weekly-alpha"
      headline="Join the Alpha"
      accent="#4A2559"
      developerToggle
      className="px-4 py-2 rounded-xl bg-[#4A2559] text-white font-bold"
    >
      Subscribe
    </MidasModal>
  );
}`}
            />
          </section>

          <section id="progressive" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Progressive Profiling Schemas</h2>
            <CodeBlock
              id="schema-demo"
              filename="progressive-schema.html"
              code={`<button
  data-town-crier-modal
  data-key="midas_live_YOUR_KEY"
  data-gong="dev-preview"
  data-schema='[
    {"name":"name","type":"text","label":"Full Name"},
    {"name":"email","type":"email","label":"Work Email","required":true},
    {
      "name":"isDeveloper",
      "type":"boolean",
      "label":"Are you a developer?",
      "followUp":{"name":"githubUrl","type":"url","label":"GitHub URL","placeholder":"https://github.com/you"}
    }
  ]'>
  Join Developer Preview
</button>`}
            />
          </section>

          <section id="gongs-channels" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Gong Slugs &amp; Welcome Autoresponders</h2>
            <CodeBlock
              id="gong-curl"
              filename="Subscribe by Gong Slug (cURL)"
              code={`curl -X POST "${origin}/api/public/town-crier/subscribe" \\
  -H "Authorization: Bearer midas_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "lead@company.com",
    "name": "Alex Mercer",
    "gong": "weekly-alpha",
    "cadence": "weekly"
  }'`}
            />
          </section>

          <section id="email-envelopes" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Live Interactive Email Envelopes</h2>
            <div className="rounded-2xl border border-gold-500/45 bg-white overflow-hidden shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-thistle-50 border-b border-gold-500/35">
                <div className="flex gap-1.5">
                  {(['card', 'editorial', 'minimal', 'plain'] as EnvelopeStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setPreviewEnvelope(style)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                        previewEnvelope === style
                          ? 'bg-royal-700 text-white border border-gold-400/50 shadow-xs'
                          : 'bg-white text-royal-800 border border-gold-500/30 hover:bg-thistle-100'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-thistle-500">Live HTML Render Preview</span>
              </div>
              <iframe
                title="Email Envelope Live Preview"
                srcDoc={buildEnvelopePreviewHtml(previewEnvelope)}
                className="w-full h-72 bg-white border-0"
                sandbox=""
              />
            </div>
          </section>

          <section id="api-campaigns" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">REST API: Campaigns &amp; Sequences</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-gold-500/25 text-left">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr><th className="py-2.5 px-4">Method &amp; Endpoint</th><th className="py-2.5 px-4">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20">
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET / POST /api/campaigns</td><td className="py-2.5 px-4">List or create sequences</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/campaigns/:id/leads</td><td className="py-2.5 px-4">Attach owned leads and reconcile queue</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/campaigns/:id/dispatch-now</td><td className="py-2.5 px-4">Trigger bounded send sweep (&le; 5 emails)</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/sandbox/test-send</td><td className="py-2.5 px-4">Send zero-setup test email to your account inbox</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="api-leads" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">REST API: Leads &amp; Blocklist</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-gold-500/25 text-left">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr><th className="py-2.5 px-4">Method &amp; Endpoint</th><th className="py-2.5 px-4">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20">
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/leads/upload</td><td className="py-2.5 px-4">Multipart CSV/XLSX upload with column mapping</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET /api/leads</td><td className="py-2.5 px-4">Paginated lead list with status &amp; campaignId filters</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET / POST / DELETE /api/leads/blocklist</td><td className="py-2.5 px-4">Manage domain &amp; email suppression patterns</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="api-domains" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">REST API: Domains, DNS &amp; Multi-ESP</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-gold-500/25 text-left">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr><th className="py-2.5 px-4">Method &amp; Endpoint</th><th className="py-2.5 px-4">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20">
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/domains</td><td className="py-2.5 px-4">Connect BYO Mailgun domain (US/EU) and run live send test</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/domains/esp</td><td className="py-2.5 px-4">Connect Resend (Town Crier) or Custom SMTP domain</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET /api/domains/:id/dns-inspect</td><td className="py-2.5 px-4">Authoritative SPF, DKIM, MX, DMARC &amp; tracking CNAME check</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/domains/:id/tracking-domain</td><td className="py-2.5 px-4">Register custom CNAME tracking domain (Cloudflare SaaS)</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET /api/domains/:id/snapshots</td><td className="py-2.5 px-4">30-day time-series Human Open vs. Bounce metrics</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="api-inbox-ai" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">REST API: Inbox, Knowledge Base &amp; Artifacts</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-gold-500/25 text-left">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr><th className="py-2.5 px-4">Method &amp; Endpoint</th><th className="py-2.5 px-4">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20">
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">GET /api/inbox?domainId=...&amp;senderId=...</td><td className="py-2.5 px-4">Filter inbox threads by specific domain or sender mailbox</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/knowledge | /scrape-url</td><td className="py-2.5 px-4">Add company playbooks or auto-index website URLs for AI grounding</td></tr>
                  <tr><td className="py-2.5 px-4 font-mono font-bold text-royal-700">POST /api/artifacts/link | /upload</td><td className="py-2.5 px-4">Create cold-safe <code className="font-mono">{`{{artifact:slug}}`}</code> link/document tokens</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="webhooks" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Outbound Webhook Payloads &amp; HMAC</h2>
            <CodeBlock
              id="wh-payloads"
              filename="Event Envelope & Payload Examples"
              code={`// 1. lead.replied
{
  "id": "evt_1731560000_ab12cd",
  "event": "lead.replied",
  "timestamp": 1731560000,
  "data": {
    "leadId": "cm2...",
    "leadEmail": "sarah@acme.com",
    "campaignId": "cm1...",
    "subject": "Re: Quick question",
    "snippet": "Sounds interesting — send me your calendar link."
  }
}

// 2. gong.subscribed
{
  "event": "gong.subscribed",
  "data": { "recipientId": "cm3...", "email": "alex@co.com", "gongSlug": "weekly-alpha", "cadence": "weekly" }
}`}
            />
          </section>

          <section id="ecosystems" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Zapier, Make &amp; n8n Ecosystem Connectors</h2>
            <p className="text-xs text-royal-950/80 leading-relaxed">
              Connect MIDAS to 5,000+ CRM and workflow apps via signed Webhooks (Trigger) + HTTP Request Nodes (Action):
            </p>
            <CodeBlock
              id="n8n-recipe"
              filename="n8n HTTP Request Node Configuration (Action)"
              code={`Method: POST
URL: ${origin}/api/public/town-crier/subscribe
Authentication: Generic Header Auth
  Header Name:  Authorization
  Header Value: Bearer midas_live_YOUR_API_KEY
JSON Body:
{
  "email": "{{ $json.email }}",
  "name": "{{ $json.full_name }}",
  "gong": "weekly-alpha",
  "tags": ["n8n_crm_sync"]
}`}
            />
          </section>

          <section id="cli" className="space-y-4 scroll-mt-24 pb-8 border-b border-gold-500/35">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Standalone CLI &amp; Project Scaffolder</h2>
            <CodeBlock
              id="cli-ref"
              filename="Terminal"
              code={`# 1. Scaffold Next.js / Vite React integration automatically
npx @midas-aem/client init

# 2. Direct operational CLI
node cli/midas.js login --key midas_live_YOUR_KEY --url ${origin}
node cli/midas.js gongs list
node cli/midas.js subscribers add --email "lead@acme.com" --name "Alex" --gong weekly-alpha`}
            />
          </section>

          <section id="errors" className="space-y-4 scroll-mt-24 pb-16">
            <h2 className="text-2xl font-black text-royal-950 tracking-tight">Error &amp; Diagnostic Matrix</h2>
            <div className="rounded-2xl border border-gold-500/40 bg-white overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-gold-500/25 text-left">
                <thead className="bg-thistle-100/80 text-royal-800 font-bold text-[10px] uppercase">
                  <tr><th className="py-2.5 px-4">HTTP</th><th className="py-2.5 px-4">Meaning &amp; Resolution</th></tr>
                </thead>
                <tbody className="divide-y divide-gold-500/20">
                  <tr><td className="py-2 px-4 font-mono font-bold text-rose-600">400</td><td className="py-2 px-4">Validation error, Resend cold-outreach AUP guard, or Mailgun rejection.</td></tr>
                  <tr><td className="py-2 px-4 font-mono font-bold text-rose-600">401</td><td className="py-2 px-4">Invalid/revoked <code className="font-mono">midas_live_</code> key or expired Clerk session.</td></tr>
                  <tr><td className="py-2 px-4 font-mono font-bold text-rose-600">429</td><td className="py-2 px-4">Public subscription rate limit (60 req/min) or sandbox daily limit reached.</td></tr>
                  <tr><td className="py-2 px-4 font-mono font-bold text-rose-600">503</td><td className="py-2 px-4">15s timeout guard triggered due to upstream AI or DB latency.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="hidden xl:block w-56 shrink-0 py-10 pr-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto no-print">
          <p className="text-[10px] font-black uppercase tracking-widest text-thistle-500 mb-3">On This Page</p>
          <ul className="space-y-1.5 text-xs border-l border-gold-500/40 pl-3">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setActiveId(item.id)}
                  className={`block transition-colors ${
                    activeId === item.id ? 'text-royal-700 font-bold' : 'text-royal-950/60 hover:text-royal-800'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};