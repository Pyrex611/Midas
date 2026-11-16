import React, { useEffect, useState, useRef } from 'react';
import { knowledgeAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Icons } from '../../lib/icons';

interface KnowledgeBasePanelProps {
  campaignId?: string;
  gongId?: string;
  broadcastId?: string;
  canEdit?: boolean;
}

export const KnowledgeBasePanel: React.FC<KnowledgeBasePanelProps> = ({
  campaignId,
  gongId,
  broadcastId,
  canEdit = true,
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [bases, setBases] = useState<any[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [newKbOpen, setNewKbOpen] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [creatingKb, setCreatingKb] = useState(false);

  const [resourceMode, setResourceMode] = useState<'URL' | 'FILE' | 'TEXT'>('URL');
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resContent, setResContent] = useState('');
  const [savingRes, setSavingRes] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'base' | 'resource'; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBases = async () => {
    try {
      const res = await knowledgeAPI.listBases();
      const list = res.data || [];
      setBases(list);
      if (list.length > 0 && (!selectedBaseId || !list.some((b: any) => b.id === selectedBaseId))) {
        setSelectedBaseId(list[0].id);
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load Knowledge Bases'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBases();
  }, []);

  const activeBase = bases.find((b) => b.id === selectedBaseId) || null;

  const handleCreateBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbName.trim()) return;
    setCreatingKb(true);
    try {
      const res = await knowledgeAPI.createBase({
        name: newKbName.trim(),
        description: newKbDesc.trim() || undefined,
        isDefault: bases.length === 0,
      });
      toast.success(`Knowledge Base "${res.data.name}" created`, 'Created');
      setNewKbName('');
      setNewKbDesc('');
      setNewKbOpen(false);
      await fetchBases();
      setSelectedBaseId(res.data.id);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not create Knowledge Base'), 'Plan Limit');
    } finally {
      setCreatingKb(false);
    }
  };

  const handleAttachToCurrentEntity = async (baseId: string) => {
    const targetType = campaignId ? 'campaign' : gongId ? 'gong' : broadcastId ? 'broadcast' : null;
    const targetId = campaignId || gongId || broadcastId;
    if (!targetType || !targetId) return;

    try {
      await knowledgeAPI.attachToEntity(targetType, targetId, baseId || null);
      toast.success(`Attached Knowledge Base to this ${targetType}`, 'Linked');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not attach Knowledge Base'), 'Error');
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBase) return;
    setSavingRes(true);
    try {
      if (resourceMode === 'URL') {
        await knowledgeAPI.scrapeUrlResource(activeBase.id, { url: resUrl.trim(), title: resTitle.trim() || undefined });
        toast.success('Website URL indexed into Knowledge Base', 'URL Indexed');
        setResUrl('');
        setResTitle('');
      } else {
        await knowledgeAPI.addTextResource(activeBase.id, { title: resTitle.trim(), content: resContent.trim() });
        toast.success('Playbook resource added', 'Saved');
        setResTitle('');
        setResContent('');
      }
      await fetchBases();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to add resource'), 'Error');
    } finally {
      setSavingRes(false);
    }
  };

  const handleUploadResourceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBase) return;
    setSavingRes(true);
    try {
      await knowledgeAPI.uploadFileResource(activeBase.id, file, resTitle.trim() || undefined);
      toast.success(`Parsed & indexed "${file.name}"`, 'Document Added');
      setResTitle('');
      await fetchBases();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not extract document'), 'Upload Error');
    } finally {
      setSavingRes(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleToggleResource = async (r: any) => {
    try {
      await knowledgeAPI.updateResource(r.id, { isActive: !r.isActive });
      await fetchBases();
    } catch {
      toast.error('Failed to update resource', 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'base') {
        await knowledgeAPI.deleteBase(deleteTarget.id);
        toast.info('Knowledge Base deleted', 'Deleted');
      } else {
        await knowledgeAPI.deleteResource(deleteTarget.id);
        toast.info('Resource deleted', 'Deleted');
      }
      setDeleteTarget(null);
      await fetchBases();
    } catch {
      toast.error('Deletion failed', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card-midas rounded-2xl p-6 space-y-5">
      <div className="pb-3 border-b border-gold-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icons.Book className="text-gold-600" />
            <h3 className="text-base font-black text-royal-950 tracking-tight">Knowledge Bases</h3>
          </div>
          <p className="text-xs text-thistle-500 mt-0.5">
            Group URLs, PDF/DOCX/MD files, and playbooks per company or service, then bind to Campaigns or Town Crier.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNewKbOpen((p) => !p)}
            className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <Icons.Plus className="text-gold-300" />
            <span>New Knowledge Base</span>
          </button>
        )}
      </div>

      {newKbOpen && (
        <form onSubmit={handleCreateBase} className="p-4 bg-thistle-50 border border-gold-500/40 rounded-xl space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="KB Name (e.g. Pyrexx Enterprise Offer)"
              className="px-3 py-2 bg-white border border-gold-500/35 rounded-lg font-semibold focus:outline-none focus:border-gold-500"
            />
            <input
              type="text"
              value={newKbDesc}
              onChange={(e) => setNewKbDesc(e.target.value)}
              placeholder="Optional description"
              className="px-3 py-2 bg-white border border-gold-500/35 rounded-lg focus:outline-none focus:border-gold-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewKbOpen(false)} className="px-3 py-1.5 font-bold text-thistle-500">Cancel</button>
            <button type="submit" disabled={creatingKb} className="px-4 py-1.5 btn-royal rounded-lg font-bold">
              {creatingKb ? 'Creating...' : 'Create Knowledge Base'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-xs text-thistle-500">Loading Knowledge Bases...</p>
      ) : bases.length === 0 ? (
        <p className="py-8 text-center text-xs text-thistle-500 bg-thistle-50 rounded-xl border border-gold-500/30">
          No Knowledge Bases created yet. Click "+ New Knowledge Base" to organize your company URLs and files.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {bases.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBaseId(b.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    selectedBaseId === b.id
                      ? 'bg-royal-700 text-white border-gold-400/60 shadow-xs'
                      : 'bg-white text-royal-800 border-gold-500/35 hover:bg-thistle-50'
                  }`}
                >
                  {b.name} ({b.resources?.length || 0})
                </button>
              ))}
            </div>

            {(campaignId || gongId || broadcastId) && activeBase && canEdit && (
              <button
                type="button"
                onClick={() => handleAttachToCurrentEntity(activeBase.id)}
                className="px-3 py-1.5 bg-thistle-100 hover:bg-thistle-200 border border-gold-500/40 text-royal-800 rounded-xl text-xs font-bold"
              >
                Bind "{activeBase.name}" Here
              </button>
            )}
          </div>

          {activeBase && (
            <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-royal-950">{activeBase.name}</h4>
                  {activeBase.description && <p className="text-[11px] text-thistle-500">{activeBase.description}</p>}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'base', id: activeBase.id, label: activeBase.name })}
                    className="text-rose-600 hover:underline font-bold text-[11px]"
                  >
                    Delete KB
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="p-3.5 bg-white border border-gold-500/35 rounded-xl space-y-3">
                  <div className="flex p-1 bg-thistle-100 rounded-lg gap-1 max-w-sm">
                    {(['URL', 'FILE', 'TEXT'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setResourceMode(m)}
                        className={`flex-1 py-1 font-bold rounded-md text-[11px] ${
                          resourceMode === m ? 'bg-royal-700 text-white' : 'text-royal-800'
                        }`}
                      >
                        {m === 'URL' ? 'Website URL' : m === 'FILE' ? 'PDF / DOCX / MD' : 'Text Note'}
                      </button>
                    ))}
                  </div>

                  {resourceMode === 'FILE' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                      <input
                        type="text"
                        value={resTitle}
                        onChange={(e) => setResTitle(e.target.value)}
                        placeholder="Optional Resource Title"
                        className="px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg"
                      />
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.docx,.md,.txt,.csv"
                          onChange={handleUploadResourceFile}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={savingRes}
                          className="w-full px-3 py-1.5 btn-royal rounded-lg font-bold flex items-center justify-center gap-1.5"
                        >
                          <Icons.Upload className="text-gold-300" />
                          <span>{savingRes ? 'Parsing...' : 'Upload PDF / DOCX / MD'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAddResource} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={resTitle}
                          onChange={(e) => setResTitle(e.target.value)}
                          placeholder={resourceMode === 'URL' ? 'Optional Title' : 'Resource Title *'}
                          required={resourceMode === 'TEXT'}
                          className="px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg"
                        />
                        {resourceMode === 'URL' && (
                          <input
                            type="url"
                            value={resUrl}
                            onChange={(e) => setResUrl(e.target.value)}
                            placeholder="https://company.com/docs *"
                            required
                            className="px-3 py-1.5 bg-thistle-50 border border-gold-500/35 rounded-lg font-mono"
                          />
                        )}
                      </div>
                      {resourceMode === 'TEXT' && (
                        <textarea
                          rows={3}
                          value={resContent}
                          onChange={(e) => setResContent(e.target.value)}
                          placeholder="Paste product positioning, pricing, or objection handling notes *"
                          required
                          className="w-full p-2.5 bg-thistle-50 border border-gold-500/35 rounded-lg"
                        />
                      )}
                      <div className="flex justify-end">
                        <button type="submit" disabled={savingRes} className="px-4 py-1.5 btn-royal rounded-lg font-bold">
                          {savingRes ? 'Indexing...' : resourceMode === 'URL' ? 'Scrape & Add URL' : 'Save Resource'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {(activeBase.resources || []).length === 0 ? (
                  <p className="text-center text-thistle-500 py-4 italic">No resources added to this Knowledge Base yet.</p>
                ) : (
                  activeBase.resources.map((r: any) => (
                    <div key={r.id} className="p-3 bg-white border border-gold-500/35 rounded-xl flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-royal-950">{r.title}</span>
                          <span className="px-1.5 py-0.2 rounded bg-thistle-100 text-royal-800 border border-gold-500/30 text-[10px] font-mono">
                            {r.sourceType}
                          </span>
                        </div>
                        <p className="text-[11px] text-royal-950/75 line-clamp-2">{r.content}</p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={() => handleToggleResource(r)} className="text-royal-700 font-bold hover:underline">
                            {r.isActive ? 'Mute' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'resource', id: r.id, label: r.title })}
                            className="text-thistle-500 hover:text-rose-600"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.type === 'base' ? 'Knowledge Base' : 'Resource'}`}
        description={`Are you sure you want to delete "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
};