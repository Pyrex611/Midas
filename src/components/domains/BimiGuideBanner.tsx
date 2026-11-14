import React, { useState } from 'react';
import { Icons } from '../../lib/icons';

export const BimiGuideBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-5 card-midas rounded-2xl space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-royal-700 text-gold-300 border border-gold-400/50 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icons.Image className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-royal-950">
                Sender Avatars in Gmail, Apple Mail &amp; Yahoo
              </h3>
              <span className="text-[9px] bg-thistle-100 text-royal-800 font-bold px-2 py-0.5 rounded-full border border-gold-500/35">
                Deliverability Intelligence
              </span>
            </div>
            <p className="text-xs text-royal-950/75 mt-0.5 max-w-2xl leading-relaxed">
              Gmail <strong>strictly requires a VMC certificate</strong> for DNS BIMI records, or you can display your logo in Gmail for free using the 2-minute Google Account profile method.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3.5 py-1.5 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 text-xs font-bold rounded-xl transition-all self-end sm:self-center whitespace-nowrap"
        >
          {expanded ? 'Hide Guide ▲' : 'How Avatars Work ▼'}
        </button>
      </div>

      {expanded && (
        <div className="pt-3 border-t border-gold-500/35 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-in fade-in duration-150">
          <div className="p-3.5 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-1.5">
            <span className="text-[10px] font-black uppercase text-royal-700">1. Gmail Avatars (Free Bypass)</span>
            <p className="text-royal-950/80 leading-relaxed text-[11px]">
              Visit <code className="bg-white px-1 py-0.5 rounded font-mono border border-gold-500/30">accounts.google.com/signup</code>, choose "Use my current email instead", enter your domain email, and upload your logo as the profile picture. It displays across Gmail inboxes for $0.
            </p>
          </div>

          <div className="p-3.5 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-1.5">
            <span className="text-[10px] font-black uppercase text-royal-700">2. Official BIMI (Apple Mail &amp; Yahoo)</span>
            <p className="text-royal-950/80 leading-relaxed text-[11px]">
              Apple Mail and Yahoo support self-asserted BIMI once DMARC is set to <code className="font-mono bg-white px-1 py-0.5 rounded border border-gold-500/30">p=quarantine</code> or <code className="font-mono bg-white px-1 py-0.5 rounded border border-gold-500/30">p=reject</code> and an SVG Tiny 1.2 P/S vector is published.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};