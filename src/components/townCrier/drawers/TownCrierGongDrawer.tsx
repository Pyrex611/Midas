import React, { useState, useEffect } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, senderAPI, domainAPI, getErrorMessage } from '../../../services/api';
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

  // Welcome Autoresponder
  const [welcomeEmailEnabled, setWelcomeEmailEnabled] = useState(false);
  const [welcomeSubject, setWelcomeSubject] = useState('');
  const [welcomeBody, setWelcomeBody] = useState('');

  // Clerk-Style Embed Preferences
  const [embedTheme, setEmbedTheme] = useState<'minimal' | 'card' | 'dark' | 'floating'>('card');
  const [accentColor, setAccentColor] = useState('#2563EB');
  const [headline, setHeadline] = useState('Join our newsletter');
  const [subheadline, setSubheadline] = useState('Get the latest updates delivered directly to your inbox.');
  const [buttonText, setButtonText] = useState('Subscribe');

  // Dedicated Sender Mailbox Selection & In-Place Creation
  const [activeSenders, setActiveSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [verifiedDomains, setVerifiedDomains] = useState<any[]>([]);

  // In-place sender creation form toggle
  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);
  const [newMailboxDomainId, setNewMailboxDomainId] = useState('');
  const [newMailboxLocalPart, setNewMailboxLocalPart] = useState('community');
  const [newMailboxDisplayName, setNewMailboxDisplayName] = useState('');
  const [provisioningSender, setProvisioningSender] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadSendersAndDomains = async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        senderAPI.listAll(),
        domainAPI.getAll(),
      ]);
      const validSenders = (sRes.data || []).filter((s: any) => s.status === 'active' && s.domain?.status === 'active');
      const validDomains = (dRes.data || []).filter((d: any) => d.status === 'active' && d.sendTestPassedAt);
      setActiveSenders(validSenders);
      setVerifiedDomains(validDomains);
      if (validDomains.length > 0 && !newMailboxDomainId) {
        setNewMailboxDomainId(validDomains[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadSendersAndDomains();
      if (editingGong) {
        setName(editingGong.name || '');
        setSlug(editingGong.slug || '');
        setDescription(editingGong.description || '');
        setCadence(editingGong.cadence || 'weekly');
        setTemplateStyle(editingGong.templateStyle || 'card');
        setWelcomeEmailEnabled(Boolean(editingGong.welcomeEmailEnabled));
        setWelcomeSubject(editingGong.welcomeSubject || '');
        setWelcomeBody(editingGong.welcomeBody || '');
        setEmbedTheme(editingGong.embedTheme || 'card');
        setAccentColor(editingGong.accentColor || '#2563EB');
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
        setWelcomeEmailEnabled(false);
        setWelcomeSubject('');
        setWelcomeBody('');
        setEmbedTheme('card');
        setAccentColor('#2563EB');
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
      await loadSendersAndDomains();
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
        welcomeEmailEnabled,
        welcomeSubject: welcomeSubject.trim() || undefined,
        welcomeBody: welcomeBody.trim() || undefined,
        embedTheme,
        accentColor,
        headline: headline.trim(),
        subheadline: subheadline.trim(),
        buttonText: buttonText.trim(),
        dedicatedSenderId: selectedSenderId || undefined,
      };

      const res = await townCrierAPI.createGong(payload);
      toast.success(`Gong channel "${name.trim()}" saved`, 'Gong Active');
      onClose();
      onSuccess(res.data?.gong || payload);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save Gong channel'), 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingGong ? `Edit Gong: ${editingGong.name}` : 'Create New Gong Channel'}
      description="Gongs are dedicated newsletter publications with independent welcome lead magnets, embed styles, and isolated senders."
      width="xl"
    >
      <form onSubmit={handleSaveGong} className="space-y-6 text-xs">
        {/* Core Metadata */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Gong Channel Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
              }}
              placeholder="e.g. Pyrexx AI Weekly Briefing"
              required
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Public URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                placeholder="weekly-briefing"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-zinc-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Publication Cadence</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none"
              >
                <option value="daily">Daily Proclamation</option>
                <option value="weekly">Weekly Digest</option>
                <option value="biweekly">Bi-Weekly Roundup</option>
                <option value="monthly">Monthly Deep Dive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Email Template Layout */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
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
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs font-bold'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                <p className="text-xs">{label}</p>
                <p className="text-[10px] text-zinc-400 font-normal mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* In-Place Dedicated Mailbox Selector & Creator */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Dedicated Sending Mailbox</span>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Isolates this newsletter's sending reputation from your cold prospecting mailboxes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingMailbox((prev) => !prev)}
              className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
            >
              {isCreatingMailbox ? 'Cancel Mailbox Form' : '+ Create Mailbox in Place'}
            </button>
          </div>

          {!isCreatingMailbox ? (
            <div>
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl font-mono text-xs font-bold text-zinc-800 focus:outline-none"
              >
                <option value="">-- Use Default Newsletter Sender (or 50% Fair-Share Pool) --</option>
                {activeSenders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.localPart}@{s.domain?.domainName} ({s.displayName || 'No Name'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-3 animate-in fade-in duration-100">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Quick-Provision New Mailbox</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-0.5">Target Domain</label>
                  <select
                    value={newMailboxDomainId}
                    onChange={(e) => setNewMailboxDomainId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-[11px]"
                  >
                    {verifiedDomains.map((d) => (
                      <option key={d.id} value={d.id}>{d.domainName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-0.5">Local Address</label>
                  <input
                    type="text"
                    value={newMailboxLocalPart}
                    onChange={(e) => setNewMailboxLocalPart(e.target.value)}
                    placeholder="community"
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-[11px] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-0.5">Sender Display Name (Optional)</label>
                <input
                  type="text"
                  value={newMailboxDisplayName}
                  onChange={(e) => setNewMailboxDisplayName(e.target.value)}
                  placeholder="e.g. Pyrexx Community"
                  className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleInPlaceCreateSender}
                  disabled={provisioningSender || !newMailboxDomainId}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {provisioningSender ? 'Provisioning...' : 'Provision & Attach'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Welcome Email Autoresponder */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Preset Welcome Autoresponder</span>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Automatically dispatches an onboarding email, lead magnet, or discount code within 60s of subscribing.
              </p>
            </div>
            <input
              type="checkbox"
              checked={welcomeEmailEnabled}
              onChange={(e) => setWelcomeEmailEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0"
            />
          </div>

          {welcomeEmailEnabled && (
            <div className="space-y-3 pt-2 border-t border-zinc-200/60 animate-in fade-in duration-100">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Welcome Email Subject</label>
                <input
                  type="text"
                  value={welcomeSubject}
                  onChange={(e) => setWelcomeSubject(e.target.value)}
                  placeholder="Welcome to the Inner Circle! Here is your download link"
                  required={welcomeEmailEnabled}
                  className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Welcome Email Body (Supports Mustache & Spintax)</label>
                <textarea
                  rows={6}
                  value={welcomeBody}
                  onChange={(e) => setWelcomeBody(e.target.value)}
                  placeholder="Hi {{name}},\n\nThank you for subscribing! Access your guide here..."
                  required={welcomeEmailEnabled}
                  className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Clerk-Style Embed Form Styling */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clerk-Style Embed Appearance</span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Default Embed Theme</label>
              <select
                value={embedTheme}
                onChange={(e) => setEmbedTheme(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none"
              >
                <option value="minimal">Minimal (Inline Row)</option>
                <option value="card">Card (Elevated Container)</option>
                <option value="dark">Dark (Carbon Contrast)</option>
                <option value="floating">Floating (Expanding Popover)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Brand Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 p-0.5 border border-zinc-200 rounded-lg cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Form Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Button Label</label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 font-bold hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors shadow-xs"
          >
            {saving ? 'Saving Gong...' : 'Save Gong Channel'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};