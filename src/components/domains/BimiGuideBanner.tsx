import React, { useState } from 'react';

export const BimiGuideBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-5 bg-gradient-to-r from-purple-50/70 via-white to-blue-50/60 border border-purple-200/70 rounded-2xl shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
            🖼️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-900">
                Sender Avatars in Gmail, Apple Mail & Yahoo
              </h3>
              <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                Deliverability Intelligence
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-0.5 max-w-2xl leading-relaxed">
              Why isn't your logo showing up in Gmail yet? Gmail <strong>strictly requires a VMC certificate</strong> for DNS BIMI records, but you can display your logo in Gmail for free using the 2-minute Google Account bypass.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold rounded-xl transition-all self-end sm:self-center whitespace-nowrap shadow-2xs"
        >
          {expanded ? 'Hide Guide ▲' : 'How Avatars Work in Inboxes ▼'}
        </button>
      </div>

      {expanded && (
        <div className="pt-3 border-t border-purple-200/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-in fade-in duration-150">
          <div className="p-3.5 bg-white border border-purple-100 rounded-xl space-y-1.5">
            <span className="text-[10px] font-black uppercase text-purple-700">1. Gmail Avatars (Free Bypass)</span>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              Go to <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">accounts.google.com/signup</code>, choose "Use my current email instead", enter your domain email, and upload the Pyrexx AI logo as your profile picture. It shows up for all Gmail recipients immediately for $0.
            </p>
          </div>

          <div className="p-3.5 bg-white border border-purple-100 rounded-xl space-y-1.5">
            <span className="text-[10px] font-black uppercase text-blue-700">2. Official BIMI (Apple Mail & Yahoo)</span>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              Apple Mail and Yahoo support self-asserted BIMI once DMARC is set to <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">p=quarantine</code> or <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">p=reject</code> and an SVG Tiny 1.2 P/S vector is published. Click "Manage Avatar" on any domain below to copy the validated vector.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};