import React, { useState } from 'react';
import { userSettingsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

export type OnboardingPersona = 'TOWN_CRIER' | 'OUTBOUND' | 'HYBRID';

interface PersonaOnboardingModalProps {
  isOpen: boolean;
  onComplete: (result: {
    persona: OnboardingPersona;
    recommendedPlan: 'SCOUT' | 'CHIEF' | 'SYNDICATE';
    personaLabel: string;
  }) => void;
}

export const PersonaOnboardingModal: React.FC<PersonaOnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [persona, setPersona] = useState<OnboardingPersona>('TOWN_CRIER');
  const [volumeBand, setVolumeBand] = useState<'STARTER' | 'GROWTH' | 'AGENCY'>('GROWTH');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await userSettingsAPI.update({
        onboardingPersona: persona,
        completeOnboarding: true,
      });

      const recommendedPlan: 'SCOUT' | 'CHIEF' | 'SYNDICATE' =
        volumeBand === 'AGENCY' ? 'SYNDICATE' : volumeBand === 'GROWTH' ? 'CHIEF' : 'SCOUT';

      const labels: Record<OnboardingPersona, string> = {
        TOWN_CRIER: 'Town Crier Newsletters',
        OUTBOUND: 'Cold B2B Outbound',
        HYBRID: 'Dual-Engine & Agency',
      };

      onComplete({
        persona,
        recommendedPlan,
        personaLabel: labels[persona],
      });
    } catch {
      toast.error('Could not save onboarding preference', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-royal-950/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-xl bg-white rounded-[28px] border border-gold-500/45 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        <div className="px-7 py-6 bg-thistle-50 border-b border-gold-500/35 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-royal-700">
              Workspace Calibration · Step {step} of 2
            </span>
            <div className="flex gap-1.5">
              <span className={`h-1.5 w-6 rounded-full ${step >= 1 ? 'bg-royal-700' : 'bg-thistle-200'}`} />
              <span className={`h-1.5 w-6 rounded-full ${step >= 2 ? 'bg-gold-500' : 'bg-thistle-200'}`} />
            </div>
          </div>
          <h2 className="text-xl font-black text-royal-950 tracking-tight">
            {step === 1 ? 'What brings you to MIDAS?' : 'What is your monthly sending target?'}
          </h2>
          <p className="text-xs text-thistle-500">
            {step === 1
              ? 'We will tailor your workspace checklist, defaults, and AI templates to your primary engine.'
              : 'This helps us calibrate mailbox concurrency and recommend the right starting tier.'}
          </p>
        </div>

        <div className="p-7 space-y-4">
          {step === 1 ? (
            <div className="space-y-3">
              {[
                {
                  id: 'TOWN_CRIER' as const,
                  title: 'Newsletters, Waitlists & Lead Magnets (Town Crier)',
                  desc: 'Capture subscribers via 1-line Shadow-DOM modals, auto-send welcome guides, and publish branded issues.',
                  icon: <Icons.TownCrier className="text-gold-600 text-lg" />,
                },
                {
                  id: 'OUTBOUND' as const,
                  title: 'Cold B2B Sales Outbound (Campaigns)',
                  desc: 'Rotate across warmed mailboxes with Spintax, Knowledge Base grounding, and AI State-Graph reply agents.',
                  icon: <Icons.Campaigns className="text-gold-600 text-lg" />,
                },
                {
                  id: 'HYBRID' as const,
                  title: 'Both Engines / Multi-Client Agency',
                  desc: 'Run isolated cold prospecting sequences alongside dedicated brand newsletter channels under one roof.',
                  icon: <Icons.Bolt className="text-gold-600 text-lg" />,
                },
              ].map((opt) => {
                const selected = persona === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPersona(opt.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                      selected
                        ? 'bg-thistle-100/80 border-gold-500 shadow-xs ring-1 ring-gold-400/40'
                        : 'bg-white border-gold-500/35 hover:bg-thistle-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-royal-700/10 border border-gold-500/30 flex items-center justify-center shrink-0">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-royal-950">{opt.title}</p>
                      <p className="text-[11px] text-royal-950/75 mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  id: 'STARTER' as const,
                  title: 'Under 2,000 emails / month',
                  desc: 'Exploring Zero-Setup Sandbox, launching my first Gong, or validating an initial lead list.',
                  badge: 'Scout Free Fit',
                },
                {
                  id: 'GROWTH' as const,
                  title: '2,000 – 15,000 emails / month',
                  desc: 'Scaling active outbound sequences, team collaboration, custom tracking CNAMEs, or AI auto-replies.',
                  badge: 'Chief Pro Fit',
                },
                {
                  id: 'AGENCY' as const,
                  title: '15,000 – 100,000+ emails / month',
                  desc: 'Operating multi-domain infrastructure across dozens of sending mailboxes and high-volume lists.',
                  badge: 'Syndicate Fit',
                },
              ].map((vol) => {
                const selected = volumeBand === vol.id;
                return (
                  <button
                    key={vol.id}
                    type="button"
                    onClick={() => setVolumeBand(vol.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                      selected
                        ? 'bg-thistle-100/80 border-gold-500 shadow-xs ring-1 ring-gold-400/40'
                        : 'bg-white border-gold-500/35 hover:bg-thistle-50'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-royal-950">{vol.title}</p>
                      <p className="text-[11px] text-royal-950/75 mt-0.5">{vol.desc}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-gold-500/40 text-[10px] font-bold text-royal-800 shrink-0">
                      {vol.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-gold-500/35 flex items-center justify-between">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-bold text-thistle-500 hover:text-royal-950"
              >
                &larr; Back
              </button>
            ) : (
              <span />
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 btn-royal rounded-xl text-xs font-bold"
              >
                Continue &rarr;
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={finishOnboarding}
                className="px-6 py-2.5 btn-royal rounded-xl text-xs font-bold"
              >
                {saving ? 'Calibrating Workspace...' : 'Finish & View Plans →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};