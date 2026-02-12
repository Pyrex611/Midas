import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Lead API endpoints
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

export default api;