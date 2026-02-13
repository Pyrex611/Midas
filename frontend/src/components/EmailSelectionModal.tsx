import React, { useState } from 'react';
import { EmailCandidate } from '../types/lead';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  candidates: {
    rowIndex: number;
    candidates: EmailCandidate[];
    leadPreview: {
      name: string;
      company: string | null;
      position: string | null;
    };
  }[];
  onConfirm: (selections: { rowIndex: number; selectedEmail: string }[]) => void;
}

export const EmailSelectionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  candidates,
  onConfirm,
}) => {
  const [selections, setSelections] = useState<Map<number, string>>(() => {
    const map = new Map();
    candidates.forEach(c => {
      // Default to first candidate (usually highest priority)
      map.set(c.rowIndex, c.candidates[0].email);
    });
    return map;
  });

  const [selectAllMode, setSelectAllMode] = useState<'work' | 'personal' | null>(null);

  if (!isOpen) return null;

  const handleSelectAllWork = () => {
    const newSelections = new Map(selections);
    candidates.forEach(c => {
      const workEmail = c.candidates.find(cand => cand.type === 'work');
      if (workEmail) newSelections.set(c.rowIndex, workEmail.email);
    });
    setSelections(newSelections);
    setSelectAllMode('work');
  };

  const handleSelectAllPersonal = () => {
    const newSelections = new Map(selections);
    candidates.forEach(c => {
      const personalEmail = c.candidates.find(cand => cand.type === 'personal');
      if (personalEmail) newSelections.set(c.rowIndex, personalEmail.email);
    });
    setSelections(newSelections);
    setSelectAllMode('personal');
  };

  const handleConfirm = () => {
    const selectionsArray = Array.from(selections.entries()).map(([rowIndex, selectedEmail]) => ({
      rowIndex,
      selectedEmail,
    }));
    onConfirm(selectionsArray);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Multiple Email Addresses Detected
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {candidates.length} lead(s) have more than one email address. Please select which email to use for each lead.
        </p>

        {/* Bulk action buttons */}
        <div className="flex space-x-3 mb-6 pb-4 border-b">
          <button
            onClick={handleSelectAllWork}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              selectAllMode === 'work'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Use Work for All
          </button>
          <button
            onClick={handleSelectAllPersonal}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              selectAllMode === 'personal'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Use Personal for All
          </button>
          <button
            onClick={() => setSelectAllMode(null)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Select Manually
          </button>
        </div>

        {/* Per-lead selection table */}
        <div className="max-h-96 overflow-y-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select Email</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((item) => (
                <tr key={item.rowIndex}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.leadPreview.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.leadPreview.company || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.leadPreview.position || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      value={selections.get(item.rowIndex) || ''}
                      onChange={(e) => {
                        const newSelections = new Map(selections);
                        newSelections.set(item.rowIndex, e.target.value);
                        setSelections(newSelections);
                        setSelectAllMode(null);
                      }}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      {item.candidates.map((cand, idx) => (
                        <option key={idx} value={cand.email}>
                          {cand.email} ({cand.type})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
          >
            Confirm & Upload
          </button>
        </div>
      </div>
    </div>
  );
};