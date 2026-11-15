import React, { useEffect, useState, useRef } from 'react';
import { artifactAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

interface ArtifactItem {
  id: string;
  title: string;
  slug: string;
  type: 'LINK' | 'DOCUMENT' | 'IMAGE';
  url: string;
  sizeBytes?: number | null;
}

interface ArtifactsPanelProps {
  campaignId?: string;
  gongId?: string;
  canEdit?: boolean;
  compact?: boolean;
}

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({
  campaignId,
  gongId,
  canEdit = true,
  compact = false,
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'LINK' | 'UPLOAD'>('LINK');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchArtifacts = async () => {
    try {
      const res = await artifactAPI.list({ campaignId, gongId });
      setArtifacts(res.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, [campaignId, gongId]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !linkUrl.trim()) return;
    setSaving(true);
    try {
      await artifactAPI.createLink({
        title: title.trim(),
        slug: slug.trim() || undefined,
        url: linkUrl.trim(),
        type: 'LINK',
        campaignId: campaignId || null,
        gongId: gongId || null,
      });
      toast.success('Artifact link saved as tracked token', 'Artifact Added');
      setTitle('');
      setSlug('');
      setLinkUrl('');
      await fetchArtifacts();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save artifact link'), 'Error');
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
        campaignId: campaignId || null,
        gongId: gongId || null,
      });
      toast.success(`Hosted "${file.name}" as a tracked smart link`, 'Artifact Uploaded');
      setTitle('');
      setSlug('');
      await fetchArtifacts();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Upload failed (max 15MB)'), 'Upload Error');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyToken = (targetSlug: string) => {
    const token = `{{artifact:${targetSlug}}}`;
    navigator.clipboard.writeText(token);
    setCopiedSlug(targetSlug);
    toast.success(`Copied ${token} — paste into any subject or body`, 'Token Ready');
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
            <h4 className="text-sm font-black text-royal-950 tracking-tight">
              Campaign &amp; Broadcast Artifacts
            </h4>
          </div>
          <p className="text-[11px] text-thistle-500 mt-0.5">
            Attach pitch decks, images, or calendar links as <strong>cold-safe tracked tokens</strong> (zero binary spam attachment penalty).
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-thistle-100 text-royal-800 border border-gold-500/30 self-start">
          {artifacts.length} Hosted Asset(s)
        </span>
      </div>

      {canEdit && (
        <div className="p-3.5 bg-thistle-50/70 border border-gold-500/35 rounded-xl space-y-3 text-xs">
          <div className="flex p-1 bg-thistle-200/60 rounded-xl gap-1 max-w-[260px]">
            <button
              type="button"
              onClick={() => setMode('LINK')}
              className={`flex-1 py-1 font-bold rounded-lg transition-colors ${
                mode === 'LINK' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
              }`}
            >
              Add CTA Link
            </button>
            <button
              type="button"
              onClick={() => setMode('UPLOAD')}
              className={`flex-1 py-1 font-bold rounded-lg transition-colors ${
                mode === 'UPLOAD' ? 'bg-royal-700 text-white shadow-xs' : 'text-royal-800'
              }`}
            >
              Upload PDF / Image
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Q4 Pitch Deck)"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg text-xs focus:outline-none focus:border-gold-500"
            />
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
              placeholder="Token slug (e.g. pitch-deck)"
              className="px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono text-xs focus:outline-none focus:border-gold-500"
            />

            {mode === 'LINK' ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://cal.com/team/demo"
                  className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-gold-500/35 rounded-lg font-mono text-xs focus:outline-none focus:border-gold-500"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={saving || !title.trim() || !linkUrl.trim()}
                  className="px-3 py-1.5 btn-royal rounded-lg text-xs font-bold whitespace-nowrap"
                >
                  {saving ? '...' : 'Add'}
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="w-full px-3 py-1.5 btn-royal rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Icons.Upload className="text-gold-300" />
                  <span>{saving ? 'Uploading...' : 'Select File (≤15MB)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-thistle-500">Loading artifacts...</p>
      ) : artifacts.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-thistle-500 italic">
          No artifacts uploaded yet. Upload a PDF/Image or save a link to use {'{{artifact:slug}}'} tokens inside drafts.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {artifacts.map((a) => (
            <div
              key={a.id}
              className="p-3 bg-white border border-gold-500/35 rounded-xl flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-royal-950 truncate">{a.title}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                    a.type === 'IMAGE'
                      ? 'bg-amber-50 text-amber-800 border-gold-400/50'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {a.type === 'IMAGE' ? 'IMAGE (Best for Newsletters)' : 'COLD-SAFE LINK'}
                  </span>
                </div>
                <code className="text-[10px] font-mono text-royal-700 block mt-0.5 truncate">
                  {`{{artifact:${a.slug}}}`}
                </code>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToken(a.slug)}
                  className="px-2.5 py-1 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/35 text-royal-800 rounded-lg text-[10px] font-bold flex items-center gap-1"
                >
                  {copiedSlug === a.slug ? <Icons.CheckCircle className="text-emerald-600" /> : <Icons.Copy className="text-gold-600" />}
                  <span>{copiedSlug === a.slug ? 'Copied' : 'Token'}</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDeleteId(a.id)}
                    className="p-1 text-thistle-500 hover:text-rose-600"
                    title="Delete artifact"
                  >
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
        description="Any draft containing this {{artifact:...}} token will render an empty string once removed."
        confirmLabel="Delete Artifact"
        loading={deleting}
      />
    </div>
  );
};