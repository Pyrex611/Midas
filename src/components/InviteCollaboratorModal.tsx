import React, { useState } from 'react';
import { campaignAPI } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onSuccess: () => void;
}

export const InviteCollaboratorModal: React.FC<Props> = ({ isOpen, onClose, campaignId, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EDITOR');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await campaignAPI.createInvite(campaignId, { email, role });
      alert(`Invite sent to ${email}`);
      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to send invite. Ensure the user is registered.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Invite Collaborator</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              required
              className="mt-1 block w-full border rounded-md p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select 
              className="mt-1 block w-full border rounded-md p-2"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="EDITOR">Editor (Can manage leads/drafts)</option>
              <option value="VIEWER">Viewer (Read-only)</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
            <button 
              type="submit" 
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};