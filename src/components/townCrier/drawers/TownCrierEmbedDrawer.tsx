import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { useToast } from '../../../context/ToastContext';

interface TownCrierEmbedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TownCrierEmbedDrawer: React.FC<TownCrierEmbedDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const [embedFrameworkTab, setEmbedFrameworkTab] = useState<'modal' | 'progressive' | 'universal' | 'nextjs' | 'node'>('modal');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyToClipboard = async (code: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedSnippet(label);
      toast.success(`${label} copied to clipboard!`, 'Copied');
      setTimeout(() => setCopiedSnippet(null), 2500);
    } catch {
      toast.error('Could not copy code to clipboard', 'Error');
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app';

  const modalSnippet = `<!-- 1. Include Universal Script in <head> or <body> -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Modal Trigger with Custom Accent & Dynamic Fields -->
<button 
  data-town-crier-modal 
  data-key="tc_live_YOUR_API_KEY"
  data-fields="name,email,company,cadence"
  data-headline="Join 15,000+ Founders"
  data-subheadline="Choose your digest frequency and get our weekly growth playbook."
  data-accent="#7C3AED"
  data-button="Get Instant Access"
  style="padding: 12px 24px; border-radius: 12px; background: #7C3AED; color: #fff; font-weight: bold; border: none; cursor: pointer;">
  Subscribe (Opens Modal)
</button>`;

  const progressiveSnippet = `<!-- 1. Include Universal Script -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Progressive Profiling Trigger (Developer & Enterprise Toggles) -->
<!-- When the user toggles 'developer', an animated GitHub URL input expands dynamically! -->
<button 
  data-town-crier-modal 
  data-key="tc_live_YOUR_API_KEY"
  data-fields="name,email,company,developer,enterprise"
  data-headline="Join the Engineering Alpha"
  data-subheadline="Tell us if you are a developer to unlock technical repositories."
  data-accent="#059669">
  Progressive Profiling Modal
</button>`;

  const universalSnippet = `<!-- 1. Include Universal Widget Script -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Drop-in Inline Card with Dynamic Fields & Brand Accent -->
<div 
  data-town-crier-widget 
  data-key="tc_live_YOUR_API_KEY" 
  data-fields="name,email"
  data-theme="card" 
  data-accent="#2563EB"
  data-headline="Subscribe to Weekly Dispatch"
  data-subheadline="Deep dives on distributed systems and cold outreach architecture.">
</div>`;

  const nextJsSnippet = `// app/api/newsletter/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, name, company, cadence, metadata } = await req.json();

  const res = await fetch('${origin}/api/public/town-crier/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.TOWN_CRIER_API_KEY
    },
    body: JSON.stringify({
      email,
      name,
      cadence: cadence || 'weekly',
      metadata: { company, ...metadata },
      tags: ['nextjs_app_router']
    })
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ success: true, subscriber: data.subscriber });
}`;

  const nodeJsSnippet = `import { MidasClient } from './lib/townCrierClient';

// Auto-detects process.env.MIDAS_API_KEY from environment!
const client = new MidasClient();

await client.subscribe({
  email: 'prospect@acme.com',
  name: 'Alex Mercer',
  cadence: 'weekly',
  tags: ['enterprise', 'lead_magnet'],
  metadata: { company: 'Acme Corp', isDeveloper: true }
});`;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Universal Town Crier Integration Suite"
      description="1-Click code snippets to integrate custom newsletter forms into any Next.js, Node.js, Vite, or web platform."
      width="2xl"
    >
      <div className="space-y-5 text-xs">
        <div className="flex border-b border-zinc-200 gap-2 pb-2 overflow-x-auto">
          {[
            ['modal', '⭐ 1. Click-to-Open Modal'],
            ['progressive', '⚡ 2. Progressive Profiling'],
            ['universal', '3. Inline Card'],
            ['nextjs', '4. Next.js App Router'],
            ['node', '5. Node.js SDK (Auto-Env)'],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setEmbedFrameworkTab(tabKey as any)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                embedFrameworkTab === tabKey
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: MODAL POPUP */}
        {embedFrameworkTab === 'modal' && (
          <div className="space-y-3">
            <p className="text-zinc-600">
              Renders an accessible modal overlay with hardware-accelerated animations and background blur:
            </p>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">modal-custom-fields.html</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(modalSnippet, 'Modal Custom Fields Snippet')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSnippet === 'Modal Custom Fields Snippet' ? (
                    <span className="text-emerald-300">✓ Copied!</span>
                  ) : (
                    <span>1-Click Copy Modal Code</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                {modalSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: PROGRESSIVE PROFILING (NEW) */}
        {embedFrameworkTab === 'progressive' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 leading-relaxed">
              <span className="font-bold">Progressive Profiling Paradigm:</span> Boost signup conversion rates by starting with a clean form, then allowing users to flip optional boolean switches (e.g., <em>"Are you a developer?"</em>) to smoothly expand GitHub URL inputs!
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">progressive-profiling.html</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(progressiveSnippet, 'Progressive Profiling Snippet')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSnippet === 'Progressive Profiling Snippet' ? (
                    <span className="text-emerald-300">✓ Copied!</span>
                  ) : (
                    <span>1-Click Copy Code</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                {progressiveSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: INLINE WIDGET */}
        {embedFrameworkTab === 'universal' && (
          <div className="space-y-3">
            <p className="text-zinc-600">
              Embeds a responsive newsletter signup card directly into your page layout (Shadow DOM isolated):
            </p>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">index.html (Inline Widget)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(universalSnippet, 'Universal HTML Embed')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSnippet === 'Universal HTML Embed' ? (
                    <span className="text-emerald-300">✓ Copied!</span>
                  ) : (
                    <span>1-Click Copy</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                {universalSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: NEXT.JS */}
        {embedFrameworkTab === 'nextjs' && (
          <div className="space-y-3">
            <p className="text-zinc-600">
              In Next.js, securely proxy subscriber signups through an API Route Handler:
            </p>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">app/api/newsletter/route.ts</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(nextJsSnippet, 'Next.js API Handler')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSnippet === 'Next.js API Handler' ? (
                    <span className="text-emerald-300">✓ Copied!</span>
                  ) : (
                    <span>1-Click Copy</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                {nextJsSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: NODE.JS (Auto-Env) */}
        {embedFrameworkTab === 'node' && (
          <div className="space-y-3">
            <p className="text-zinc-600">
              Use native Node.js 18+ <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">fetch</code> or import the isomorphic <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">MidasClient</code>:
            </p>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">server/newsletter.ts (Auto-Detect Env)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(nodeJsSnippet, 'Node.js SDK Snippet')}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSnippet === 'Node.js SDK Snippet' ? (
                    <span className="text-emerald-300">✓ Copied!</span>
                  ) : (
                    <span>1-Click Copy</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
                {nodeJsSnippet}
              </pre>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Done Reading Guide
          </button>
        </div>
      </div>
    </Sheet>
  );
};