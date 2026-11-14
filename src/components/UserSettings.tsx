import React, { useState, useEffect } from 'react';
import { userSettingsAPI, aiAPI } from '../services/api';
import { Sheet } from './common/Sheet';
import { ConfirmDialog } from './common/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import { Icons } from '../lib/icons';

const MODEL_PRESETS: Record<string, string[]> = {
  aigateway: [
    'openai/gpt-4o-mini',
    'deepseek/deepseek-chat',
    'google/gemini-1.5-flash',
    'anthropic/claude-3-5-sonnet',
    'meta-llama/llama-3.3-70b-instruct',
  ],
  openrouter: [
    'deepseek/deepseek-chat',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.3-70b-instruct',
    'openai/gpt-4o-mini',
  ],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  ollama: ['llama3.2:1b', 'llama3.1:8b', 'mistral'],
  mock: ['mock-default'],
};

export const UserSettings: React.FC = () => {
  const { toast } = useToast();

  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');
  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [customOptOutText, setCustomOptOutText] = useState('');

  const [brandingEnabled, setBrandingEnabled] = useState(false);
  const [brandColorHex, setBrandColorHex] = useState('#4A2559');
  const [brandInitials, setBrandInitials] = useState('PX');
  const [logoUrl, setLogoUrl] = useState('');

  const [confirmedIntegrations, setConfirmedIntegrations] = useState<any[]>([]);
  const [activeAiProvider, setActiveAiProvider] = useState<string>('aigateway');
  const [activeAiModel, setActiveAiModel] = useState<string>('openai/gpt-4o-mini');

  const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false);
  const [newProvider, setNewProvider] = useState('aigateway');
  const [newModel, setNewModel] = useState('openai/gpt-4o-mini');
  const [newApiKey, setNewApiKey] = useState('');
  const [newGatewayUrl, setNewGatewayUrl] = useState('https://ai-gateway.vercel.sh/v1');
  const [verifyingNewProvider, setVerifyingNewProvider] = useState(false);

  const [addingModelForProvider, setAddingModelForProvider] = useState<string | null>(null);
  const [customModelInput, setCustomModelInput] = useState('');
  const [verifyingNewModel, setVerifyingNewModel] = useState(false);

  const [deleteIntegrationId, setDeleteIntegrationId] = useState<string | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAIIntegrations = async () => {
    try {
      const res = await aiAPI.getIntegrations();
      setActiveAiProvider(res.data?.activeProvider || 'aigateway');
      setActiveAiModel(res.data?.activeModel || 'openai/gpt-4o-mini');
      setConfirmedIntegrations(res.data?.integrations || []);
    } catch {}
  };

  useEffect(() => {
    userSettingsAPI.get()
      .then(res => {
        if (res.data) {
          setSendLimit(res.data.sendLimit ?? 50);
          setSendPeriod(res.data.sendPeriod ?? 'day');
          setCompanyName(res.data.companyName ?? '');
          setPhysicalAddress(res.data.physicalAddress ?? '');
          setCustomOptOutText(res.data.customOptOutText ?? '');
          setBrandingEnabled(Boolean(res.data.brandingEnabled));
          setBrandColorHex(res.data.brandColorHex || '#4A2559');
          setBrandInitials(res.data.brandInitials || 'PX');
          setLogoUrl(res.data.logoUrl || '');
        }
      })
      .catch(() => {
        toast.error('Failed to load workspace preferences', 'Error');
      })
      .finally(() => setLoading(false));

    loadAIIntegrations();
  }, []);

  const handleProviderSelectChange = (p: string) => {
    setNewProvider(p);
    setNewModel(MODEL_PRESETS[p]?.[0] || '');
  };

  const handleConfirmNewProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider || !newModel) return;

    setVerifyingNewProvider(true);
    try {
      await aiAPI.confirmProvider({
        provider: newProvider,
        model: newModel.trim(),
        apiKey: newApiKey.trim() || undefined,
        gatewayUrl: newProvider === 'aigateway' ? newGatewayUrl.trim() : undefined,
        setAsActive: true,
      });

      toast.success(`Confirmed and activated ${newProvider} (${newModel})`, 'Integration Ready');
      setIsSetupSheetOpen(false);
      setNewApiKey('');
      window.dispatchEvent(new Event('ai_config_changed'));
      await loadAIIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to verify provider', 'Verification Error');
    } finally {
      setVerifyingNewProvider(false);
    }
  };

  const handleAddModel = async (providerId: string) => {
    if (!customModelInput.trim()) return;

    setVerifyingNewModel(true);
    try {
      await aiAPI.addModel(providerId, customModelInput.trim());
      toast.success(`Model ${customModelInput.trim()} verified & added`, 'Model Added');
      setAddingModelForProvider(null);
      setCustomModelInput('');
      window.dispatchEvent(new Event('ai_config_changed'));
      await loadAIIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to verify model with provider', 'Model Rejected');
    } finally {
      setVerifyingNewModel(false);
    }
  };

  const handleSwitchActive = async (provider: string, model: string) => {
    try {
      await aiAPI.switchActive(provider, model);
      setActiveAiProvider(provider);
      setActiveAiModel(model);
      window.dispatchEvent(new Event('ai_config_changed'));
      toast.success(`Active AI set to ${provider} (${model})`, 'Switched');
      await loadAIIntegrations();
    } catch {
      toast.error('Could not switch active provider', 'Error');
    }
  };

  const handleConfirmDeleteIntegration = async () => {
    if (!deleteIntegrationId) return;
    setDeletingIntegration(true);
    try {
      await aiAPI.deleteIntegration(deleteIntegrationId);
      toast.info('Integration removed', 'Removed');
      setDeleteIntegrationId(null);
      window.dispatchEvent(new Event('ai_config_changed'));
      await loadAIIntegrations();
    } catch {
      toast.error('Could not remove integration', 'Error');
    } finally {
      setDeletingIntegration(false);
    }
  };

  const handleDeleteModel = async (providerId: string, model: string) => {
    try {
      await aiAPI.deleteModel(providerId, model);
      toast.info(`Removed ${model}`, 'Model Removed');
      window.dispatchEvent(new Event('ai_config_changed'));
      await loadAIIntegrations();
    } catch {
      toast.error('Could not remove model', 'Error');
    }
  };

  const handleSubmitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userSettingsAPI.update({
        sendLimit: Math.max(1, Number(sendLimit)),
        sendPeriod,
        companyName: companyName.trim() || null,
        physicalAddress: physicalAddress.trim() || null,
        customOptOutText: customOptOutText.trim() || null,
        brandColorHex: brandColorHex.trim() || '#4A2559',
        brandInitials: brandInitials.trim() || 'PX',
        logoUrl: logoUrl.trim() || null,
        brandingEnabled,
      });
      toast.success('Workspace preferences & branding saved', 'Preferences Saved');
    } catch {
      toast.error('Failed to update workspace settings', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-thistle-500">Loading delivery preferences...</div>;
  }

  return (
    <div className="card-midas rounded-2xl p-6 space-y-10">
      {/* 1. AI ENGINE STUDIO */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gold-500/35">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-royal-950 tracking-tight">AI Engine Studio</h3>
              <span className="text-[10px] uppercase font-bold bg-thistle-100 text-royal-800 px-2 py-0.5 rounded-md border border-gold-500/35">
                Active Default: {activeAiProvider.toUpperCase()} ({activeAiModel})
              </span>
            </div>
            <p className="text-xs text-thistle-500 mt-0.5">
              Confirmed LLM provider integrations with verified models. Easily switch, test, or add new models and gateways.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSetupSheetOpen(true)}
            className="px-4 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>Set Up New Provider</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {confirmedIntegrations.map((integration) => {
            const isActive = activeAiProvider === integration.provider;

            return (
              <div
                key={integration.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isActive
                    ? 'bg-thistle-100/60 border-gold-500/65 shadow-xs'
                    : 'bg-thistle-50/50 border-gold-500/35 hover:border-gold-500/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-royal-950">{integration.displayName}</h4>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-royal-700 text-gold-300">
                          Active Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-thistle-500">
                      <span className={`w-2 h-2 rounded-full ${integration.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{integration.status}</span>
                      <span>·</span>
                      <span className="font-mono">{integration.latencyMs ?? 350}ms latency</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setDeleteIntegrationId(integration.id)}
                    className="text-thistle-500 hover:text-rose-600 text-xs font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <div className="text-[11px] text-thistle-500 space-y-0.5 font-mono">
                  {integration.gatewayUrl && (
                    <p className="truncate">Gateway: <span className="text-royal-950">{integration.gatewayUrl}</span></p>
                  )}
                  <p>Credentials: <span className="text-royal-950">{integration.hasApiKey ? 'Custom Key Encrypted' : 'Using Platform Environment Key'}</span></p>
                </div>

                <div className="space-y-2 pt-2 border-t border-gold-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">
                      Confirmed Models ({integration.models.length})
                    </span>
                    <button
                      onClick={() => setAddingModelForProvider(addingModelForProvider === integration.id ? null : integration.id)}
                      className="text-xs font-bold text-royal-700 hover:text-royal-950 flex items-center gap-1"
                    >
                      <Icons.Plus className="text-gold-600 text-[11px]" />
                      <span>Add Model</span>
                    </button>
                  </div>

                  {addingModelForProvider === integration.id && (
                    <div className="p-3 bg-white border border-gold-500/40 rounded-xl space-y-2 animate-in fade-in duration-100">
                      <p className="text-[10px] font-bold uppercase text-thistle-500">Enter Model String to Verify &amp; Add</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          placeholder="e.g. openai/gpt-4o-mini or deepseek/deepseek-chat"
                          className="flex-1 px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-gold-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddModel(integration.id)}
                          disabled={verifyingNewModel || !customModelInput.trim()}
                          className="px-3 py-1.5 btn-royal rounded-lg text-xs font-bold whitespace-nowrap"
                        >
                          {verifyingNewModel ? 'Verifying...' : 'Verify & Add'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {(MODEL_PRESETS[integration.provider] || []).filter(p => !integration.models.includes(p)).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCustomModelInput(preset)}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-thistle-100 hover:bg-thistle-200 text-royal-800"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {integration.models.map((m: string) => {
                      const isModelActive = isActive && activeAiModel === m;

                      return (
                        <div
                          key={m}
                          className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-mono transition-all ${
                            isModelActive
                              ? 'bg-royal-700 text-white font-bold border border-gold-400/60 shadow-2xs'
                              : 'bg-white hover:bg-thistle-100 text-royal-950 border border-gold-500/35'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSwitchActive(integration.provider, m)}
                            className="hover:underline"
                            title="Click to set as Active Model"
                          >
                            {m}
                          </button>

                          {integration.models.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteModel(integration.id, m)}
                              className={`p-0.5 rounded-sm hover:opacity-100 transition-opacity text-[10px] ${
                                isModelActive ? 'text-white/80 hover:text-white' : 'text-thistle-500 hover:text-rose-600'
                              }`}
                              title="Remove this model"
                            >
                              <Icons.Close className="text-[10px]" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!isActive && (
                  <div className="pt-2 border-t border-gold-500/30 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSwitchActive(integration.provider, integration.activeModel)}
                      className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold"
                    >
                      Set as Active Provider
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SENDER LOGO, AVATARS & EMAIL BRAND IDENTITY */}
      <div className="space-y-6 pt-6 border-t border-gold-500/40">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-royal-950 tracking-tight">Sender Logo &amp; Email Brand Avatar</h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                brandingEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-thistle-100 text-thistle-500 border-gold-500/30'
              }`}>
                {brandingEnabled ? 'CARD LOGO ACTIVE' : 'PLAIN HTML (OFF)'}
              </span>
            </div>
            <p className="text-xs text-thistle-500 mt-0.5">
              Wraps outbound emails in a centered 580px card envelope with your custom logo or brand initials badge.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={brandingEnabled}
              onChange={(e) => setBrandingEnabled(e.target.checked)}
            />
            <div className="w-11 h-6 bg-thistle-200 rounded-full peer peer-checked:bg-royal-700 transition-colors" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
          </label>
        </div>

        <div className="p-4 bg-thistle-100/70 border border-gold-500/40 rounded-2xl flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-royal-700 text-gold-300 flex items-center justify-center shrink-0">
              <Icons.Image />
            </div>
            <div>
              <p className="font-bold text-royal-950">Looking to set your Gmail / Apple Mail circular inbox avatar?</p>
              <p className="text-royal-800/80 text-[11px]">
                Inbox avatars are governed at the domain level through <strong>BIMI</strong> (requires DMARC p=quarantine/reject).
              </p>
            </div>
          </div>
          <Link
            to="/domains"
            className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1"
          >
            <span>Manage Domain Avatars</span>
            <Icons.ChevronLeft className="rotate-180" />
          </Link>
        </div>

        {brandingEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-thistle-50/70 border border-gold-500/40 rounded-2xl animate-in fade-in duration-150">
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Brand Avatar Initials</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={brandInitials}
                    onChange={(e) => setBrandInitials(e.target.value.toUpperCase())}
                    placeholder="e.g. PX"
                    className="w-full px-3.5 py-2 bg-white border border-gold-500/40 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-gold-500"
                  />
                  <p className="mt-1 text-[10px] text-thistle-500">Renders inside the 32x32 rounded header avatar badge.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Brand Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColorHex}
                      onChange={(e) => setBrandColorHex(e.target.value)}
                      className="w-10 h-9 p-0.5 border border-gold-500/40 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={brandColorHex}
                      onChange={(e) => setBrandColorHex(e.target.value)}
                      placeholder="#4A2559"
                      className="flex-1 px-3.5 py-2 bg-white border border-gold-500/40 rounded-xl text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Direct Brand Logo Image URL</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://yourdomain.com/logo.png"
                    className="w-full px-3.5 py-2 bg-white border border-gold-500/40 rounded-xl text-xs font-mono focus:outline-none focus:border-gold-500"
                  />
                  <p className="mt-1 text-[10px] text-thistle-500">If set, overrides initials badge with your direct company logo image.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-thistle-500 tracking-wider">Envelope Live Preview</span>
              <div className="p-4 bg-thistle-200/60 rounded-xl border border-gold-500/40">
                <div className="bg-white rounded-xl border border-gold-500/40 p-4 shadow-sm space-y-3 text-[11px]">
                  <div className="flex items-center gap-2 pb-2 border-b border-gold-500/30">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="w-6 h-6 rounded-md object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: brandColorHex }}
                        className="w-6 h-6 rounded-md text-white font-extrabold text-[10px] flex items-center justify-center"
                      >
                        {brandInitials || 'PX'}
                      </div>
                    )}
                    <span className="font-bold text-royal-950">{companyName || 'PyrexxAI'}</span>
                  </div>
                  <p className="text-royal-950/80 leading-relaxed font-sans">
                    Hi Sarah,<br /><br />
                    I noticed your clinic faces missed calls after hours...
                  </p>
                  <div className="p-2 bg-thistle-100 border-l-2 border-gold-500 rounded-r text-[10px] text-royal-800">
                    Next step: 15-minute consultation
                  </div>
                  <div className="pt-2 border-t border-gold-500/25 text-[9px] text-thistle-500">
                    Unsubscribe · {physicalAddress || '100 Market St, San Francisco'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DELIVERY THROTTLING */}
      <div className="space-y-4 pt-6 border-t border-gold-500/40">
        <div>
          <h3 className="text-base font-black text-royal-950 tracking-tight">Global Delivery Throttling</h3>
          <p className="text-xs text-thistle-500 mt-0.5">
            Configure account-wide sending ceilings across all rotating mailboxes combined.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
              Account Maximum Send Ceiling
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              value={sendLimit}
              onChange={(e) => setSendLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
              Throttling Period Window
            </label>
            <select
              value={sendPeriod}
              onChange={(e) => setSendPeriod(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 focus:outline-none"
            >
              <option value="hour">Hourly Rate Limit</option>
              <option value="day">Daily Cumulative Limit</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. CAN-SPAM LEGAL & POSTAL COMPLIANCE */}
      <div className="space-y-4 pt-6 border-t border-gold-500/40">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-royal-950 tracking-tight">CAN-SPAM &amp; Legal Compliance</h3>
            <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 border border-gold-400/50 px-2 py-0.5 rounded-md">
              Legal Mandate
            </span>
          </div>
          <p className="text-xs text-thistle-500 mt-0.5">
            Federal CAN-SPAM and CASL regulations mandate including a registered physical postal address in commercial emails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
              Company / Entity Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Growth Inc."
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-medium focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
              Registered Physical Postal Address
            </label>
            <input
              type="text"
              value={physicalAddress}
              onChange={(e) => setPhysicalAddress(e.target.value)}
              placeholder="100 Market St, Suite 400, San Francisco, CA 94105"
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-medium focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
              Custom Opt-Out Wording (Optional)
            </label>
            <input
              type="text"
              value={customOptOutText}
              onChange={(e) => setCustomOptOutText(e.target.value)}
              placeholder="Don't want to receive these emails? Unsubscribe here"
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-medium focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gold-500/40">
        <button
          onClick={handleSubmitSettings}
          disabled={saving}
          className="px-6 py-2.5 btn-royal text-xs font-bold rounded-xl"
        >
          {saving ? 'Updating Preferences...' : 'Save Workspace Preferences'}
        </button>
      </div>

      <Sheet
        isOpen={isSetupSheetOpen}
        onClose={() => setIsSetupSheetOpen(false)}
        title="Set Up AI Provider Integration"
        description="Verify credentials and model in real-time. Upon successful test, the provider is saved as a confirmed integration."
        width="lg"
      >
        <form onSubmit={handleConfirmNewProvider} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Provider Engine</label>
            <select
              value={newProvider}
              onChange={(e) => handleProviderSelectChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 focus:outline-none"
            >
              <option value="aigateway">Vercel AI Gateway (ai-gateway.vercel.sh)</option>
              <option value="openrouter">OpenRouter (Any LLM Model)</option>
              <option value="gemini">Google Gemini (Direct)</option>
              <option value="openai">OpenAI (Direct)</option>
              <option value="deepseek">DeepSeek (Direct)</option>
              <option value="ollama">Ollama (Local Server)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">Initial Model</label>
            <input
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="e.g. openai/gpt-4o-mini or deepseek/deepseek-chat"
              required
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-mono font-bold text-royal-700 focus:outline-none focus:border-gold-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(MODEL_PRESETS[newProvider] || []).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setNewModel(preset)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-thistle-100 hover:bg-thistle-200 text-royal-800 border border-gold-500/30"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-royal-800 uppercase mb-1">API Key (Optional)</label>
            <input
              type="password"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="Leave blank to use platform environment variables"
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-mono focus:outline-none focus:border-gold-500"
            />
            <p className="mt-1 text-[10px] text-thistle-500">Stored encrypted with AES-256-GCM.</p>
          </div>

          {(newProvider === 'aigateway' || newProvider === 'ollama') && (
            <div>
              <label className="block text-xs font-bold text-royal-800 uppercase mb-1">
                {newProvider === 'ollama' ? 'Ollama Base URL' : 'Vercel AI Gateway Endpoint'}
              </label>
              <input
                type="text"
                value={newGatewayUrl}
                onChange={(e) => setNewGatewayUrl(e.target.value)}
                placeholder={newProvider === 'ollama' ? 'http://localhost:11434' : 'https://ai-gateway.vercel.sh/v1'}
                className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-mono focus:outline-none"
              />
            </div>
          )}

          <div className="pt-4 border-t border-gold-500/35 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSetupSheetOpen(false)}
              className="px-4 py-2 text-xs font-bold text-thistle-500 hover:text-royal-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifyingNewProvider || !newModel.trim()}
              className="px-5 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Bolt className="text-gold-300" />
              <span>{verifyingNewProvider ? 'Verifying Connection...' : 'Test & Confirm Integration'}</span>
            </button>
          </div>
        </form>
      </Sheet>

      <ConfirmDialog
        isOpen={Boolean(deleteIntegrationId)}
        onClose={() => setDeleteIntegrationId(null)}
        onConfirm={handleConfirmDeleteIntegration}
        title={`Remove ${deleteIntegrationId?.toUpperCase()} Integration`}
        description="This provider and its stored API credentials will be removed from your confirmed integrations."
        confirmLabel="Remove Provider"
        loading={deletingIntegration}
      />
    </div>
  );
};