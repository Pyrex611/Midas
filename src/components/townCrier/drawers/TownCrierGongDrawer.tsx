import React, { useState, useEffect } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, senderAPI, domainAPI, knowledgeAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface TownCrierGongDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedGong: any) => void;
  editingGong?: any | null;
}

export const TownCrierGongDrawer: React.FC<TownCrierGongDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingGong,
}) => {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [templateStyle, setTemplateStyle] = useState<'card' | 'editorial' | 'minimal' | 'plain'>('card');

  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [selectedKbId, setSelectedKbId] = useState('');

  const [welcomeEmailEnabled, setWelcomeEmailEnabled] = useState(false);
  const [welcomeSubject, setWelcomeSubject] = useState('');
  const [welcomeBody, setWelcomeBody] = useState('');

  const [embedTheme, setEmbedTheme] = useState<'minimal' | 'card' | 'dark' | 'floating'>('card');
  const [accentColor, setAccentColor] = useState('#4A2559');
  const [headline, setHeadline] = useState('Join our newsletter');
  const [subheadline, setSubheadline] = useState('Get the latest updates delivered directly to your inbox.');
  const [buttonText, setButtonText] = useState('Subscribe');

  const [activeSenders, setActiveSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [verifiedDomains, setVerifiedDomains] = useState<any[]>([]);

  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);
  const [newMailboxDomainId, setNewMailboxDomainId] = useState('');
  const [newMailboxLocalPart, setNewMailboxLocalPart] = useState('community');
  const [newMailboxDisplayName, setNewMailboxDisplayName] = useState('');
  const [provisioningSender, setProvisioningSender] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadDrawerMetadata = async () => {
    try {
      const [sRes, dRes, kbRes] = await Promise.all([
        senderAPI.listAll(),
        domainAPI.getAll(),
        knowledgeAPI.listBases().catch(() => ({ data: [] })),
      ]);
      const validSenders = (sRes.data || []).filter((s: any) => s.status === 'active' && s.domain?.status === 'active');
      const validDomains = (dRes.data || []).filter((d: any) => d.status === 'active' && d.sendTestPassedAt);
      setActiveSenders(validSenders);
      setVerifiedDomains(validDomains);
      setKnowledgeBases(kbRes.data || []);
      if (validDomains.length > 0 && !newMailboxDomainId) {
        setNewMailboxDomainId(validDomains[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadDrawerMetadata();
      if (editingGong) {
        setName(editingGong.name || '');
        setSlug(editingGong.slug || '');
        setDescription(editingGong.description || '');
        setCadence(editingGong.cadence || 'weekly');
        setTemplateStyle(editingGong.templateStyle || 'card');
        setSelectedKbId(editingGong.knowledgeBaseId || '');
        setWelcomeEmailEnabled(Boolean(editingGong.welcomeEmailEnabled));
        setWelcomeSubject(editingGong.welcomeSubject || '');
        setWelcomeBody(editingGong.welcomeBody || '');
        setEmbedTheme(editingGong.embedTheme || 'card');
        setAccentColor(editingGong.accentColor || '#4A2559');
        setHeadline(editingGong.headline || 'Join our newsletter');
        setSubheadline(editingGong.subheadline || 'Get the latest updates delivered directly to your inbox.');
        setButtonText(editingGong.buttonText || 'Subscribe');
        setSelectedSenderId(editingGong.dedicatedSenderId || '');
      } else {
        setName('');
        setSlug('');
        setDescription('');
        setCadence('weekly');
        setTemplateStyle('card');
        setSelectedKbId('');
        setWelcomeEmailEnabled(false);
        setWelcomeSubject('');
        setWelcomeBody('');
        setEmbedTheme('card');
        setAccentColor('#4A2559');
        setHeadline('Join our newsletter');
        setSubheadline('Get the latest updates delivered directly to your inbox.');
        setButtonText('Subscribe');
        setSelectedSenderId('');
      }
    }
  }, [isOpen, editingGong]);

  const handleInPlaceCreateSender = async () => {
    if (!newMailboxDomainId || !newMailboxLocalPart.trim()) {
      return toast.warning('Select a domain and enter an address (e.g. community)', 'Validation');
    }

    setProvisioningSender(true);
    try {
      const res = await senderAPI.create(
        newMailboxDomainId,
        newMailboxLocalPart.trim(),
        newMailboxDisplayName.trim() || undefined
      );
      toast.success(`Provisioned mailbox ${res.data.localPart}@${res.data.domain.domainName}`, 'Mailbox Ready');
      await loadDrawerMetadata();
      setSelectedSenderId(res.data.id);
      setIsCreatingMailbox(false);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not create mailbox'), 'Error');
    } finally {
      setProvisioningSender(false);
    }
  };

  const handleSaveGong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: (slug || name).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-'),
        description: description.trim() || undefined,
        cadence,
        templateStyle,
        knowledgeBaseId: selectedKbId || null,
        welcomeEmailEnabled,
        welcomeSubject: welcomeSubject.trim() || undefined,
        welcomeBody: welcomeBody.trim() || undefined,
        embedTheme,
        accentColor,
        headline: headline.trim(),
        subheadline: subheadline.trim(),
        buttonText: buttonText.trim(),
        dedicatedSenderId: selectedSenderId || null,
      };

      const res = editingGong?.id
        ? await townCrierAPI.updateGong(editingGong.id, payload)
        : await townCrierAPI.createGong(payload);
      toast.success(`Newsletter Channel "${name.trim()}" saved`, 'Channel Active');
      onClose();
      onSuccess(res.data?.gong || payload);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save Newsletter Channel'), 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingGong ? `Edit Newsletter Channel: ${editingGong.name}` : 'Create Newsletter Channel (Gong)'}
      description="Isolated subscriber channels with built-in signup forms, Knowledge Base grounding, welcome autoresponders, and dedicated senders."
      width="xl"
    >
      <form onSubmit={handleSaveGong} className="space-y-6 text-xs">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Channel Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingGong && !slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
              }}
              placeholder="e.g. Pyrexx AI Weekly Briefing"
              required
              className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-bold text-royal-950 focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Public Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                placeholder="weekly-briefing"
                className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-mono text-royal-950 focus:outline-none focus:border-gold-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Publication Cadence</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as any)}
                className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-bold text-royal-950 focus:outline-none"
              >
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Digest</option>
                <option value="biweekly">Bi-Weekly Roundup</option>
                <option value="monthly">Monthly Deep Dive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Attached Knowledge Base (Optional)</label>
            <select
              value={selectedKbId}
              onChange={(e) => setSelectedKbId(e.target.value)}
              className="w-full px-3 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-semibold text-royal-950 focus:outline-none"
            >
              <option value="">-- Workspace Default Knowledge Base --</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name} ({kb.resources?.length || 0} resources)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-thistle-500">
            Default Newsletter Layout (Card Enabled by Default)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['card', 'Card Envelope', 'Centered 580px box'],
              ['editorial', 'Editorial', 'Substack/Beehiiv style'],
              ['minimal', 'Clean Minimal', 'Accent line & header'],
              ['plain', 'Conversational', 'Raw HTML format'],
            ].map(([id, label, desc]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplateStyle(id as any)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  templateStyle === id
                    ? 'border-gold-500 bg-thistle-100 text-royal-950 shadow-2xs font-bold'
                    : 'border-gold-500/30 bg-white hover:bg-thistle-50 text-royal-800'
                }`}
              >
                <p className="text-xs">{label}</p>
                <p className="text-[10px] text-thistle-500 font-normal mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-royal-700">Dedicated Sending Mailbox</span>
              <p className="text-[11px] text-thistle-500 mt-0.5">
                Isolates this newsletter&apos;s reputation from your cold prospecting mailboxes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingMailbox((prev) => !prev)}
              className="px-2.5 py-1 bg-white hover:bg-thistle-100 text-royal-800 border border-gold-500/40 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
            >
              {isCreatingMailbox ? 'Cancel Mailbox Form' : '+ Create Mailbox in Place'}
            </button>
          </div>

          {!isCreatingMailbox ? (
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gold-500/40 rounded-xl font-mono text-xs font-bold text-royal-950 focus:outline-none"
            >
              <option value="">-- Use Default Newsletter Sender (or 50% Fair-Share Pool) --</option>
              {activeSenders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.localPart}@{s.domain?.domainName} ({s.displayName || 'No Name'})
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-white border border-gold-500/45 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-thistle-500 mb-0.5">Target Domain</label>
                  <select
                    value={newMailboxDomainId}
                    onChange={(e) => setNewMailboxDomainId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg font-mono text-[11px]"
                  >
                    {verifiedDomains.map((d) => (
                      <option key={d.id} value={d.id}>{d.domainName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-thistle-500 mb-0.5">Local Address</label>
                  <input
                    type="text"
                    value={newMailboxLocalPart}
                    onChange={(e) => setNewMailboxLocalPart(e.target.value)}
                    placeholder="community"
                    className="w-full px-2 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg font-mono text-[11px] font-bold"
                  />
                </div>
              </div>
              <input
                type="text"
                value={newMailboxDisplayName}
                onChange={(e) => setNewMailboxDisplayName(e.target.value)}
                placeholder="Display Name (e.g. Pyrexx Community)"
                className="w-full px-2 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg text-[11px]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleInPlaceCreateSender}
                  disabled={provisioningSender || !newMailboxDomainId}
                  className="px-3 py-1.5 btn-royal rounded-lg text-[11px] font-bold"
                >
                  {provisioningSender ? 'Provisioning...' : 'Provision & Attach'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-royal-700">Preset Welcome Autoresponder</span>
              <p className="text-[11px] text-thistle-500 mt-0.5">
                Automatically sends an onboarding email or lead magnet within 60s of subscribing.
              </p>
            </div>
            <input
              type="checkbox"
              checked={welcomeEmailEnabled}
              onChange={(e) => setWelcomeEmailEnabled(e.target.checked)}
              aria-label="Enable preset welcome autoresponder"
              className="h-4 w-4 rounded border-thistle-400 text-royal-700"
            />
          </div>

          {welcomeEmailEnabled && (
            <div className="space-y-3 pt-2 border-t border-gold-500/30">
              <input
                type="text"
                value={welcomeSubject}
                onChange={(e) => setWelcomeSubject(e.target.value)}
                placeholder="Welcome Subject Line"
                required={welcomeEmailEnabled}
                className="w-full px-3 py-1.5 bg-white border border-gold-500/35 rounded-xl text-xs font-semibold"
              />
              <textarea
                rows={5}
                value={welcomeBody}
                onChange={(e) => setWelcomeBody(e.target.value)}
                placeholder="Hi {{name}}, Welcome! Access your guide here: {{artifact:welcome-guide}}"
                required={welcomeEmailEnabled}
                className="w-full p-3 bg-white border border-gold-500/35 rounded-xl text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">Embed Appearance</span>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={embedTheme}
              onChange={(e) => setEmbedTheme(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-xl font-bold text-royal-950"
            >
              <option value="minimal">Minimal (Inline Row)</option>
              <option value="card">Card (Elevated Container)</option>
              <option value="dark">Dark (Carbon Contrast)</option>
              <option value="floating">Floating (Expanding Popover)</option>
            </select>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                aria-label="Brand accent color picker"
                className="w-8 h-8 p-0.5 border border-gold-500/35 rounded-lg cursor-pointer bg-white"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-gold-500/35 rounded-xl font-mono text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Form Headline"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-xl text-xs"
            />
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Button Label"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-xl text-xs font-bold"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gold-500/35 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-thistle-500 font-bold hover:text-royal-950">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 btn-royal font-bold rounded-xl">
            {saving ? 'Saving...' : 'Save Newsletter Channel'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};