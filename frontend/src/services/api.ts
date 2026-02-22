import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export const leadAPI = {
  upload: (file: File, skipDuplicates = true) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/leads/upload?skipDuplicates=${skipDuplicates}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll: (page = 1, pageSize = 20, status?: string, campaignId?: string) =>
    api.get('/leads', { params: { page, pageSize, status, campaignId } }),
  get: (id: string) => api.get(`/leads/${id}`),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export const campaignAPI = {
  create: (data: { name: string; description?: string; context?: string; reference?: string; senderName?: string; leadIds?: string[] }) =>
    api.post('/campaigns', data),
  getAll: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  addLeads: (campaignId: string, leadIds: string[]) =>
    api.post(`/campaigns/${campaignId}/leads`, { leadIds }),
  getLeadThread: (campaignId: string, leadId: string) =>
    api.get(`/campaigns/${campaignId}/leads/${leadId}/thread`),
  previewLeadWithDraft: (campaignId: string, leadId: string, draftId: string) =>
    api.get(`/campaigns/${campaignId}/leads/${leadId}/preview/${draftId}`),
  sendLeadEmail: (campaignId: string, leadId: string) =>
    api.post(`/campaigns/${campaignId}/leads/${leadId}/send`),
  generateReplyDraft: (campaignId: string, leadId: string) =>
    api.post(`/campaigns/${campaignId}/leads/${leadId}/generate-reply-draft`),
  update: (id: string, data: { name?: string; description?: string; context?: string; reference?: string; senderName?: string }) =>
    api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  getDrafts: (campaignId: string) => api.get(`/campaigns/${campaignId}/drafts`),
  updateDraft: (campaignId: string, draftId: string, data: { subject?: string; body?: string; tone?: string }) =>
    api.put(`/campaigns/${campaignId}/drafts/${draftId}`, data),
  deleteDraft: (campaignId: string, draftId: string) =>
    api.delete(`/campaigns/${campaignId}/drafts/${draftId}`),
  createCustomDraft: (campaignId: string, data: { subject: string; body: string }) =>
    api.post(`/campaigns/${campaignId}/drafts/custom`, data),
  generateDraft: (campaignId: string) =>
    api.post(`/campaigns/${campaignId}/drafts/generate`),
};

export const imapAPI = {
  poll: () => api.post('/imap/poll'),
};

export const diagnosticsAPI = {
  health: () => api.get('/diagnostics/health/db'),
  testLead: () => api.post('/diagnostics/test/lead'),
};

export default api;