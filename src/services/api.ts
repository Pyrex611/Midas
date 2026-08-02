import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

axios.defaults.withCredentials = true;

// Scope Token Injection to our Custom API instance to fix app-wide 401s
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('midas_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  signUp: (email: string, password: string, name?: string) =>
    api.post('/auth/signup', { email, password, name }),
  signIn: (email: string, password: string) =>
    api.post('/auth/callback/credentials', { email, password }),
  signOut: () => api.post('/auth/signout'),
  getSession: () => api.get('/auth/session'),
};

export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: { name: string }) => api.put('/user/profile', data),
};

export const userSettingsAPI = {
  get: () => api.get('/user/settings'),
  update: (data: any) => api.put('/user/settings', data),
};

export const leadAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getJobs: () => api.get('/leads/jobs'),
  getBlocklist: () => api.get('/leads/blocklist'),
  addBlocklist: (pattern: string) => api.post('/leads/blocklist', { pattern }),
  deleteBlocklist: (id: string) => api.delete(`/leads/blocklist/${id}`),
  getAll: (page = 1, pageSize = 20, status?: string, campaignId?: string) =>
    api.get('/leads', { params: { page, pageSize, status, campaignId } }),
  get: (id: string) => api.get(`/leads/${id}`),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export const campaignAPI = {
  create: (data: {
    name: string;
    description?: string;
    context?: string;
    reference?: string;
    senderName?: string;
    leadIds?: string[];
    autoReplyEnabled?: boolean;
    sendHourUTC?: number;
  }) => api.post('/campaigns', data),

  getAll: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),

  addLeads: (campaignId: string, leadIds: string[]) =>
    api.post(`/campaigns/${campaignId}/leads`, { leadIds }),

  updateAutoReply: (id: string, data: { autoReplyEnabled: boolean }) =>
    api.put(`/campaigns/${id}/auto-reply`, data),

  getFollowUpSteps: (id: string) => api.get(`/campaigns/${id}/followup-steps`),
  setFollowUpSteps: (id: string, steps: any[]) => api.post(`/campaigns/${id}/followup-steps`, { steps }),
  deleteFollowUpStep: (id: string, stepId: string) => api.delete(`/campaigns/${id}/followup-steps/${stepId}`),
  updateSendHour: (id: string, sendHourUTC: number) => api.put(`/campaigns/${id}/send-hour`, { sendHourUTC }),

  getLeadThread: (campaignId: string, leadId: string) =>
    api.get(`/campaigns/${campaignId}/leads/${leadId}/thread`),

  previewLeadWithDraft: (campaignId: string, leadId: string, draftId: string) =>
    api.get(`/campaigns/${campaignId}/leads/${leadId}/preview/${draftId}`),

  sendLeadEmail: (campaignId: string, leadId: string) =>
    api.post(`/campaigns/${campaignId}/leads/${leadId}/send`),

  getReplyDraft: (campaignId: string, leadId: string) =>
    api.get(`/campaigns/${campaignId}/leads/${leadId}/reply-draft`),

  generateReplyDraft: (campaignId: string, leadId: string) =>
    api.post(`/campaigns/${campaignId}/leads/${leadId}/generate-reply-draft`),

  sendReplyDraft: (campaignId: string, leadId: string, data: { subject: string; body: string }) =>
    api.post(`/campaigns/${campaignId}/leads/${leadId}/send-reply-draft`, data),

  getDrafts: (campaignId: string) => api.get(`/campaigns/${campaignId}/drafts`),
  updateDraft: (campaignId: string, draftId: string, data: { subject?: string; body?: string; tone?: string }) =>
    api.put(`/campaigns/${campaignId}/drafts/${draftId}`, data),
  deleteDraft: (campaignId: string, draftId: string) =>
    api.delete(`/campaigns/${campaignId}/drafts/${draftId}`),
  createCustomDraft: (campaignId: string, data: { subject: string; body: string }) =>
    api.post(`/campaigns/${campaignId}/drafts/custom`, data),
  generateDraft: (campaignId: string) =>
    api.post(`/campaigns/${campaignId}/drafts/generate`),
  updateActiveHours: (id: string, data: { activeStartHour?: number | null; activeEndHour?: number | null; timezone?: string }) =>
    api.put(`/campaigns/${id}/active-hours`, data),
  generateStepDraft: (campaignId: string, stepNumber: number) =>
    api.post(`/campaigns/${campaignId}/steps/${stepNumber}/generate-draft`),

  getCampaignDomains: (campaignId: string) => api.get(`/campaigns/${campaignId}/domains`),
  addDomainToCampaign: (campaignId: string, domainId: string) => api.post(`/campaigns/${campaignId}/domains`, { domainId }),
  removeDomainFromCampaign: (campaignId: string, domainId: string) => api.delete(`/campaigns/${campaignId}/domains/${domainId}`),

  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
};

export const domainAPI = {
  getAll: () => api.get('/domains'),
  add: (domainName: string) => api.post('/domains', { domainName }),
  verify: (id: string) => api.post(`/domains/${id}/verify`),
  delete: (id: string) => api.delete(`/domains/${id}`),
};

export const aiAPI = {
  optimizeContext: (context: string) => api.post('/ai/optimize-context', { context }),
};

export const diagnosticsAPI = {
  health: () => api.get('/diagnostics/health/db'),
  testLead: () => api.post('/diagnostics/test/lead'),
};

export const inboxAPI = {
  getThreads: () => api.get('/inbox'),
  sendReply: (leadId: string, body: string) => api.post(`/inbox/${leadId}/reply`, { body }),
};

export default api;