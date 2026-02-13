import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ===== LEAD API =====
export const leadAPI = {
  upload: (file: File, skipDuplicates = true) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/leads/upload?skipDuplicates=${skipDuplicates}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll: (page = 1, pageSize = 20, status?: string) =>
    api.get('/leads', { params: { page, pageSize, status } }),
  get: (id: string) => api.get(`/leads/${id}`),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

// ===== CAMPAIGN API =====
export const campaignAPI = {
  create: (data: { name: string; description?: string; context?: string; leadIds?: string[] }) =>
    api.post('/campaigns', data),
  getAll: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  addLeads: (campaignId: string, leadIds: string[]) =>
    api.post(`/campaigns/${campaignId}/leads`, { leadIds }),
  getLeadEmailPreview: (campaignId: string, leadId: string) => // ✅ NEW
    api.get(`/campaigns/${campaignId}/leads/${leadId}/preview`),
};

// ===== DIAGNOSTICS API =====
export const diagnosticsAPI = {
  health: () => api.get('/diagnostics/health/db'),
  testLead: () => api.post('/diagnostics/test/lead'),
};

export default api;