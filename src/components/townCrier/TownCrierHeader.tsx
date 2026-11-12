import React, { useRef } from 'react';
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

  const handleExportContacts = async (format: 'json' | 'csv') => {
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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Town Crier</h1>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
            Newsletter Engine
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Universal list marketing & newsletter channels. Gongs, welcome autoresponders, and isolated mailboxes.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenEmbedDrawer}
          className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
        >
          <Icons.Code className="w-4 h-4 text-blue-600" />
          <span>Integrate SDK & Forms</span>
        </button>

        <div className="relative group">
          <button className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
            <Icons.Download className="w-4 h-4 text-zinc-500" />
            <span>Export Contacts ▾</span>
          </button>
          <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-30">
            <button
              onClick={() => handleExportContacts('csv')}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-lg"
            >
              Export as CSV
            </button>
            <button
              onClick={() => handleExportContacts('json')}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-lg"
            >
              Export as JSON
            </button>
          </div>
        </div>

        {activeTab === 'broadcasts' && (
          <button
            onClick={onOpenComposer}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>New Broadcast</span>
          </button>
        )}

        {activeTab === 'gongs' && (
          <button
            onClick={onOpenCreateGong}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Icons.TownCrier className="w-4 h-4" />
            <span>+ New Gong Channel</span>
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
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors"
            >
              Import CSV
            </button>
            <button
              onClick={onOpenAddRecipient}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              + Add Subscriber
            </button>
          </>
        )}
      </div>
    </div>
  );
};