import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { useToast } from '../../../context/ToastContext';
import { Icons } from '../../../lib/icons';

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

<!-- 2. Modal Trigger with Gong Slug, Custom Accent & Dynamic Fields -->
<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_API_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,company,cadence"
  data-headline="Join 15,000+ Founders"
  data-subheadline="Choose your digest frequency and get our weekly growth playbook."
  data-accent="#4A2559"
  data-button="Get Instant Access"
  style="padding: 12px 24px; border-radius: 12px; background: #4A2559; color: #fff; font-weight: bold; border: none; cursor: pointer;">
  Subscribe (Opens Modal)
</button>`;

  const progressiveSnippet = `<!-- 1. Include Universal Script -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Progressive Profiling Trigger -->
<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_API_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,company,developer"
  data-headline="Join the Engineering Alpha"
  data-subheadline="Tell us if you are a developer to unlock technical repositories."
  data-accent="#4A2559">
  Progressive Profiling Modal
</button>`;

  const universalSnippet = `<!-- 1. Include Universal Widget Script -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Drop-in Inline Card (Shadow DOM isolated) -->
<div 
  data-town-crier-widget 
  data-key="midas_live_YOUR_API_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email"
  data-theme="card" 
  data-accent="#4A2559"
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
      'Authorization': 'Bearer ' + process.env.MIDAS_API_KEY
    },
    body: JSON.stringify({
      email,
      name,
      gongId: 'weekly-alpha',
      cadence: cadence || 'weekly',
      metadata: { company, ...metadata },
      tags: ['nextjs_app_router']
    })
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ success: true, subscriber: data.subscriber });
}`;

  const nodeJsSnippet = `import { MidasClient } from '@midas-aem/client';

// Auto-detects process.env.MIDAS_API_KEY from environment
const client = new MidasClient();

await client.subscribe({
  email: 'prospect@acme.com',
  name: 'Alex Mercer',
  gongId: 'weekly-alpha',
  cadence: 'weekly',
  tags: ['enterprise', 'lead_magnet'],
  metadata: { company: 'Acme Corp', isDeveloper: true }
});`;

  const CodePanel = ({ filename, code, copyId }: { filename: string; code: string; copyId: string }) => (
    <div className="rounded-2xl border border-gold-500/45 bg-royal-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-royal-800/70 border-b border-gold-500/35">
        <span className="text-[11px] font-mono font-bold text-thistle-300">{filename}</span>
        <button
          type="button"
          onClick={() => copyToClipboard(code, copyId)}
          className="px-3 py-1 bg-royal-950 hover:bg-royal-700 text-thistle-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-gold-500/35"
        >
          {copiedSnippet === copyId ? <Icons.CheckCircle className="text-emerald-400" /> : <Icons.Copy className="text-gold-400" />}
          <span>{copiedSnippet === copyId ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-thistle-100 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
        {code}
      </pre>
    </div>
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Universal Town Crier Integration Suite"
      description="1-Click code snippets to integrate custom newsletter forms into any Next.js, Node.js, Vite, or web platform."
      width="2xl"
    >
      <div className="space-y-5 text-xs">
        <div className="flex border-b border-gold-500/35 gap-2 pb-2 overflow-x-auto">
          {[
            ['modal', '1. Click-to-Open Modal'],
            ['progressive', '2. Progressive Profiling'],
            ['universal', '3. Inline Card'],
            ['nextjs', '4. Next.js App Router'],
            ['node', '5. @midas-aem/client SDK'],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setEmbedFrameworkTab(tabKey as any)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                embedFrameworkTab === tabKey
                  ? 'bg-royal-700 text-white border border-gold-400/50 shadow-2xs'
                  : 'text-royal-800 hover:bg-thistle-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {embedFrameworkTab === 'modal' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Renders an accessible modal overlay with hardware-accelerated animations and background blur:
            </p>
            <CodePanel filename="modal-custom-fields.html" code={modalSnippet} copyId="Modal Custom Fields Snippet" />
          </div>
        )}

        {embedFrameworkTab === 'progressive' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 leading-relaxed">
              <span className="font-bold">Progressive Profiling:</span> Start with a minimal form and reveal conditional inputs (like GitHub URLs) when users toggle boolean switches.
            </div>
            <CodePanel filename="progressive-profiling.html" code={progressiveSnippet} copyId="Progressive Profiling Snippet" />
          </div>
        )}

        {embedFrameworkTab === 'universal' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Embeds a responsive newsletter signup card directly into your page layout (Shadow DOM isolated):
            </p>
            <CodePanel filename="index.html (Inline Widget)" code={universalSnippet} copyId="Universal HTML Embed" />
          </div>
        )}

        {embedFrameworkTab === 'nextjs' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              In Next.js, securely proxy subscriber signups through an API Route Handler:
            </p>
            <CodePanel filename="app/api/newsletter/route.ts" code={nextJsSnippet} copyId="Next.js API Handler" />
          </div>
        )}

        {embedFrameworkTab === 'node' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Install <code className="font-mono bg-thistle-100 px-1.5 py-0.5 rounded border border-gold-500/30">npm install @midas-aem/client</code> and import <code className="font-mono bg-thistle-100 px-1 py-0.5 rounded">MidasClient</code>:
            </p>
            <CodePanel filename="server/newsletter.ts" code={nodeJsSnippet} copyId="Node.js SDK Snippet" />
          </div>
        )}

        <div className="pt-3 border-t border-gold-500/35 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 btn-royal rounded-xl text-xs font-bold"
          >
            Done Reading Guide
          </button>
        </div>
      </div>
    </Sheet>
  );
};