import React, { useState } from 'react';
import { Sheet } from '../../common/Sheet';
import { townCrierAPI, getErrorMessage } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { ArtifactsPanel } from '../../artifacts/ArtifactsPanel';

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
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Target Gong Channel</label>
          <select
            value={selectedGongId}
            onChange={(e) => setSelectedGongId(e.target.value)}
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-bold text-royal-950 focus:outline-none focus:border-gold-500"
          >
            <option value="">-- All Active Audience Subscribers --</option>
            {gongs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (/{g.slug} · {g.cadence?.toUpperCase() || 'WEEKLY'})
              </option>
            ))}
          </select>
        </div>

        <ArtifactsPanel gongId={selectedGongId || undefined} compact />

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">
            Email Layout Design (Card Enabled by Default)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['card', 'Card Envelope', 'Centered 580px rounded box'],
              ['editorial', 'Editorial', 'Substack/Beehiiv publication'],
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
                    : 'border-gold-500/35 bg-white hover:bg-thistle-50 text-royal-800'
                }`}
              >
                <p className="text-xs">{label}</p>
                <p className="text-[10px] text-thistle-500 font-normal mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Broadcast Subject Line *</label>
          <input
            type="text"
            value={broadcastSubject}
            onChange={(e) => setBroadcastSubject(e.target.value)}
            placeholder="e.g. Issue #42: How We Scaled Neon Postgres to 10k QPS"
            required
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-medium focus:outline-none focus:border-gold-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Subscriber Tag Filter (Optional)</label>
          <input
            type="text"
            value={broadcastTagFilter}
            onChange={(e) => setBroadcastTagFilter(e.target.value)}
            placeholder="e.g. vip, webflow (leave blank for all channel subscribers)"
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-mono text-[11px] focus:outline-none focus:border-gold-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-thistle-500 uppercase mb-1">Newsletter Body (Mustache, Spintax &amp; {'{{artifact:slug}}'} Enabled)</label>
          <textarea
            rows={10}
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            placeholder="Write your proclamation content here..."
            required
            className="w-full p-3.5 bg-thistle-50 border border-gold-500/40 rounded-xl font-sans focus:outline-none focus:border-gold-500 text-xs leading-relaxed"
          />
        </div>

        <div className="pt-3 border-t border-gold-500/35 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-thistle-500 hover:text-royal-950"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={savingBroadcast}
            className="px-5 py-2 btn-royal font-bold rounded-xl"
          >
            {savingBroadcast ? 'Saving Draft...' : 'Save Broadcast Draft'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};