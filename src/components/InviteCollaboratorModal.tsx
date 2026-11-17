import React, { useState } from 'react';
import { campaignAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Sheet } from './common/Sheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onSuccess: () => void;
}

export const InviteCollaboratorModal: React.FC<Props> = ({ isOpen, onClose, campaignId, onSuccess }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EDITOR');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await campaignAPI.createInvite(campaignId, { email, role });
      toast.success(`Invitation sent to ${email}`, 'Collaborator Invited');
      setEmail('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to send invite. Ensure the user is registered.'), 'Invite Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Team Collaborator"
      description="Grant Editor or View-Only permissions to another registered MIDAS user."
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Collaborator Email</label>
          <input
            type="email"
            required
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-mono focus:outline-none focus:border-gold-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Workspace Role</label>
          <select
            className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-semibold text-royal-950 focus:outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="EDITOR">Editor (Manage leads, drafts &amp; sequences)</option>
            <option value="VIEWER">Viewer (Read-only analytics &amp; threads)</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-gold-500/35">
          <button type="button" onClick={onClose} className="px-4 py-2 text-thistle-500 hover:text-royal-950 font-bold">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-5 py-2 btn-royal rounded-xl font-bold">
            {submitting ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};