import React, { useState } from 'react';
import { mailboxAPI } from '../services/api';

interface Props {
  mailbox?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const MailboxForm: React.FC<Props> = ({ mailbox, onClose, onSuccess }) => {
  const [name, setName] = useState(mailbox?.name || '');
  const [email, setEmail] = useState(mailbox?.email || '');
  const [senderName, setSenderName] = useState(mailbox?.senderName || '');
  const [smtpHost, setSmtpHost] = useState(mailbox?.smtpHost || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(mailbox?.smtpPort || 587);
  const [smtpSecure, setSmtpSecure] = useState(mailbox?.smtpSecure || false);
  const [smtpUser, setSmtpUser] = useState(mailbox?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState('');
  const [imapHost, setImapHost] = useState(mailbox?.imapHost || 'imap.gmail.com');
  const [imapPort, setImapPort] = useState(mailbox?.imapPort || 993);
  const [imapSecure, setImapSecure] = useState(mailbox?.imapSecure || true);
  const [imapUser, setImapUser] = useState(mailbox?.imapUser || '');
  const [imapPass, setImapPass] = useState('');
  const [sendLimit, setSendLimit] = useState<string | number>(mailbox?.sendLimit || 50);
  const [sendPeriod, setSendPeriod] = useState(mailbox?.sendPeriod || 'day');
  const [isPrimary, setIsPrimary] = useState(mailbox?.isPrimary || false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: any = {
        name,
        email,
        senderName,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        imapHost,
        imapPort,
        imapSecure,
        imapUser,
        sendLimit,
        sendPeriod,
        isPrimary,
      };
      if (smtpPass) data.smtpPass = smtpPass;
      if (imapPass) data.imapPass = imapPass;

      if (mailbox) {
        await mailboxAPI.update(mailbox.id, data);
      } else {
        await mailboxAPI.create(data);
      }
      onSuccess();
    } catch (err) {
      console.error('Failed to save mailbox', err);
      alert('Could not save mailbox');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {mailbox ? 'Edit Mailbox' : 'Add Mailbox'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Sender Name (optional)</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-2">SMTP Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-600">Use SSL (port 465)</label>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Username</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-600">Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                    placeholder={mailbox?.smtpPass ? '(unchanged)' : ''}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-2">IMAP Settings (for reply monitoring, optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Host</label>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Port</label>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={imapSecure}
                    onChange={(e) => setImapSecure(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-600">Use SSL</label>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Username</label>
                  <input
                    type="text"
                    value={imapUser}
                    onChange={(e) => setImapUser(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-600">Password</label>
                  <input
                    type="password"
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                    placeholder={mailbox?.imapPass ? '(unchanged)' : ''}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-2">Send Limits</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Limit</label>
                  <input
                    type="number"
                    value={sendLimit}
										onChange={(e) => {
											const val = e.target.value;
											// Allow empty string so user can delete the number to type a new one
											if (val === '') {
												setSendLimit('');
											} else {
												setSendLimit(parseInt(val));
											}
										}}
										onBlur={() => {
											// Safety: If they leave it empty, reset to 1 on blur
											if (sendLimit === '') setSendLimit(1);
										}}
										className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
										required
									/>
								</div>
                <div>
                  <label className="block text-sm text-gray-600">Period</label>
                  <select
                    value={sendPeriod}
                    onChange={(e) => setSendPeriod(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm text-gray-600">Set as primary mailbox</label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              {submitting ? 'Saving...' : (mailbox ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};