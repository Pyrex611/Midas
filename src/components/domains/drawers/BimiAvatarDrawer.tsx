import React, { useState, useEffect } from 'react';
import { Sheet } from '../../common/Sheet';
import { domainAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface BimiAvatarDrawerProps {
  domain: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BimiAvatarDrawer: React.FC<BimiAvatarDrawerProps> = ({
  domain,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'bimi' | 'gmail_free' | 'svg_code'>('gmail_free');

  const [bimiEnabled, setBimiEnabled] = useState(false);
  const [bimiSvgUrl, setBimiSvgUrl] = useState('');
  const [bimiVmcUrl, setBimiVmcUrl] = useState('');
  const [dmarcReport, setDmarcReport] = useState<any | null>(null);
  const [checkingDmarc, setCheckingDmarc] = useState(false);
  const [savingBimi, setSavingBimi] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);

  useEffect(() => {
    if (!domain) return;
    setBimiEnabled(domain.bimiEnabled || false);
    setBimiSvgUrl(domain.bimiSvgUrl || '');
    setBimiVmcUrl(domain.bimiVmcUrl || '');
    setCheckingDmarc(true);

    domainAPI.checkDmarcBimi(domain.id)
      .then((res) => setDmarcReport(res.data))
      .catch(() => setDmarcReport({ policy: 'missing', bimiReady: false }))
      .finally(() => setCheckingDmarc(false));
  }, [domain]);

  const handleSaveBimi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;

    setSavingBimi(true);
    try {
      await domainAPI.updateBimi(domain.id, {
        bimiEnabled,
        bimiSvgUrl,
        bimiVmcUrl,
      });
      toast.success('BIMI inbox avatar settings updated successfully', 'Avatar Configured');
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not save BIMI avatar settings'), 'BIMI Error');
    } finally {
      setSavingBimi(false);
    }
  };

  const pyrexxSvgSnippet = `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.2" baseProfile="tiny-ps" xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 512 512" width="512" height="512" overflow="visible">
  <title>Pyrexx AI</title>
  <defs>
    <linearGradient id="pyrexxCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
    <linearGradient id="pyrexxPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#6b21a8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <path d="M176 80 L336 80 Q376 80 404 108 L404 108 Q432 136 432 176 L432 336 Q432 376 404 404 Q376 432 336 432 L176 432 Q136 432 108 404 Q80 376 80 336 L80 176 Q80 136 108 108 Q136 80 176 80 Z"
        fill="#1e293b" stroke="#334155" stroke-width="8"/>
  <g transform="translate(256, 256) scale(0.72) translate(-256, -256)">
    <path d="M150 110 C210 110, 240 180, 256 220 C272 180, 302 110, 362 110 C410 110, 440 145, 440 190 C440 230, 410 260, 370 290 L290 350 C265 370, 247 370, 222 350 L142 290 C102 260, 72 230, 72 190 C72 145, 102 110, 150 110 Z"
          fill="none" stroke="#ffffff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M150 110 C210 110, 240 180, 256 220 C272 180, 302 110, 362 110 C410 110, 440 145, 440 190 C440 230, 410 260, 370 290 L290 350 C265 370, 247 370, 222 350 L142 290 C102 260, 72 230, 72 190 C72 145, 102 110, 150 110 Z"
          fill="none" stroke="url(#pyrexxCyan)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M362 402 C302 402, 272 332, 256 292 C240 332, 210 402, 150 402 C102 402, 72 367, 72 322 C72 282, 102 252, 142 222 L222 162 C247 142, 265 142, 290 162 L370 222 C410 252, 440 282, 440 322 C440 367, 410 402, 362 402 Z"
          fill="none" stroke="#ffffff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M362 402 C302 402, 272 332, 256 292 C240 332, 210 402, 150 402 C102 402, 72 367, 72 322 C72 282, 102 252, 142 222 L222 162 C247 142, 265 142, 290 162 L370 222 C410 252, 440 282, 440 322 C440 367, 410 402, 362 402 Z"
          fill="none" stroke="url(#pyrexxPurple)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M222 162 C247 142, 265 142, 290 162 L320 185"
          fill="none" stroke="#ffffff" stroke-width="56" stroke-linecap="round"/>
    <path d="M222 162 C247 142, 265 142, 290 162 L320 185"
          fill="none" stroke="url(#pyrexxCyan)" stroke-width="42" stroke-linecap="round"/>
  </g>
</svg>`;

  const copySvgCode = async () => {
    try {
      await navigator.clipboard.writeText(pyrexxSvgSnippet);
      setCopiedSvg(true);
      toast.success('BIMI SVG code copied to clipboard!', 'Asset Ready');
      setTimeout(() => setCopiedSvg(false), 2500);
    } catch {
      toast.error('Could not copy SVG code', 'Error');
    }
  };

  if (!domain) return null;

  return (
    <Sheet
      isOpen={Boolean(domain)}
      onClose={onClose}
      title={`Inbox Avatar Configuration: ${domain.domainName}`}
      description="Configure your visual brand avatar for Gmail, Apple Mail, and Yahoo Mail."
      width="xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 gap-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('gmail_free')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'gmail_free'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            ⭐ 1. Gmail Instant Fix (Free, 2-Min)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('svg_code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'svg_code'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            2. Pyrexx AI SVG Vector
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bimi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'bimi'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            3. BIMI & DNS Setup
          </button>
        </div>

        {/* TAB 1: GMAIL INSTANT FREE AVATAR BYPASS */}
        {activeSubTab === 'gmail_free' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                Why your avatar isn't showing yet in Gmail
              </span>
              <p className="text-emerald-950 font-medium leading-relaxed">
                Google <strong>strictly requires a Verified Mark Certificate (VMC)</strong> for BIMI logos to display in Gmail. Without a VMC (which costs ~$1,500/year), Gmail suppresses the BIMI DNS logo and shows a letter circle.
              </p>
              <p className="text-emerald-900 font-bold">
                Follow this free 2-minute method to get your Pyrexx AI logo into 100% of Gmail inboxes immediately:
              </p>
            </div>

            <ol className="list-decimal pl-4 space-y-2.5 text-zinc-700 font-medium leading-relaxed">
              <li>
                Open an Incognito/Private window and visit{' '}
                <a
                  href="https://accounts.google.com/signup"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-bold underline"
                >
                  accounts.google.com/signup ↗
                </a>
              </li>
              <li>
                Select <strong>"For my personal use"</strong>. Enter your name and birthday.
              </li>
              <li>
                When prompted to pick a Gmail address, click:{' '}
                <span className="font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                  "Use my current email address instead"
                </span>.
              </li>
              <li>
                Enter your custom domain sender email (e.g.,{' '}
                <code className="font-mono text-blue-700 font-bold">alex@{domain.domainName}</code>).
              </li>
              <li>
                Google will send a 6-digit confirmation code. Check your Midas{' '}
                <strong>Unified Inbox</strong> to grab the code.
              </li>
              <li>
                Go to{' '}
                <a
                  href="https://myaccount.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-bold underline"
                >
                  myaccount.google.com ↗
                </a>
                , click the <strong>Profile Picture</strong> icon, and upload the Pyrexx AI logo.
              </li>
            </ol>

            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-600 text-[11px]">
              ✨ <strong>Immediate Effect:</strong> Every Gmail user receiving emails from this address will now see your official logo beside your messages in the inbox.
            </div>
          </div>
        )}

        {/* TAB 2: PYREXX AI COMPLIANT SVG TINY P/S ASSET */}
        {activeSubTab === 'svg_code' && (
          <div className="space-y-4 text-xs">
            <p className="text-zinc-600 leading-relaxed">
              BIMI strictly forbids raster images (PNG/JPEG) embedded inside SVG files. Here is the clean, validated vector code for Pyrexx AI, formatted to strict <strong>SVG Tiny 1.2 P/S</strong> specifications with circular safe-zone padding.
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[11px] font-mono font-bold text-zinc-400">bimi-logo.svg (SVG Tiny 1.2 P/S)</span>
                <button
                  type="button"
                  onClick={copySvgCode}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700/80 shadow-2xs"
                >
                  {copiedSvg ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-emerald-300">Copied SVG!</span>
                    </>
                  ) : (
                    <span>1-Click Copy SVG</span>
                  )}
                </button>
              </div>
              <pre className="p-4 text-zinc-200 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed max-h-60">
                {pyrexxSvgSnippet}
              </pre>
            </div>

            <p className="text-[11px] text-zinc-500">
              Save this file as <code className="bg-zinc-100 px-1 py-0.5 rounded font-bold font-mono">bimi-logo.svg</code> and upload it to your public website at <code className="bg-zinc-100 px-1 py-0.5 rounded font-bold font-mono">https://{domain.domainName}/.well-known/bimi-logo.svg</code>.
            </p>
          </div>
        )}

        {/* TAB 3: BIMI & DMARC DNS CONFIGURATION */}
        {activeSubTab === 'bimi' && (
          <form onSubmit={handleSaveBimi} className="space-y-4">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-zinc-400">DMARC Policy Check</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  dmarcReport?.bimiReady
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {checkingDmarc ? 'Inspecting DNS...' : `Policy: ${dmarcReport?.policy?.toUpperCase() || 'NONE'}`}
                </span>
              </div>
              <p className="text-zinc-600">
                {dmarcReport?.bimiReady
                  ? '✓ DMARC policy is strictly enforced (quarantine/reject). BIMI DNS verification can proceed for Apple Mail and Yahoo.'
                  : '⚠ BIMI requires DMARC to be published with p=quarantine or p=reject. Update your _dmarc DNS TXT record to enable avatar support.'}
              </p>
              {dmarcReport?.record && (
                <p className="font-mono text-[10px] text-zinc-400 bg-white p-2 rounded border border-zinc-100 truncate">
                  {dmarcReport.record}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-800">Enable BIMI Avatar for Domain</label>
                <p className="text-[11px] text-zinc-400">Instructs mail clients to load your brand SVG logo.</p>
              </div>
              <input
                type="checkbox"
                checked={bimiEnabled}
                disabled={!dmarcReport?.bimiReady}
                onChange={(e) => setBimiEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0 disabled:opacity-40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">SVG Tiny 1.2 Logo URL</label>
              <input
                type="url"
                value={bimiSvgUrl}
                onChange={(e) => setBimiSvgUrl(e.target.value)}
                placeholder={`https://${domain.domainName}/.well-known/bimi-logo.svg`}
                className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">VMC Certificate URL (Optional - For Gmail Blue Checkmark)</label>
              <input
                type="url"
                value={bimiVmcUrl}
                onChange={(e) => setBimiVmcUrl(e.target.value)}
                placeholder={`https://${domain.domainName}/.well-known/bimi-vmc.pem`}
                className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingBimi}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors shadow-xs"
              >
                {savingBimi ? 'Saving...' : 'Save BIMI Settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );
};