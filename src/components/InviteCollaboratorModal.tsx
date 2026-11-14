import React, { useState } from 'react';
import { campaignAPI, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Icons } from '../lib/icons';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-royal-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white border border-gold-500/45 p-6 rounded-3xl shadow-2xl w-full max-w-md z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold-500/35">
          <h2 className="text-base font-black text-royal-950 flex items-center gap-2">
            <Icons.Users className="text-gold-600" />
            <span>Invite Collaborator</span>
          </h2>
          <button onClick={onClose} className="text-thistle-500 hover:text-royal-950 p-1">
            <Icons.Close />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Email Address</label>
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
            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Role</label>
            <select
              className="w-full px-3.5 py-2 bg-thistle-50 border border-gold-500/40 rounded-xl font-semibold text-royal-950 focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="EDITOR">Editor (Can manage leads/drafts)</option>
              <option value="VIEWER">Viewer (Read-only)</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gold-500/35">
            <button type="button" onClick={onClose} className="px-4 py-2 text-thistle-500 hover:text-royal-950 font-bold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 btn-royal rounded-xl font-bold"
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};