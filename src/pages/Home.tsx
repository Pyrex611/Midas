import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadAPI } from '../services/api';
import { UploadArea } from '../components/UploadArea';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [newBlock, setNewBlock] = useState('');

  const fetchBlocklist = async () => {
    try {
      const res = await leadAPI.getBlocklist();
      setBlocklist(res.data);
    } catch (e) {
      console.error('Failed to fetch blocklist', e);
    }
  };

  useEffect(() => {
    fetchBlocklist();
  }, []);

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlock.trim()) return;
    try {
      await leadAPI.addBlocklist(newBlock.trim());
      setNewBlock('');
      await fetchBlocklist();
    } catch (e) {
      alert('Failed to add pattern to blocklist');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await leadAPI.deleteBlocklist(id);
      await fetchBlocklist();
    } catch (e) {
      console.error('Failed to delete blocklist entry', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Lead Dashboard</h1>
        <button onClick={() => navigate('/campaigns')} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
          Go to Campaigns
        </button>
      </div>

      <UploadArea onJobComplete={() => console.log('Job completed and refreshed')} />

      <div className="bg-white shadow sm:rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Global Blocklist (Suppression)</h2>
        <p className="text-sm text-gray-600 mb-4">Emails matching these patterns will be automatically discarded during lead imports.</p>
        
        <form onSubmit={handleAddBlock} className="flex gap-4 mb-4">
          <input
            type="text"
            value={newBlock}
            onChange={(e) => setNewBlock(e.target.value)}
            placeholder="e.g., competitor.com, *@agency.com, or ceo@target.com"
            className="flex-1 px-4 py-2 border rounded-md"
            required
          />
          <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Add Pattern</button>
        </form>

        <ul className="space-y-2">
          {blocklist.length === 0 ? (
            <li className="text-sm text-gray-400 italic p-2">No active suppression patterns configured.</li>
          ) : (
            blocklist.map(b => (
              <li key={b.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded-md">
                <span className="font-mono text-sm text-gray-800">{b.pattern}</span>
                <button onClick={() => handleDeleteBlock(b.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Delete</button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};