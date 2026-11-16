import React, { useEffect, useState, useRef } from 'react';
import { artifactAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

interface ArtifactsPanelProps {
  campaignId?: string;
  gongId?: string;
  broadcastId?: string;
  canEdit?: boolean;
  compact?: boolean;
}

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({
  campaignId,
  gongId,
  broadcastId,
  canEdit = true,
  compact = false,
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'LINK' | 'UPLOAD'>('LINK');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [usagePrompt, setUsagePrompt] = useState('');
  const [attachmentMode, setAttachmentMode] = useState<'LINK' | 'MIME_ATTACHMENT'>('LINK');
  const [isOneTime, setIsOneTime] = useState(Boolean(broadcastId));
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchArtifacts = async () => {
    try {
      const res = await artifactAPI.list({ campaignId, gongId, broadcastId });
      setArtifacts(res.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, [campaignId, gongId, broadcastId]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !linkUrl.trim()) return;
    setSaving(true);
    try {
      await artifactAPI.createLink({
        title: title.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        usagePrompt: usagePrompt.trim() || undefined,
        url: linkUrl.trim(),
        type: 'LINK',
        attachmentMode: 'LINK',
        isOneTime,
        campaignId: campaignId || null,
        gongId: gongId || null,
        broadcastId: broadcastId || null,
      });
      toast.success('Artifact link saved', 'Artifact Added');
      setTitle(''); setSlug(''); setDescription(''); setUsagePrompt(''); setLinkUrl('');
      await fetchArtifacts();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save artifact link'), 'Plan Limit');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      await artifactAPI.uploadFile(file, {
        title: title.trim() || file.name,
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        usagePrompt: usagePrompt.trim() || undefined,
        attachmentMode,
        isOneTime,
        campaignId: campaignId || null,
        gongId: gongId || null,
        broadcastId: broadcastId || null,
      });
      toast.success(
        attachmentMode === 'MIME_ATTACHMENT'
          ? `Attached "${file.name}" for direct MIME delivery`
          : `Hosted "${file.name}" as tracked smart link`,
        'Artifact Uploaded'
      );
      setTitle(''); setSlug(''); setDescription(''); setUsagePrompt('');
      await fetchArtifacts();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Upload failed'), 'Plan Limit');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyToken = (targetSlug: string) => {
    const token = `{{artifact:${targetSlug}}}`;
    navigator.clipboard.writeText(token);
    setCopiedSlug(targetSlug);
    toast.success(`Copied ${token}`, 'Token Ready');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await artifactAPI.delete(deleteId);
      toast.info('Artifact deleted', 'Deleted');
      setDeleteId(null);
      await fetchArtifacts();
    } catch {
      toast.error('Could not delete artifact', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`${compact ? 'p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl' : 'p-6 card-midas rounded-2xl'} space-y-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gold-500/35">
        <div>
          <div className="flex items-center gap-2">
            <Icons.Link className="text-gold-600" />
            <h4 className="text-sm font-black text-royal-950 tracking-tight">Artifacts &amp; AI Attachments</h4>
          </div>
          <p className="text-[11px] text-thistle-500 mt-0.5">
            Define assets with usage rules so MIDAS AI knows when to insert smart links or send one-time broadcast file attachments.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-thistle-100 text-royal-800 border border-gold-500/30 self-start">
          {artifacts.length} Asset(s)
        </span>
      </div>

      {canEdit && (
        <div className="p-3.5 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex p-1 bg-thistle-200/60 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => { setMode('LINK'); setAttachmentMode('LINK'); }}
                className={`px-3 py-1 font-bold rounded-lg ${mode === 'LINK' ? 'bg-royal-700 text-white' : 'text-royal-800'}`}
              >
                Smart Link
              </button>
              <button
                type="button"
                onClick={() => setMode('UPLOAD')}
                className={`px-3 py-1 font-bold rounded-lg ${mode === 'UPLOAD' ? 'bg-royal-700 text-white' : 'text-royal-800'}`}
              >
                Upload File
              </button>
            </div>

            {mode === 'UPLOAD' && (
              <div className="flex items-center gap-3">
                <select
                  value={attachmentMode}
                  onChange={(e) => setAttachmentMode(e.target.value as any)}
                  className="px-2.5 py-1 bg-white border border-gold-500/35 rounded-lg text-[11px] font-bold text-royal-800"
                >
                  <option value="LINK">Tracked Link (Cold-Safe)</option>
                  <option value="MIME_ATTACHMENT">Direct Email File Attachment (Broadcasts/Gongs)</option>
                </select>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-royal-950 cursor-pointer">
                  <input type="checkbox" checked={isOneTime} onChange={(e) => setIsOneTime(e.target.checked)} className="rounded text-royal-700" />
                  <span>One-Time Delivery</span>
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title * (e.g. Case Study PDF)"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg"
            />
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
              placeholder="Slug (e.g. case-study)"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this asset"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg"
            />
            <input
              type="text"
              value={usagePrompt}
              onChange={(e) => setUsagePrompt(e.target.value)}
              placeholder="AI Usage Prompt (e.g. Attach when prospect asks for pricing)"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg"
            />
          </div>

          {mode === 'LINK' ? (
            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://cal.com/team/demo"
                className="flex-1 px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={handleAddLink}
                disabled={saving || !title.trim() || !linkUrl.trim()}
                className="px-4 py-1.5 btn-royal rounded-lg font-bold"
              >
                {saving ? '...' : 'Save Link'}
              </button>
            </div>
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                className="w-full px-3 py-2 btn-royal rounded-lg font-bold flex items-center justify-center gap-1.5"
              >
                <Icons.Upload className="text-gold-300" />
                <span>{saving ? 'Uploading...' : 'Select & Attach File'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-thistle-500">Loading artifacts...</p>
      ) : artifacts.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-thistle-500 italic">No artifacts configured yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {artifacts.map((a) => (
            <div key={a.id} className="p-3 bg-white border border-gold-500/35 rounded-xl flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-royal-950 truncate">{a.title}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                    a.attachmentMode === 'MIME_ATTACHMENT'
                      ? 'bg-royal-700 text-gold-300 border-gold-400/50'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {a.attachmentMode === 'MIME_ATTACHMENT' ? 'MIME FILE' : 'SMART LINK'}
                  </span>
                  {a.isOneTime && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-gold-400/50">
                      1-TIME
                    </span>
                  )}
                </div>
                <code className="text-[10px] font-mono text-royal-700 block truncate">{`{{artifact:${a.slug}}}`}</code>
                {a.usagePrompt && <p className="text-[10px] text-thistle-500 line-clamp-1">AI Rule: {a.usagePrompt}</p>}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToken(a.slug)}
                  className="px-2 py-1 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 rounded-lg text-[10px] font-bold flex items-center gap-1"
                >
                  {copiedSlug === a.slug ? <Icons.CheckCircle className="text-emerald-600" /> : <Icons.Copy className="text-gold-600" />}
                  <span>Token</span>
                </button>
                {canEdit && (
                  <button type="button" onClick={() => setDeleteId(a.id)} className="p-1 text-thistle-500 hover:text-rose-600">
                    <Icons.Trash />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Artifact"
        description="Remove this artifact from drafts and future dispatches?"
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
};