import React, { useEffect, useState } from 'react';
import { UploadArea } from '../components/UploadArea';
import { LeadsTable } from '../components/LeadsTable';
import { Pagination } from '../components/Pagination';
import { leadAPI } from '../services/api';
import { Lead } from '../types/lead';

export const Dashboard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);

  const fetchLeads = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await leadAPI.getAll(page, pagination.pageSize);
      setLeads(res.data.data);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads(1);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadAPI.delete(id);
      fetchLeads(pagination.page);
    } catch (error) {
      alert('Failed to delete lead');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Lead Management Dashboard
        </h1>

        <UploadArea onUploadSuccess={() => fetchLeads(1)} />

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            All Leads ({pagination.total})
          </h2>
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <>
              <LeadsTable leads={leads} onDelete={handleDelete} />
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(page) => fetchLeads(page)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};