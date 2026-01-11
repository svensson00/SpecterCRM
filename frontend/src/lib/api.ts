import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track if we're currently refreshing to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If we're already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Use the configured baseURL for the refresh request
        const baseURL = import.meta.env.VITE_API_URL || '/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        // Process queued requests with the new token
        processQueue(null, data.accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
};

export const organizationAPI = {
  getAll: (params?: any) => api.get('/organizations', { params }),
  getById: (id: string) => api.get(`/organizations/${id}`),
  create: (data: any) => api.post('/organizations', data),
  update: (id: string, data: any) => api.patch(`/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
  getContacts: (id: string, params?: any) => api.get(`/organizations/${id}/contacts`, { params }),
  getDeals: (id: string, params?: any) => api.get(`/organizations/${id}/deals`, { params }),
  getActivities: (id: string, params?: any) => api.get(`/organizations/${id}/activities`, { params }),
  getNotes: (id: string) => api.get(`/organizations/${id}/notes`),
  createNote: (id: string, content: string) => api.post(`/organizations/${id}/notes`, { content }),
  checkDuplicates: (name: string, website?: string) =>
    api.get('/organizations/check-duplicates', { params: { name, website } }),
};

export const contactAPI = {
  getAll: (params?: any) => api.get('/contacts', { params }),
  getById: (id: string) => api.get(`/contacts/${id}`),
  create: (data: any) => api.post('/contacts', data),
  update: (id: string, data: any) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  getNotes: (id: string) => api.get(`/contacts/${id}/notes`),
  createNote: (id: string, content: string) => api.post(`/contacts/${id}/notes`, { content }),
  checkDuplicates: (firstName: string, lastName: string, emails: string[], primaryOrganizationId: string) =>
    api.get('/contacts/check-duplicates', {
      params: { firstName, lastName, emails, primaryOrganizationId },
    }),
};

export const dealAPI = {
  getAll: (params?: any) => api.get('/deals', { params }),
  getById: (id: string) => api.get(`/deals/${id}`),
  create: (data: any) => api.post('/deals', data),
  update: (id: string, data: any) => api.patch(`/deals/${id}`, data),
  updateStage: (id: string, stage: string, reasonLost?: string) =>
    api.patch(`/deals/${id}/stage`, { stage, reasonLost }),
  delete: (id: string) => api.delete(`/deals/${id}`),
  getPipeline: () => api.get('/deals/pipeline/summary'),
  getNotes: (id: string) => api.get(`/deals/${id}/notes`),
  createNote: (id: string, content: string) => api.post(`/deals/${id}/notes`, { content }),
};

export const activityAPI = {
  getAll: (params?: any) => api.get('/activities', { params }),
  getById: (id: string) => api.get(`/activities/${id}`),
  create: (data: any) => api.post('/activities', data),
  update: (id: string, data: any) => api.patch(`/activities/${id}`, data),
  toggleComplete: (id: string) => api.patch(`/activities/${id}/complete`),
  delete: (id: string) => api.delete(`/activities/${id}`),
};

export const reportAPI = {
  getPipeline: () => api.get('/reports/pipeline'),
  getWinRate: () => api.get('/reports/win-rate'),
  getCycleTime: () => api.get('/reports/cycle-time'),
  getActivityVolume: (params?: any) => api.get('/reports/activity-volume', { params }),
  getTopAccounts: (params?: any) => api.get('/reports/top-accounts', { params }),
  getForecast: () => api.get('/reports/forecast'),
};

export const deduplicationAPI = {
  getSuggestions: (entityType: string) => api.get('/duplicates', { params: { entityType } }),
  merge: (suggestionId: string, primaryId: string) =>
    api.post('/duplicates/merge', { suggestionId, primaryId }),
  dismiss: (suggestionId: string) => api.post('/duplicates/dismiss', { suggestionId }),
  detectOrganizations: () => api.post('/duplicates/detect/organizations'),
  detectContacts: () => api.post('/duplicates/detect/contacts'),
};

export const userAPI = {
  getAll: (params?: any) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  changePassword: (id: string, newPassword: string) => api.patch(`/users/${id}/password`, { newPassword }),
  changeOwnPassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export const adminAPI = {
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: any) => api.patch('/admin/settings', data),
  getActivityTypes: () => api.get('/admin/activity-types'),
  createActivityType: (name: string) => api.post('/admin/activity-types', { name }),
  updateActivityType: (id: string, data: any) => api.patch(`/admin/activity-types/${id}`, data),
  deleteActivityType: (id: string) => api.delete(`/admin/activity-types/${id}`),
  getContactRoles: () => api.get('/admin/contact-roles'),
  createContactRole: (name: string) => api.post('/admin/contact-roles', { name }),
  updateContactRole: (id: string, data: any) => api.patch(`/admin/contact-roles/${id}`, data),
  deleteContactRole: (id: string) => api.delete(`/admin/contact-roles/${id}`),
  getAuditLogs: (params?: any) => api.get('/admin/audit-logs', { params }),
};
