import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track if we're currently refreshing to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

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

// Decode JWT to get expiration time (without verifying signature)
const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
};

// Check if token is about to expire (within 5 minutes)
const isTokenExpiringSoon = (token: string): boolean => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() > expiry - fiveMinutes;
};

// Proactive token refresh function
const refreshTokenProactively = async (): Promise<string | null> => {
  if (isRefreshing) return null;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  isRefreshing = true;

  try {
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    // Schedule next proactive refresh
    scheduleTokenRefresh(data.accessToken);

    processQueue(null, data.accessToken);
    return data.accessToken;
  } catch (error) {
    processQueue(error, null);
    return null;
  } finally {
    isRefreshing = false;
  }
};

// Schedule proactive token refresh before expiry
const scheduleTokenRefresh = (token: string) => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const expiry = getTokenExpiry(token);
  if (!expiry) return;

  // Refresh 5 minutes before expiry
  const fiveMinutes = 5 * 60 * 1000;
  const refreshIn = expiry - Date.now() - fiveMinutes;

  if (refreshIn > 0) {
    refreshTimer = setTimeout(() => {
      refreshTokenProactively();
    }, refreshIn);
  }
};

// Initialize proactive refresh on page load
const initializeTokenRefresh = () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    if (isTokenExpiringSoon(token)) {
      // Token is expiring soon, refresh immediately
      refreshTokenProactively();
    } else {
      // Schedule refresh for later
      scheduleTokenRefresh(token);
    }
  }
};

// Run initialization
initializeTokenRefresh();

// Request interceptor - check token before each request
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('accessToken');

  if (token && isTokenExpiringSoon(token)) {
    // Token is expiring soon, refresh before making request
    const newToken = await refreshTokenProactively();
    if (newToken) {
      token = newToken;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 errors as fallback
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

        const baseURL = import.meta.env.VITE_API_URL || '/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Schedule next proactive refresh
        scheduleTokenRefresh(data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
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
  getActivities: (id: string, params?: any) => api.get(`/contacts/${id}/activities`, { params }),
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
