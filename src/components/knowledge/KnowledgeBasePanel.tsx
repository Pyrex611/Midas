import React, { useEffect, useState } from 'react';
import { knowledgeAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

interface KnowledgeItem {
  id: string;
  campaignId: string | null;
  title: string;
  sourceType: 'TEXT' | 'URL' | 'DOCUMENT';
  sourceUrl: string | null;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface KnowledgeBasePanelProps {
  campaignId?: string;
  canEdit?: boolean;
}

export const KnowledgeBasePanel: React.FC<KnowledgeBasePanelProps> = ({
  campaignId,
  canEdit = true,
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'TEXT' | 'URL'>('URL');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await knowledgeAPI.list(campaignId);
      setItems(res.data || []);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load knowledge base'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [campaignId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'URL') {
        await knowledgeAPI.scrapeUrl({
          url: scrapeUrl.trim(),
          title: title.trim() || undefined,
          campaignId: campaignId || null,
        });
        toast.success('Website extracted and added to Knowledge Base', 'URL Indexed');
        setScrapeUrl('');
        setTitle('');
      } else {
        await knowledgeAPI.create({
          title: title.trim(),
          content: content.trim(),
          sourceType: 'TEXT',
          campaignId: campaignId || null,
        });
        toast.success('Knowledge entry saved', 'Added');
        setTitle('');
        setContent('');
      }
      await fetchItems();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not add knowledge entry'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: KnowledgeItem) => {
    try {
      await knowledgeAPI.update(item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i)));
      toast.info(
        `"${item.title}" ${!item.isActive ? 'enabled' : 'muted'} for AI drafting`,
        'Updated'
      );
    } catch {
      toast.error('Failed to update entry', 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await knowledgeAPI.delete(deleteId);
      toast.info('Knowledge entry removed', 'Deleted');
      setDeleteId(null);
      await fetchItems();
    } catch {
      toast.error('Could not delete entry', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card-midas rounded-2xl p-6 space-y-5">
      <div className="pb-3 border-b border-gold-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Icons.Book className="text-gold-600" />
            <h3 className="text-base font-black text-royal-950 tracking-tight">
              {campaignId ? 'Campaign Knowledge Context' : 'Company Knowledge Base'}
            </h3>
          </div>
          <p className="text-xs text-thistle-500 mt-0.5">
            Automatically grounded into AI copywriting and objection-handling replies so claims match your real services.
          </p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-thistle-100 text-royal-800 border border-gold-500/35 self-start sm:self-center">
          {items.filter((i) => i.isActive).length} Active Source(s)
        </span>
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-3 text-xs">
          <div className="flex p-1 bg-thistle-200/60 rounded-xl gap-1 max-w-xs">
            <button
              type="button"
              onClick={() => setMode('URL')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-colors ${
                mode === 'URL' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
              }`}
            >
              Auto-Scrape URL
            </button>
            <button
              type="button"
              onClick={() => setMode('TEXT')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-colors ${
                mode === 'TEXT' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
              }`}
            >
              Paste Playbook
            </button>
          </div>

          {mode === 'URL' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Public Website / Pricing / Docs URL *</label>
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="https://yourcompany.com/services"
                  required
                  className="w-full px-3 py-2 bg-white border border-gold-500/40 rounded-xl font-mono focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Label (Optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Core Services"
                  className="w-full px-3 py-2 bg-white border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Entry Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pricing Tiers & Objection Playbook"
                  required
                  className="w-full px-3 py-2 bg-white border border-gold-500/40 rounded-xl font-semibold focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Facts, Case Studies &amp; Positioning *</label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe your product capabilities, pricing anchors, typical ROI, and how you differentiate from competitors..."
                  required
                  className="w-full p-3 bg-white border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 btn-royal rounded-xl font-bold flex items-center gap-1.5"
            >
              <Icons.Bolt className="text-gold-300" />
              <span>{submitting ? (mode === 'URL' ? 'Extracting Website...' : 'Saving...') : (mode === 'URL' ? 'Extract & Index URL' : 'Save Knowledge')}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-xs text-thistle-500">Loading knowledge entries...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-xs text-thistle-500 bg-thistle-50 rounded-xl border border-gold-500/30">
          No company knowledge indexed yet. Add your website URL or product playbook above to ground AI outreach.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border text-xs space-y-1.5 transition-all ${
                item.isActive
                  ? 'bg-white border-gold-500/40'
                  : 'bg-thistle-50/50 border-gold-500/20 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-royal-950">{item.title}</span>
                  <span className="px-2 py-0.5 rounded bg-thistle-100 text-royal-800 border border-gold-500/30 text-[10px] font-mono">
                    {item.sourceType}
                  </span>
                  {!item.campaignId && campaignId && (
                    <span className="px-2 py-0.5 rounded bg-gold-200/60 text-royal-950 text-[10px] font-bold">
                      Workspace Global
                    </span>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className="text-royal-700 hover:underline font-bold"
                    >
                      {item.isActive ? 'Mute' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="text-thistle-500 hover:text-rose-600"
                      title="Delete entry"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                )}
              </div>

              {item.sourceUrl && (
                <p className="text-[11px] font-mono text-royal-700 truncate">{item.sourceUrl}</p>
              )}
              <p className="text-royal-950/75 line-clamp-3 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Knowledge Entry"
        description="This company context will no longer be injected into future AI drafts or replies."
        confirmLabel="Delete Entry"
        loading={deleting}
      />
    </div>
  );
};