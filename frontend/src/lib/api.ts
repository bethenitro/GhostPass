import axios from 'axios';
import type {
  WalletBalance,
  Transaction,
  GhostPass,
  Session,
  SessionStatusResponse,
  FundingSource,
  AdminDashboard,
  FeeConfigUpdate,
  ScanFeeUpdate,
  GhostPassPricingUpdate,
  PayoutRequest,
  PayoutAction,
  RetentionOverride,
  AuditLog,
  AdminUser
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken: string | null = localStorage.getItem('auth_token');

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      authToken = null;
      localStorage.removeItem('auth_token');
      window.location.reload(); // Force re-login
    }
    return Promise.reject(error);
  }
);

// Auth API - PROXY ARCHITECTURE (Frontend -> FastAPI -> Supabase)
export const authApi = {
  signIn: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', {
      email,
      password,
    });

    authToken = data.access_token;
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
    }

    return data;
  },

  signUp: async (email: string, password: string) => {
    const { data } = await api.post('/auth/register', {
      email,
      password,
    });

    authToken = data.access_token;
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
    }

    return data;
  },

  signOut: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      authToken = null;
      localStorage.removeItem('auth_token');
    }
  },

  getCurrentUser: async () => {
    if (!authToken) return null;

    try {
      const { data } = await api.get('/auth/me');
      return data;
    } catch (error) {
      return null;
    }
  },

  getToken: () => authToken,

  setToken: (token: string) => {
    authToken = token;
    localStorage.setItem('auth_token', token);
  },
};

// Wallet API - ALL REQUESTS GO THROUGH FASTAPI PROXY
export const walletApi = {
  getBalance: async (): Promise<WalletBalance> => {
    const { data } = await api.get('/wallet/balance');
    return data;
  },

  fund: async (sources: Array<{ source: string; amount: number }>): Promise<any> => {
    const { data } = await api.post('/wallet/fund', {
      sources,
    });
    return data;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const { data } = await api.get('/wallet/transactions');
    return data;
  },
};

// GhostPass API - ALL REQUESTS GO THROUGH FASTAPI PROXY
export const ghostPassApi = {
  getStatus: async (): Promise<GhostPass | null> => {
    try {
      const { data } = await api.get('/ghostpass/status');
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  purchase: async (duration: number): Promise<GhostPass> => {
    const { data } = await api.post('/ghostpass/purchase', {
      duration,
    });
    return data;
  },

  getFundingSources: async (): Promise<FundingSource[]> => {
    // Mock funding sources for now
    return [
      { id: '1', name: 'Zelle', type: 'zelle', enabled: true },
      { id: '2', name: 'Stripe', type: 'stripe', enabled: true },
    ];
  },
};

// Session API - GHOSTPASS SESSION FEATURE
export const sessionApi = {
  create: async (sessionType: '30_seconds' | '3_minutes' | '10_minutes'): Promise<SessionStatusResponse> => {
    const { data } = await api.post('/session/create', {
      session_type: sessionType,
    });
    return data;
  },

  getStatus: async (): Promise<SessionStatusResponse> => {
    const { data } = await api.get('/session/status');
    return data;
  },

  vaporize: async (): Promise<any> => {
    const { data } = await api.delete('/session/vaporize');
    return data;
  },
};

// Admin API - REQUIRES ADMIN ROLE
export const adminApi = {
  getHealth: async () => {
    const { data } = await api.get('/admin/health');
    return data;
  },

  getDashboard: async (): Promise<AdminDashboard> => {
    const { data } = await api.get('/admin/dashboard');
    return data;
  },

  updateFeeConfig: async (config: FeeConfigUpdate) => {
    const { data } = await api.post('/admin/fees/config', config);
    return data;
  },

  updateScanFee: async (feeUpdate: ScanFeeUpdate) => {
    const { data } = await api.post('/admin/fees/scan', feeUpdate);
    return data;
  },

  updateGhostPassPricing: async (pricing: GhostPassPricingUpdate) => {
    const { data } = await api.post('/admin/pricing/ghostpass', pricing);
    return data;
  },

  getPayoutRequests: async (status?: string): Promise<PayoutRequest[]> => {
    const { data } = await api.get('/admin/payouts', {
      params: status ? { status } : {}
    });
    return data;
  },

  processPayoutAction: async (payoutId: string, action: PayoutAction) => {
    const { data } = await api.post(`/admin/payouts/${payoutId}/action`, action);
    return data;
  },

  processAllPayouts: async () => {
    const { data } = await api.post('/admin/payouts/process-all');
    return data;
  },

  overrideRetention: async (override: RetentionOverride) => {
    const { data } = await api.post('/admin/retention/override', override);
    return data;
  },

  getAuditLogs: async (params?: {
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<AuditLog[]> => {
    const { data } = await api.get('/admin/audit-logs', { params });
    return data;
  },

  getUsers: async (params?: {
    limit?: number;
    offset?: number;
    role?: string;
  }): Promise<AdminUser[]> => {
    const { data } = await api.get('/admin/users', { params });
    return data;
  },

  updateUserRole: async (userId: string, role: 'USER' | 'VENDOR' | 'ADMIN') => {
    const { data } = await api.post(`/admin/users/${userId}/role`, { role });
    return data;
  }
};
// Gateway API - ENTRY POINTS, INTERNAL AREAS, TABLES & SEATS
export const gatewayApi = {
  getEntryPoints: async () => {
    const { data } = await api.get('/gateway/points?type=ENTRY_POINT');
    return data;
  },

  createEntryPoint: async (entryPoint: { name: string; status: 'ENABLED' | 'DISABLED' }) => {
    const { data } = await api.post('/gateway/points', {
      ...entryPoint,
      type: 'ENTRY_POINT'
    });
    return data;
  },

  updateEntryPoint: async (id: string, updates: { name?: string; status?: 'ENABLED' | 'DISABLED' }) => {
    const { data } = await api.put(`/gateway/points/${id}`, updates);
    return data;
  },

  deleteEntryPoint: async (id: string) => {
    const { data } = await api.delete(`/gateway/points/${id}`);
    return data;
  },

  // Internal Areas
  getInternalAreas: async () => {
    const { data } = await api.get('/gateway/points?type=INTERNAL_AREA');
    return data;
  },

  createInternalArea: async (area: {
    name: string;
    number?: number;
    accepts_ghostpass: boolean;
    status: 'ENABLED' | 'DISABLED'
  }) => {
    const { data } = await api.post('/gateway/points', {
      ...area,
      type: 'INTERNAL_AREA'
    });
    return data;
  },

  updateInternalArea: async (id: string, updates: {
    name?: string;
    number?: number;
    accepts_ghostpass?: boolean;
    status?: 'ENABLED' | 'DISABLED'
  }) => {
    const { data } = await api.put(`/gateway/points/${id}`, updates);
    return data;
  },

  deleteInternalArea: async (id: string) => {
    const { data } = await api.delete(`/gateway/points/${id}`);
    return data;
  },

  // Tables & Seats
  getTableSeats: async () => {
    const { data } = await api.get('/gateway/points?type=TABLE_SEAT');
    return data;
  },

  createTableSeat: async (tableSeat: {
    name: string;
    number?: number;
    linked_area_id: string;
    status: 'ENABLED' | 'DISABLED'
  }) => {
    const { data } = await api.post('/gateway/points', {
      ...tableSeat,
      type: 'TABLE_SEAT'
    });
    return data;
  },

  updateTableSeat: async (id: string, updates: {
    name?: string;
    number?: number;
    linked_area_id?: string;
    status?: 'ENABLED' | 'DISABLED'
  }) => {
    const { data } = await api.put(`/gateway/points/${id}`, updates);
    return data;
  },

  deleteTableSeat: async (id: string) => {
    const { data } = await api.delete(`/gateway/points/${id}`);
    return data;
  }
};
