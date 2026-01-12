import axios from 'axios';
import type { 
  WalletBalance, 
  Transaction, 
  GhostPass, 
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

  fund: async (amount: number, source: string): Promise<any> => {
    const { data } = await api.post('/wallet/fund', {
      amount,
      source,
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

export default api;
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