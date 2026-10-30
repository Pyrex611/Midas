import React, { useState, useEffect } from 'react';
import { userSettingsAPI, aiAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

const MODEL_PRESETS: Record<string, string[]> = {
  aigateway: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3-5-sonnet',
    'meta-llama/llama-3.3-70b-instruct',
    'google/gemini-1.5-flash',
    'deepseek/deepseek-chat',
  ],
  openrouter: [
    'deepseek/deepseek-chat',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.3-70b-instruct',
    'google/gemini-2.0-flash-exp:free',
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

  // Delivery Throttling State
  const [sendLimit, setSendLimit] = useState(50);
  const [sendPeriod, setSendPeriod] = useState('day');

  // Legal & Postal Compliance State
  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [customOptOutText, setCustomOptOutText] = useState('');

  // AI Engine Studio State
  const [aiProvider, setAiProvider] = useState('aigateway');
  const [aiModel, setAiModel] = useState('openai/gpt-4o-mini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasAiApiKey, setHasAiApiKey] = useState(false);
  const [aiGatewayUrl, setAiGatewayUrl] = useState('https://ai-gateway.vercel.sh/v1');
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any | null>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userSettingsAPI.get()
      .then(res => {
        if (res.data) {
          setSendLimit(res.data.sendLimit ?? 50);
          setSendPeriod(res.data.sendPeriod ?? 'day');
          setCompanyName(res.data.companyName ?? '');
          setPhysicalAddress(res.data.physicalAddress ?? '');
          setCustomOptOutText(res.data.customOptOutText ?? '');
          setAiProvider(res.data.aiProvider || 'aigateway');
          setAiModel(res.data.aiModel || MODEL_PRESETS[res.data.aiProvider || 'aigateway']?.[0] || 'openai/gpt-4o-mini');
          setHasAiApiKey(Boolean(res.data.hasAiApiKey));

          // Auto-migrate legacy api.vercel.ai to canonical ai-gateway.vercel.sh
          let gateway = res.data.aiGatewayUrl || 'https://ai-gateway.vercel.sh/v1';
          if (gateway.includes('api.vercel.ai')) {
            gateway = gateway.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
          }
          setAiGatewayUrl(gateway);
        }
      })
      .catch(() => {
        toast.error('Failed to load workspace preferences', 'Error');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setAiProvider(newProvider);
    const presets = MODEL_PRESETS[newProvider] || [];
    setAiModel(presets[0] || '');
    setAiTestResult(null);
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setAiTestResult(null);

    let cleanGateway = aiGatewayUrl.trim();
    if (cleanGateway.includes('api.vercel.ai')) {
      cleanGateway = cleanGateway.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
      setAiGatewayUrl(cleanGateway);
    }

    try {
      const res = await aiAPI.testConfig({
        provider: aiProvider,
        model: aiModel,
        apiKey: aiApiKey.trim() || undefined,
        gatewayUrl: aiProvider === 'aigateway' ? cleanGateway : undefined,
      });
      setAiTestResult(res.data);
      if (res.data.status === 'HEALTHY') {
        toast.success(`Connected! Latency: ${res.data.latencyMs}ms`, 'AI Engine Operational');
      } else {
        toast.error(res.data.errorDetail || 'Provider rejected request', 'AI Test Failed');
      }
    } catch {
      toast.error('Could not connect to AI test service', 'Test Error');
    } finally {
      setTestingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let cleanGateway = aiGatewayUrl.trim();
    if (cleanGateway.includes('api.vercel.ai')) {
      cleanGateway = cleanGateway.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
      setAiGatewayUrl(cleanGateway);
    }

    try {
      await userSettingsAPI.update({
        sendLimit: Math.max(1, Number(sendLimit)),
        sendPeriod,
        companyName: companyName.trim() || null,
        physicalAddress: physicalAddress.trim() || null,
        customOptOutText: customOptOutText.trim() || null,
        aiProvider,
        aiModel: aiModel.trim() || null,
        aiApiKey: aiApiKey.trim() || undefined,
        aiGatewayUrl: aiProvider === 'aigateway' ? cleanGateway : null,
      });
      toast.success('Workspace settings and AI configuration updated', 'Preferences Saved');
      setAiApiKey('');
      setHasAiApiKey(hasAiApiKey || Boolean(aiApiKey.trim()));
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
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-8">
      {/* 1. AI Engine Studio */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">AI Engine Studio</h3>
              <span className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/60">
                Active: {aiProvider.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Switch active LLM providers, customize models, or route requests through Vercel AI Gateway.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestAI}
            disabled={testingAI}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>{testingAI ? 'Pinging Provider...' : '⚡ Test AI Connection'}</span>
          </button>
        </div>

        {/* Live Test Diagnostic Result Banner */}
        {aiTestResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-1 animate-in fade-in duration-150 ${
            aiTestResult.status === 'HEALTHY'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span>Status: {aiTestResult.status === 'HEALTHY' ? 'OPERATIONAL' : 'REJECTED'}</span>
              {aiTestResult.latencyMs && <span>{aiTestResult.latencyMs} ms latency</span>}
            </div>
            <p className="opacity-90">
              {aiTestResult.status === 'HEALTHY'
                ? `Success! Response sample: "${aiTestResult.responsePreview}"`
                : `Error: ${aiTestResult.errorDetail}`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Active AI Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
            >
              <option value="aigateway">Vercel AI Gateway (Unified)</option>
              <option value="openrouter">OpenRouter (Any Model)</option>
              <option value="gemini">Google Gemini (Direct)</option>
              <option value="openai">OpenAI (Direct)</option>
              <option value="deepseek">DeepSeek (Direct)</option>
              <option value="mock">Built-in Mock (Testing)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Model Identifier
            </label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="e.g. openai/gpt-4o-mini or deepseek/deepseek-chat"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(MODEL_PRESETS[aiProvider] || []).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setAiModel(preset)}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    aiModel === preset
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
              Custom API Key (Optional)
            </label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={hasAiApiKey ? '•••••••••••••••• (Key Configured)' : 'Leave blank to use platform env key'}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[10px] text-zinc-400">Stored encrypted with AES-256-GCM.</p>
          </div>

          {aiProvider === 'aigateway' && (
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Vercel AI Gateway Base URL
              </label>
              <input
                type="text"
                value={aiGatewayUrl}
                onChange={(e) => setAiGatewayUrl(e.target.value)}
                placeholder="https://ai-gateway.vercel.sh/v1"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                Official canonical endpoint is <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold text-zinc-700">https://ai-gateway.vercel.sh/v1</code>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Delivery Throttling */}
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

      {/* 3. CAN-SPAM Legal & Postal Compliance */}
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
          onClick={handleSubmit}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
        >
          {saving ? 'Updating Preferences...' : 'Save Workspace & AI Preferences'}
        </button>
      </div>
    </div>
  );
};