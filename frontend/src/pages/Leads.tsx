import React, { useEffect, useState } from 'react';
import { LeadsTable } from '../components/LeadsTable';
import { Pagination } from '../components/Pagination';
import { leadAPI } from '../services/api';
import { Lead } from '../types/lead';

export const Leads: React.FC = () => {
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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        All Leads
      </h1>

      <div className="bg-white shadow rounded-lg p-6">
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
  );
};