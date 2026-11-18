import React, { useEffect, useState } from 'react';
import { billingAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

export const BillingSettings: React.FC = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadBilling = async () => {
    try {
      const res = await billingAPI.getStatus();
      setStatus(res.data);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load billing details'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleCheckout = async (plan: 'CHIEF' | 'SYNDICATE') => {
    setCheckingOutPlan(plan);
    try {
      const effectiveCycle = billingCycle === 'annual' && status?.annualAvailable ? 'annual' : 'monthly';
      const res = await billingAPI.checkout(plan, effectiveCycle);
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not initiate Dodo Payments checkout'), 'Checkout Error');
    } finally {
      setCheckingOutPlan(null);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await billingAPI.cancel();
      toast.info('Subscription scheduled for cancellation at period end', 'Cancelled');
      setConfirmCancelOpen(false);
      await loadBilling();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Cancellation failed'), 'Error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-xs text-thistle-500">Loading subscription &amp; quota telemetry...</div>;
  }

  const limits = status?.limits || {};
  const usage = status?.usage || {};
  const currentPlan = status?.plan || 'SCOUT';
  const isAdmin = Boolean(status?.isAdmin);
  const annualAvailable = Boolean(status?.annualAvailable);
  const tiers: any[] = status?.tiers || [];

  const meterRows = [
    ['Monthly Emails Dispatched', usage.emailsSentThisMonth || 0, limits.monthlyEmails || 2000],
    ['Monthly AI Credits', usage.aiCreditsUsed || 0, limits.monthlyAiCredits || 25],
    ['Cold Leads Stored', usage.leads || 0, limits.maxLeads || 500],
    ['Town Crier Subscribers', usage.subscribers || 0, limits.maxSubscribers || 1000],
    ['Knowledge Bases', usage.knowledgeBases || 0, limits.maxKnowledgeBases || 1],
    ['Sending Domains', usage.domains || 0, limits.maxDomains || 1],
  ];

  return (
    <div className="space-y-6">
      <div className="card-midas rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-500/35">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-black text-royal-950 tracking-tight">
                Current Tier: {status?.displayName || 'Scout (Free Forever)'}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isAdmin
                  ? 'bg-royal-700 text-gold-300 border-gold-400/50'
                  : status?.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isAdmin ? 'SUPERADMIN BYPASS' : (status?.status || 'ACTIVE')}
              </span>
            </div>
            <p className="text-xs text-thistle-500 mt-0.5">
              Powered by Dodo Payments (Merchant of Record). Global VAT &amp; tax compliance included automatically.
            </p>
          </div>

          {!isAdmin && currentPlan !== 'SCOUT' && !status?.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
              className="px-3.5 py-1.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"
            >
              Cancel Subscription
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meterRows.map(([label, used, max]) => {
            const pct = isAdmin ? 5 : Math.min(100, Math.round(((used as number) / Math.max(1, max as number)) * 100));
            return (
              <div key={label as string} className="p-3.5 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-royal-950">
                  <span>{label as string}</span>
                  <span className="font-mono text-royal-700">
                    {(used as number).toLocaleString()} / {isAdmin ? '∞' : (max as number).toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-thistle-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full transition-all ${pct > 85 ? 'bg-rose-600' : 'bg-royal-700'}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-black text-royal-950">Upgrade Your Workspace Plan</h3>
          {annualAvailable && (
            <div className="flex p-1 bg-white border border-gold-500/40 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  billingCycle === 'monthly' ? 'bg-royal-700 text-white' : 'text-royal-800'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  billingCycle === 'annual' ? 'bg-royal-700 text-white' : 'text-royal-800'
                }`}
              >
                Annual (Save ~17%)
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((t) => {
            const isCurrent = currentPlan === t.tier;
            const displayPrice =
              t.tier === 'SCOUT'
                ? '$0'
                : billingCycle === 'annual' && annualAvailable
                ? `$${Math.round(t.priceUsdAnnual / 12)}`
                : `$${t.priceUsdMonthly}`;

            const strikePrice = t.tier === 'CHIEF' ? '$50' : t.tier === 'SYNDICATE' ? '$129' : null;

            return (
              <div
                key={t.tier}
                className={`p-6 rounded-2xl border flex flex-col justify-between space-y-5 ${
                  t.tier === 'CHIEF'
                    ? 'bg-white border-gold-500 shadow-lg ring-1 ring-gold-400/40'
                    : 'card-midas'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-royal-700">{t.displayName}</span>
                    {t.tier === 'CHIEF' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gold-200 text-royal-950 border border-gold-500/50">
                        FOUNDING RATE · SAVE 30%
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {strikePrice && (
                      <span className="text-base font-bold text-thistle-500 line-through">{strikePrice}</span>
                    )}
                    <span className="text-3xl font-black text-royal-950">{displayPrice}</span>
                    <span className="text-xs text-thistle-500">/month</span>
                  </div>

                  <ul className="space-y-2 pt-3 border-t border-gold-500/30 text-xs text-royal-950/85">
                    <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>{t.monthlyEmails.toLocaleString()}</strong> emails/month</span></li>
                    <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>{t.maxLeads.toLocaleString()}</strong> leads · <strong>{t.maxSubscribers.toLocaleString()}</strong> subscribers</span></li>
                    <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>{t.maxKnowledgeBases}</strong> Knowledge Bases ({t.maxResourcesPerKnowledgeBase} resources/KB)</span></li>
                    <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>{t.maxArtifactsPerEntity}</strong> Artifacts per entity (≤{t.maxArtifactSizeMb}MB)</span></li>
                    <li className="flex items-center gap-2"><Icons.CheckCircle className="text-emerald-600" /><span><strong>{t.monthlyAiCredits}</strong> AI Credits/mo (+ BYO Key unlimited)</span></li>
                    <li className="flex items-center gap-2"><Icons.CheckCircle className={t.allowAutoReplyAgent ? 'text-emerald-600' : 'text-thistle-300'} /><span>Autonomous AI SDR Auto-Reply</span></li>
                  </ul>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 bg-thistle-100 text-royal-800 border border-gold-500/35 rounded-xl text-xs font-bold"
                  >
                    Unlocked via Superadmin
                  </button>
                ) : isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 bg-thistle-100 text-royal-800 border border-gold-500/35 rounded-xl text-xs font-bold"
                  >
                    Active Plan
                  </button>
                ) : t.tier === 'SCOUT' ? (
                  <div className="text-center text-[11px] text-thistle-500 font-medium py-2">Default Free Tier</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckout(t.tier)}
                    disabled={checkingOutPlan === t.tier || !status?.dodoConfigured}
                    className="w-full py-2.5 btn-royal rounded-xl text-xs font-bold"
                  >
                    {!status?.dodoConfigured
                      ? 'Configure Dodo Keys to Upgrade'
                      : checkingOutPlan === t.tier
                      ? 'Opening Checkout...'
                      : `Lock In ${t.tier} Rate`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Paid Subscription"
        description="Your workspace will remain on your current tier until the end of the billing period, then revert to Scout (Free)."
        confirmLabel="Confirm Cancellation"
        loading={cancelling}
      />
    </div>
  );
};