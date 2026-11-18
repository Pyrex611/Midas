import React, { useEffect, useState } from 'react';
import { billingAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface PlanSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendedPlan?: 'SCOUT' | 'CHIEF' | 'SYNDICATE';
  personaLabel?: string;
}

export const PlanSelectorModal: React.FC<PlanSelectorModalProps> = ({
  isOpen,
  onClose,
  recommendedPlan = 'CHIEF',
  personaLabel,
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    billingAPI
      .getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPlan = status?.plan || 'SCOUT';
  const isAdmin = Boolean(status?.isAdmin);
  const dodoConfigured = Boolean(status?.dodoConfigured);
  const annualAvailable = Boolean(status?.annualAvailable);
  const emailsUsed = status?.usage?.emailsSentThisMonth || 0;
  const emailLimit = status?.limits?.monthlyEmails || 2000;

  const handleCheckout = async (plan: 'CHIEF' | 'SYNDICATE') => {
    setCheckingOut(plan);
    try {
      const cycleToUse = billingCycle === 'annual' && annualAvailable ? 'annual' : 'monthly';
      const res = await billingAPI.checkout(plan, cycleToUse);
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not initialize Dodo checkout'), 'Billing Error');
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-[28px] border border-gold-500/45 shadow-2xl overflow-hidden z-10 my-8 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 sm:px-8 py-6 bg-thistle-50 border-b border-gold-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-royal-700 text-gold-300 border border-gold-400/50">
                {isAdmin ? 'Superadmin (Unlimited)' : `Current Plan: ${status?.displayName || 'Scout (Free)'}`}
              </span>
              {!isAdmin && (
                <span className="text-[11px] font-mono text-thistle-500">
                  {emailsUsed.toLocaleString()} / {emailLimit.toLocaleString()} monthly emails used
                </span>
              )}
              {personaLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-thistle-100 text-royal-800 border border-gold-500/30">
                  Tailored for {personaLabel}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-royal-950 tracking-tight mt-1.5">
              Choose Your MIDAS Infrastructure Plan
            </h2>
            <p className="text-xs text-thistle-500">
              Founding Operator Pricing — Lock in launch discounts for life via Dodo Payments.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {annualAvailable && (
              <div className="flex p-1 bg-thistle-100 border border-gold-500/40 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    billingCycle === 'monthly' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    billingCycle === 'annual' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
                  }`}
                >
                  Annual (Save 17%)
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-thistle-500 hover:text-royal-950 p-1.5 rounded-lg hover:bg-thistle-100"
              aria-label="Close plan selector"
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-thistle-500">Loading subscription tiers...</div>
        ) : (
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* SCOUT */}
            <div className="p-6 rounded-2xl bg-thistle-50/70 border border-gold-500/35 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-thistle-500">Scout (Free Forever)</span>
                  {recommendedPlan === 'SCOUT' && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      GREAT START
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-royal-950">$0</span>
                  <span className="text-xs text-thistle-500">/month</span>
                </div>
                <p className="text-[11px] text-royal-950/70">Test deliverability, embed your first Gong channel, and run Sandbox sends.</p>

                <ul className="space-y-2 pt-3 border-t border-gold-500/25 text-xs text-royal-950/85">
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>2,000</strong> emails / month</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>500</strong> leads · <strong>1,000</strong> subscribers</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>1</strong> domain · <strong>2</strong> senders · <strong>2</strong> Gongs</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>25</strong> AI credits / mo (+ BYO key)</span></li>
                  <li className="flex items-center gap-2 text-thistle-500"><Icons.Close className="text-thistle-400" /><span>Autonomous AI Auto-Reply</span></li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-thistle-100 text-royal-800 text-xs font-bold border border-gold-500/40 transition-colors"
              >
                {currentPlan === 'SCOUT' ? 'Continue on Scout (Free)' : 'Keep Current Plan'}
              </button>
            </div>

            {/* CHIEF */}
            <div className="p-6 rounded-2xl bg-white border-2 border-gold-500 shadow-xl ring-2 ring-gold-400/20 flex flex-col justify-between space-y-5 relative">
              <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-royal-700 text-gold-300 border border-gold-400">
                {recommendedPlan === 'CHIEF' ? 'Recommended · Save 30%' : 'Founding Rate · Save 30%'}
              </span>

              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-royal-700">Chief (Pro)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-thistle-500 line-through">$50</span>
                  <span className="text-3xl font-black text-royal-950">
                    {billingCycle === 'annual' && annualAvailable ? '$29' : '$35'}
                  </span>
                  <span className="text-xs text-thistle-500">/month</span>
                </div>
                <p className="text-[11px] text-royal-950/70">Nearly 3× entry cold-email volume plus Town Crier &amp; State-Graph AI.</p>

                <ul className="space-y-2 pt-3 border-t border-gold-500/25 text-xs text-royal-950/90">
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>15,000</strong> emails / month</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>10,000</strong> leads · <strong>10,000</strong> subscribers</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>10</strong> domains · <strong>25</strong> senders · <strong>25</strong> Gongs</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>500</strong> AI credits / mo + <strong>5</strong> KBs</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>Auto-Reply</strong> + Invites + Custom CNAME</span></li>
                </ul>
              </div>

              {currentPlan === 'CHIEF' || isAdmin ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-thistle-100 text-royal-800 text-xs font-bold border border-gold-500/35"
                >
                  {isAdmin ? 'Unlocked via Superadmin' : 'Active Current Plan'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckout('CHIEF')}
                  disabled={!dodoConfigured || checkingOut === 'CHIEF'}
                  className="w-full py-2.5 btn-royal rounded-xl text-xs font-bold"
                >
                  {!dodoConfigured
                    ? 'Checkout Coming Soon'
                    : checkingOut === 'CHIEF'
                    ? 'Opening Checkout...'
                    : 'Lock In Chief Founding Rate →'}
                </button>
              )}
            </div>

            {/* SYNDICATE */}
            <div className="p-6 rounded-2xl bg-thistle-50/70 border border-gold-500/35 flex flex-col justify-between space-y-5 relative">
              {recommendedPlan === 'SYNDICATE' && (
                <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-royal-950 text-gold-300 border border-gold-500">
                  Agency Recommended
                </span>
              )}

              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-royal-800">Syndicate (Agency)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-thistle-500 line-through">$129</span>
                  <span className="text-3xl font-black text-royal-950">
                    {billingCycle === 'annual' && annualAvailable ? '$79' : '$99'}
                  </span>
                  <span className="text-xs text-thistle-500">/month</span>
                </div>
                <p className="text-[11px] text-royal-950/70">High-volume agency scale across 100 domains and 250 rotating mailboxes.</p>

                <ul className="space-y-2 pt-3 border-t border-gold-500/25 text-xs text-royal-950/85">
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>100,000</strong> emails / month</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>50,000</strong> leads · <strong>50,000</strong> subscribers</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>100</strong> domains · <strong>250</strong> senders · <strong>100</strong> Gongs</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>2,500</strong> AI credits / mo + <strong>50</strong> KBs</span></li>
                  <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span>All Pro Features &amp; High-Volume Scale</span></li>
                </ul>
              </div>

              {currentPlan === 'SYNDICATE' || isAdmin ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-thistle-100 text-royal-800 text-xs font-bold border border-gold-500/35"
                >
                  {isAdmin ? 'Unlocked via Superadmin' : 'Active Current Plan'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckout('SYNDICATE')}
                  disabled={!dodoConfigured || checkingOut === 'SYNDICATE'}
                  className="w-full py-2.5 bg-white hover:bg-thistle-100 border border-gold-500/50 text-royal-800 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {!dodoConfigured
                    ? 'Checkout Coming Soon'
                    : checkingOut === 'SYNDICATE'
                    ? 'Opening Checkout...'
                    : 'Upgrade to Syndicate'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="px-8 py-4 bg-thistle-50 border-t border-gold-500/35 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-thistle-500">
          <span>Secured by Dodo Payments (Merchant of Record · Global VAT handled automatically)</span>
          <button type="button" onClick={onClose} className="font-bold text-royal-800 hover:underline">
            Skip for now &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};