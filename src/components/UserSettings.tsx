import React, { useState, useEffect } from 'react';
import { userSettingsAPI, aiAPI } from '../services/api';
import { Sheet } from './common/Sheet';
import { useToast } from '../context/ToastContext';

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

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAIIntegrations = async () => {
    try {
      const res = await aiAPI.getIntegrations();
      setActiveAiProvider(res.data?.activeProvider || 'aigateway');
      setActiveAiModel(res.data?.activeModel || 'openai/gpt-4o-mini');
      setConfirmedIntegrations(res.data?.integrations || []);
    } catch {
      // Handled
    }
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

  const handleDeleteIntegration = async (providerId: string) => {
    if (!confirm(`Remove ${providerId.toUpperCase()} from confirmed integrations?`)) return;
    try {
      await aiAPI.deleteIntegration(providerId);
      toast.info('Integration removed', 'Removed');
      window.dispatchEvent(new Event('ai_config_changed'));
      await loadAIIntegrations();
    } catch {
      toast.error('Could not remove integration', 'Error');
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
      });
      toast.success('Workspace settings updated', 'Preferences Saved');
    } catch {
      toast.error('Failed to update workspace settings', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-zinc-400">Loading delivery preferences...</div>;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-10">
      {/* AI ENGINE STUDIO */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">AI Engine Studio</h3>
              <span className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/60">
                Active Default: {activeAiProvider.toUpperCase()} ({activeAiModel})
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Confirmed LLM provider integrations with verified models. Easily switch, test, or add new models and gateways.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSetupSheetOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>+ Set Up New Provider</span>
          </button>
        </div>

        {/* Confirmed Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {confirmedIntegrations.map((integration) => {
            const isActive = activeAiProvider === integration.provider;

            return (
              <div
                key={integration.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isActive
                    ? 'bg-blue-50/40 border-blue-300 shadow-xs ring-1 ring-blue-200/60'
                    : 'bg-zinc-50/70 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-zinc-900">{integration.displayName}</h4>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white">
                          Active Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <span className={`w-2 h-2 rounded-full ${integration.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{integration.status}</span>
                      <span>·</span>
                      <span className="font-mono">{integration.latencyMs ?? 350}ms latency</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteIntegration(integration.id)}
                    className="text-zinc-400 hover:text-rose-600 text-xs font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <div className="text-[11px] text-zinc-500 space-y-0.5 font-mono">
                  {integration.gatewayUrl && (
                    <p className="truncate">Gateway: <span className="text-zinc-700">{integration.gatewayUrl}</span></p>
                  )}
                  <p>Credentials: <span className="text-zinc-700">{integration.hasApiKey ? 'Custom Key Encrypted' : 'Using Platform Environment Key'}</span></p>
                </div>

                {/* Confirmed Models List with "+" Add Model Trigger */}
                <div className="space-y-2 pt-2 border-t border-zinc-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Confirmed Models ({integration.models.length})
                    </span>
                    <button
                      onClick={() => setAddingModelForProvider(addingModelForProvider === integration.id ? null : integration.id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <span>+ Add Model</span>
                    </button>
                  </div>

                  {addingModelForProvider === integration.id && (
                    <div className="p-3 bg-white border border-zinc-200 rounded-xl space-y-2 animate-in fade-in duration-100">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Enter Model String to Verify & Add</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          placeholder="e.g. openai/gpt-4o-mini or deepseek/deepseek-chat"
                          className="flex-1 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddModel(integration.id)}
                          disabled={verifyingNewModel || !customModelInput.trim()}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
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
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
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
                              ? 'bg-blue-600 text-white font-bold shadow-2xs'
                              : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
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
                                isModelActive ? 'text-white/80 hover:text-white' : 'text-zinc-400 hover:text-rose-600'
                              }`}
                              title="Remove this model"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!isActive && (
                  <div className="pt-2 border-t border-zinc-200/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSwitchActive(integration.provider, integration.activeModel)}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
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

      {/* DELIVERY THROTTLING */}
      <div className="space-y-4 pt-6 border-t border-zinc-100">
        <div>
          <h3 className="text-base font-black text-zinc-900 tracking-tight">Global Delivery Throttling</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure account-wide sending ceilings across all rotating mailboxes combined.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Account Maximum Send Ceiling
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              value={sendLimit}
              onChange={(e) => setSendLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Throttling Period Window
            </label>
            <select
              value={sendPeriod}
              onChange={(e) => setSendPeriod(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
            >
              <option value="hour">Hourly Rate Limit</option>
              <option value="day">Daily Cumulative Limit</option>
            </select>
          </div>
        </div>
      </div>

      {/* CAN-SPAM LEGAL & POSTAL COMPLIANCE */}
      <div className="space-y-4 pt-6 border-t border-zinc-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-zinc-900 tracking-tight">CAN-SPAM & Legal Compliance</h3>
            <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-md">
              Legal Mandate
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Federal CAN-SPAM and CASL regulations mandate including a registered physical postal address in commercial emails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Company / Entity Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Growth Inc."
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Registered Physical Postal Address
            </label>
            <input
              type="text"
              value={physicalAddress}
              onChange={(e) => setPhysicalAddress(e.target.value)}
              placeholder="100 Market St, Suite 400, San Francisco, CA 94105"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Custom Opt-Out Wording (Optional)
            </label>
            <input
              type="text"
              value={customOptOutText}
              onChange={(e) => setCustomOptOutText(e.target.value)}
              placeholder="Don't want to receive these emails? Unsubscribe here"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100">
        <button
          onClick={handleSubmitSettings}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
        >
          {saving ? 'Updating Preferences...' : 'Save Workspace Preferences'}
        </button>
      </div>

      {/* Set Up New Provider Sheet */}
      <Sheet
        isOpen={isSetupSheetOpen}
        onClose={() => setIsSetupSheetOpen(false)}
        title="Set Up AI Provider Integration"
        description="Verify credentials and model in real-time. Upon successful test, the provider is saved as a confirmed integration."
        width="lg"
      >
        <form onSubmit={handleConfirmNewProvider} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Provider Engine</label>
            <select
              value={newProvider}
              onChange={(e) => handleProviderSelectChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none"
            >
              <option value="aigateway">Vercel AI Gateway (ai-gateway.vercel.sh)</option>
              <option value="openrouter">OpenRouter (Any LLM Model)</option>
              <option value="gemini">Google Gemini (Direct)</option>
              <option value="openai">OpenAI (Direct)</option>
              <option value="deepseek">DeepSeek (Direct)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Initial Model</label>
            <input
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="e.g. openai/gpt-4o-mini or deepseek/deepseek-chat"
              required
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(MODEL_PRESETS[newProvider] || []).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setNewModel(preset)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">API Key (Optional)</label>
            <input
              type="password"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="Leave blank to use platform environment variables"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[10px] text-zinc-400">Stored encrypted with AES-256-GCM.</p>
          </div>

          {newProvider === 'aigateway' && (
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Vercel AI Gateway Endpoint</label>
              <input
                type="text"
                value={newGatewayUrl}
                onChange={(e) => setNewGatewayUrl(e.target.value)}
                placeholder="https://ai-gateway.vercel.sh/v1"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none"
              />
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSetupSheetOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifyingNewProvider || !newModel.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
            >
              {verifyingNewProvider ? '⚡ Verifying Connection...' : '⚡ Test & Confirm Integration'}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};