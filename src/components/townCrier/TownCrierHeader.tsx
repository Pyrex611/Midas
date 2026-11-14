import React, { useRef, useState, useEffect } from 'react';
import { townCrierAPI, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface TownCrierHeaderProps {
  activeTab: 'broadcasts' | 'gongs' | 'audience';
  onOpenComposer: () => void;
  onOpenAddRecipient: () => void;
  onOpenCreateGong: () => void;
  onOpenEmbedDrawer: () => void;
  onRefreshAudience: () => void;
}

export const TownCrierHeader: React.FC<TownCrierHeaderProps> = ({
  activeTab,
  onOpenComposer,
  onOpenAddRecipient,
  onOpenCreateGong,
  onOpenEmbedDrawer,
  onRefreshAudience,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [exportMenuOpen]);

  const handleExportContacts = async (format: 'json' | 'csv') => {
    setExportMenuOpen(false);
    try {
      toast.info(`Preparing ${format.toUpperCase()} export...`, 'Exporting');
      const res = await townCrierAPI.exportRecipients(format, 'all');

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `subscribers-export-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.setAttribute('download', `subscribers-dump-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast.success('Contacts exported successfully', 'Export Complete');
    } catch {
      toast.error('Failed to export contacts', 'Export Error');
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await townCrierAPI.importRecipients(file);
      toast.success(`Imported ${res.data.importedCount} subscriber(s)`, 'CSV Import Complete');
      onRefreshAudience();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to import CSV'), 'Import Error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gold-500/40">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-royal-950 tracking-tight">Town Crier</h1>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-thistle-100 text-royal-800 border border-gold-500/40">
            Newsletter Engine
          </span>
        </div>
        <p className="text-xs text-thistle-500 mt-1">
          Universal list marketing &amp; newsletter channels. Gongs, welcome autoresponders, and isolated mailboxes.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onOpenEmbedDrawer}
          className="px-3.5 py-2 bg-white hover:bg-thistle-100 text-royal-800 border border-gold-500/40 rounded-xl text-xs font-bold glow-gold-hover flex items-center gap-1.5"
        >
          <Icons.Code className="text-gold-600" />
          <span>Integrate SDK &amp; Forms</span>
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((prev) => !prev)}
            className="px-3 py-2 bg-white hover:bg-thistle-100 text-royal-800 border border-gold-500/40 rounded-xl text-xs font-bold glow-gold-hover flex items-center gap-1.5"
          >
            <Icons.Download className="text-gold-600" />
            <span>Export Contacts ▾</span>
          </button>
          {exportMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-40 bg-white border border-gold-500/45 rounded-xl shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => handleExportContacts('csv')}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-royal-950 hover:bg-thistle-100 rounded-lg"
              >
                Export as CSV
              </button>
              <button
                type="button"
                onClick={() => handleExportContacts('json')}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-royal-950 hover:bg-thistle-100 rounded-lg"
              >
                Export as JSON
              </button>
            </div>
          )}
        </div>

        {activeTab === 'broadcasts' && (
          <button
            onClick={onOpenComposer}
            className="px-4 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.Plus className="text-gold-300" />
            <span>New Broadcast</span>
          </button>
        )}

        {activeTab === 'gongs' && (
          <button
            onClick={onOpenCreateGong}
            className="px-4 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Icons.TownCrier className="text-gold-300" />
            <span>New Gong Channel</span>
          </button>
        )}

        {activeTab === 'audience' && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white hover:bg-thistle-100 border border-gold-500/40 text-royal-800 rounded-xl text-xs font-bold glow-gold-hover flex items-center gap-1.5"
            >
              <Icons.Upload className="text-gold-600" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={onOpenAddRecipient}
              className="px-4 py-2 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Icons.Plus className="text-gold-300" />
              <span>Add Subscriber</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};