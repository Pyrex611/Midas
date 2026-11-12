import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

interface TownCrierComposerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gongs?: any[];
}

export const TownCrierComposerDrawer: React.FC<TownCrierComposerDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  gongs = [],
}) => {
  const { toast } = useToast();
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [selectedGongId, setSelectedGongId] = useState('');
  const [templateStyle, setTemplateStyle] = useState<'card' | 'editorial' | 'minimal' | 'plain'>('card');
  const [broadcastTagFilter, setBroadcastTagFilter] = useState('');
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;

    setSavingBroadcast(true);
    try {
      await townCrierAPI.createBroadcast({
        subject: broadcastSubject.trim(),
        body: broadcastBody.trim(),
        gongId: selectedGongId || undefined,
        tagFilter: broadcastTagFilter.trim() || undefined,
        templateStyle,
      });
      toast.success('Broadcast created as Draft', 'Saved');
      setBroadcastSubject('');
      setBroadcastBody('');
      setSelectedGongId('');
      setBroadcastTagFilter('');
      setTemplateStyle('card');
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not create broadcast'), 'Error');
    } finally {
      setSavingBroadcast(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Broadcast Proclamation"
      description="Stage a newsletter broadcast. Strictly drained through the bounded ≤5/tick queue engine."
      width="xl"
    >
      <form onSubmit={handleCreateBroadcast} className="space-y-4 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Target Gong Channel</label>
          <select
            value={selectedGongId}
            onChange={(e) => setSelectedGongId(e.target.value)}
            className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none"
          >
            <option value="">-- All Active Audience Subscribers --</option>
            {gongs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.cadence?.toUpperCase() || 'WEEKLY'})
              </option>
            ))}
          </select>
        </div>

        {/* Visual Email Template Selector */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
            Email Layout Design (Card Enabled by Default)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['card', 'Card Envelope', 'Centered 580px rounded box'],
              ['editorial', 'Editorial', 'Substack/Beehiiv publication'],
              ['minimal', 'Clean Minimal', 'Accent line & header'],
              ['plain', 'Conversational', 'Raw HTML (max inbox placement)'],
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

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Broadcast Subject Line *</label>
          <input
            type="text"
            value={broadcastSubject}
            onChange={(e) => setBroadcastSubject(e.target.value)}
            placeholder="e.g. Issue #42: How We Scaled Neon Postgres to 10k QPS"
            required
            className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Subscriber Tag Filter (Optional)</label>
          <input
            type="text"
            value={broadcastTagFilter}
            onChange={(e) => setBroadcastTagFilter(e.target.value)}
            placeholder="e.g. vip, webflow (leave blank for all channel subscribers)"
            className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-[11px] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Newsletter Body (Mustache & Spintax Enabled)</label>
          <textarea
            rows={12}
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            placeholder="Write your proclamation content here..."
            required
            className="w-full p-3.5 border border-zinc-200 rounded-xl font-sans focus:outline-none focus:border-blue-500 text-xs leading-relaxed"
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-zinc-600 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={savingBroadcast}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors shadow-xs"
          >
            {savingBroadcast ? 'Saving Draft...' : 'Save Broadcast Draft'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};