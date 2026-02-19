import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Venue & Event APIs
export const venueApi = {
  create: (data: any) => apiClient.post('/venues/create', data),
  list: () => apiClient.get('/venues/list'),
};

export const eventApi = {
  create: (data: any) => apiClient.post('/events/create', data),
  list: (params?: any) => apiClient.get('/events/list', { params }),
  get: (eventId: string) => apiClient.get(`/events/${eventId}`),
  update: (eventId: string, data: any) => apiClient.put('/events/update', { ...data, event_id: eventId }),
};

// Revenue Profile APIs
export const revenueProfileApi = {
  list: () => apiClient.get('/admin/revenue-profiles'),
  create: (data: any) => apiClient.post('/admin/revenue-profiles', data),
  update: (id: string, data: any) => apiClient.put('/admin/revenue-profiles', { id, ...data }),
};

// Tax Profile APIs
export const taxProfileApi = {
  list: (venueId?: string) => apiClient.get('/admin/tax-profiles', { params: { venue_id: venueId } }),
  create: (data: any) => apiClient.post('/admin/tax-profiles', data),
};

// Station APIs
export const stationApi = {
  list: (params?: any) => apiClient.get('/stations/manage', { params }),
  create: (data: any) => apiClient.post('/stations/manage', data),
  update: (data: any) => apiClient.put('/stations/manage', data),
  delete: (id: string) => apiClient.delete('/stations/manage', { params: { id } }),
};

// Menu APIs
export const menuApi = {
  list: (params?: any) => apiClient.get('/menu/manage', { params }),
  create: (data: any) => apiClient.post('/menu/manage', data),
  update: (data: any) => apiClient.put('/menu/manage', data),
  delete: (id: string) => apiClient.delete('/menu/manage', { params: { id } }),
};

// QR/NFC Asset APIs
export const qrAssetApi = {
  provision: (data: any) => apiClient.post('/qr-assets/provision', data),
  list: (params?: any) => apiClient.get('/qr-assets/list', { params }),
};

// Transaction APIs
export const transactionApi = {
  processAtomic: (data: any) => apiClient.post('/transactions/process-atomic', data),
  queryLedger: (params?: any) => apiClient.get('/admin/ledger-query', { params }),
};

// Entry APIs
export const entryApi = {
  processWithVerification: (data: any) => apiClient.post('/entry/process-with-verification', data),
  trackingHistory: (params?: any) => apiClient.get('/entry/tracking-history', { params }),
};

export default apiClient;
