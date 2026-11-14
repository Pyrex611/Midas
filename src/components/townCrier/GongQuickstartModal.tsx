import React, { useState } from 'react';
import { Sheet } from '../common/Sheet';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface GongQuickstartModalProps {
  isOpen: boolean;
  onClose: () => void;
  gong: {
    id: string;
    name: string;
    slug: string;
    welcomeEmailEnabled?: boolean;
    embedTheme?: string;
    accentColor?: string;
  } | null;
}

export const GongQuickstartModal: React.FC<GongQuickstartModalProps> = ({
  isOpen,
  onClose,
  gong,
}) => {
  const { toast } = useToast();
  const [activeSnippetTab, setActiveSnippetTab] = useState<'html' | 'nextjs' | 'curl'>('html');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  if (!gong) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app';
  const accent = gong.accentColor || '#4A2559';

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedLabel(label);
    toast.success(`${label} copied to clipboard`, 'Ready to Deploy');
    setTimeout(() => setCopiedLabel(null), 2500);
  };

  const htmlSnippet = `<!-- 1. Universal Script Tag (Include once in your <head> or <body>) -->
<script src="${origin}/api/public/town-crier/widget.js" async></script>

<!-- 2. Modal Trigger Button bound to ${gong.name} -->
<button 
  data-town-crier-modal 
  data-key="midas_live_YOUR_API_KEY"
  data-gong="${gong.slug}"
  data-fields="name,email,cadence"
  data-accent="${accent}">
  Subscribe to ${gong.name}
</button>`;

  const nextJsSnippet = `// In your Next.js App / Server Action
import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient();

await midas.subscribe({
  email: 'subscriber@domain.com',
  name: 'Alex Mercer',
  gongId: '${gong.slug}',
  cadence: 'weekly'
});`;

  const curlSnippet = `curl -X POST "${origin}/api/public/town-crier/subscribe" \\
  -H "Authorization: Bearer midas_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "lead@company.com",
    "name": "Alex Mercer",
    "gong": "${gong.slug}",
    "cadence": "weekly"
  }'`;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Deploy "${gong.name}" Channel`}
      description="Your Gong channel is live. Copy your pre-filled deployment code below to start collecting subscribers."
      width="xl"
    >
      <div className="space-y-5 text-xs">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="font-bold">Gong Ready to Ingest: /{gong.slug}</p>
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
              Channel ID: <code className="font-mono bg-white/80 px-1 py-0.5 rounded text-emerald-900">{gong.id}</code>
              {gong.welcomeEmailEnabled && ' · Welcome autoresponder active (<60s delivery)'}
            </p>
          </div>
        </div>

        <div className="flex border-b border-gold-500/35 gap-2 pb-2 overflow-x-auto">
          {[
            ['html', '1. Drop-In HTML Modal'],
            ['nextjs', '2. @midas-aem/client SDK'],
            ['curl', '3. cURL / Terminal API'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveSnippetTab(tab as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeSnippetTab === tab
                  ? 'bg-royal-700 text-white border border-gold-400/50 shadow-2xs'
                  : 'text-royal-800 hover:bg-thistle-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeSnippetTab === 'html' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Paste this button into your Webflow, Framer, WordPress, or custom site. Clicks auto-bind to <strong>{gong.name}</strong>:
            </p>
            <div className="rounded-2xl border border-gold-500/45 bg-royal-950 overflow-hidden shadow-lg">
              <div className="flex justify-between items-center px-4 py-2 bg-royal-800/70 border-b border-gold-500/35 font-mono text-[11px] text-thistle-300">
                <span>embed-button.html</span>
                <button
                  type="button"
                  onClick={() => copyCode(htmlSnippet, 'HTML Embed Code')}
                  className="text-xs text-thistle-100 hover:text-gold-300 font-bold flex items-center gap-1"
                >
                  {copiedLabel === 'HTML Embed Code' ? <Icons.CheckCircle className="text-emerald-400" /> : <Icons.Copy className="text-gold-400" />}
                  <span>{copiedLabel === 'HTML Embed Code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-thistle-100 font-mono text-xs overflow-x-auto select-all">
                {htmlSnippet}
              </pre>
            </div>
          </div>
        )}

        {activeSnippetTab === 'nextjs' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Initialize the universal client (<code className="font-mono bg-thistle-100 px-1 rounded">npm install @midas-aem/client</code>) to subscribe directly from Server Actions or route handlers:
            </p>
            <div className="rounded-2xl border border-gold-500/45 bg-royal-950 overflow-hidden shadow-lg">
              <div className="flex justify-between items-center px-4 py-2 bg-royal-800/70 border-b border-gold-500/35 font-mono text-[11px] text-thistle-300">
                <span>subscribe.ts</span>
                <button
                  type="button"
                  onClick={() => copyCode(nextJsSnippet, 'Next.js Snippet')}
                  className="text-xs text-thistle-100 hover:text-gold-300 font-bold flex items-center gap-1"
                >
                  {copiedLabel === 'Next.js Snippet' ? <Icons.CheckCircle className="text-emerald-400" /> : <Icons.Copy className="text-gold-400" />}
                  <span>{copiedLabel === 'Next.js Snippet' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-thistle-100 font-mono text-xs overflow-x-auto select-all">
                {nextJsSnippet}
              </pre>
            </div>
          </div>
        )}

        {activeSnippetTab === 'curl' && (
          <div className="space-y-3">
            <p className="text-royal-950/75">
              Trigger a test subscription from your terminal to verify the channel and welcome autoresponder:
            </p>
            <div className="rounded-2xl border border-gold-500/45 bg-royal-950 overflow-hidden shadow-lg">
              <div className="flex justify-between items-center px-4 py-2 bg-royal-800/70 border-b border-gold-500/35 font-mono text-[11px] text-thistle-300">
                <span>terminal cURL</span>
                <button
                  type="button"
                  onClick={() => copyCode(curlSnippet, 'cURL Command')}
                  className="text-xs text-thistle-100 hover:text-gold-300 font-bold flex items-center gap-1"
                >
                  {copiedLabel === 'cURL Command' ? <Icons.CheckCircle className="text-emerald-400" /> : <Icons.Copy className="text-gold-400" />}
                  <span>{copiedLabel === 'cURL Command' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-thistle-100 font-mono text-xs overflow-x-auto select-all">
                {curlSnippet}
              </pre>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-gold-500/35 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 btn-royal rounded-xl text-xs font-bold"
          >
            Done with Setup
          </button>
        </div>
      </div>
    </Sheet>
  );
};