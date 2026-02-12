import axios from 'axios';
import type {
  WalletBalance,
  Transaction,
  GhostPass,
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
  AdminUser,
  RefundResponse,
  RefundHistoryItem
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management - now uses device fingerprint instead of auth tokens
let deviceFingerprint: string | null = localStorage.getItem('device_fingerprint');

// Generate device fingerprint if not exists
if (!deviceFingerprint) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);
  const fingerprint = canvas.toDataURL();
  deviceFingerprint = btoa(fingerprint).slice(0, 32);
  localStorage.setItem('device_fingerprint', deviceFingerprint);
}

// Add device fingerprint to requests, and auth token for admin/gateway endpoints
api.interceptors.request.use((config) => {
  // Always add device fingerprint for wallet operations
  if (deviceFingerprint) {
    config.headers['X-Device-Fingerprint'] = deviceFingerprint;
  }
  
  // Add Bearer token for admin, gateway, venue, and auth endpoints (operator portal)
  if (config.url?.startsWith('/admin/') || 
      config.url?.startsWith('/gateway/') || 
      config.url?.startsWith('/venue/') ||
      config.url?.startsWith('/auth/me')) {
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  
  return config;
});

// Handle errors (no auth redirect needed for anonymous mode)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Just log errors, no auth redirect
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Auth API - For operator portal authentication only
export const authApi = {
  signIn: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
    }
    return data;
  },
  
  signUp: async (email: string, password: string) => {
    const { data } = await api.post('/auth/register', { email, password });
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
    }
    return data;
  },

  signUpVenueAdmin: async (venueAdminData: {
    email: string;
    password: string;
    venue_id: string;
    event_id?: string;
    venue_name: string;
    contact_name: string;
    contact_phone?: string;
  }) => {
    const { data } = await api.post('/auth/register-venue-admin', venueAdminData);
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
    }
    return data;
  },
  
  signOut: async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('ghost_pass_wallet_session');
  },
  
  getCurrentUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      return data;
    } catch (error) {
      return null;
    }
  },
  
  getToken: () => localStorage.getItem('auth_token'),
  
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
  },
  
  isAuthenticated: () => !!localStorage.getItem('auth_token'),
  
  getUserData: () => {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }
};

// Wallet API - ALL REQUESTS USE DEVICE FINGERPRINT (NO AUTH)
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

  // Device-bound wallet endpoints
  bindDevice: async (deviceFingerprint: string, biometricHash: string): Promise<any> => {
    const { data } = await api.post('/wallet/bind-device', {
      device_fingerprint: deviceFingerprint,
      biometric_hash: biometricHash,
    });
    return data;
  },

  verifyDeviceBinding: async (deviceFingerprint: string, biometricHash: string): Promise<any> => {
    const { data } = await api.post('/wallet/verify-device-binding', {}, {
      params: {
        device_fingerprint: deviceFingerprint,
        biometric_hash: biometricHash,
      }
    });
    return data;
  },

  // Platform fee endpoints
  processAtomicTransaction: async (
    itemAmountCents: number,
    gatewayId: string,
    context: string = 'general'
  ): Promise<any> => {
    const { data } = await api.post('/wallet/atomic-transaction', {}, {
      params: {
        item_amount_cents: itemAmountCents,
        gateway_id: gatewayId,
        context,
      }
    });
    return data;
  },

  getPlatformFeeConfig: async (): Promise<any> => {
    const { data } = await api.get('/wallet/platform-fee-config');
    return data;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const { data } = await api.get('/wallet/transactions');
    return data;
  },

  getEligibleFundingTransactions: async (): Promise<Transaction[]> => {
    const { data } = await api.get('/wallet/refund/eligible-transactions');
    return data;
  },

  requestRefund: async (amountCents: number, fundingTransactionId: string): Promise<RefundResponse> => {
    const { data } = await api.post('/wallet/refund/request', {
      amount_cents: amountCents,
      funding_transaction_id: fundingTransactionId,
    });
    return data;
  },

  getRefundHistory: async (): Promise<RefundHistoryItem[]> => {
    const { data } = await api.get('/wallet/refund/history');
    return data;
  },

  // Cryptographic proof endpoints
  createProof: async (proofType: string, proofData: any): Promise<any> => {
    const { data } = await api.post('/wallet/create-proof', {
      proof_type: proofType,
      proof_data: proofData,
    });
    return data;
  },

  verifyProof: async (proofId: string, signature: string): Promise<any> => {
    const { data } = await api.post('/wallet/verify-proof', {
      proof_id: proofId,
      signature: signature,
    });
    return data;
  },

  getUserProofs: async (): Promise<any> => {
    const { data } = await api.get('/wallet/proofs');
    return data;
  },

  // Biometric verification endpoints
  generateBiometricChallenge: async (): Promise<any> => {
    const { data } = await api.post('/wallet/biometric-challenge');
    return data;
  },

  verifyBiometricResponse: async (challenge: string, biometricHash: string): Promise<any> => {
    const { data } = await api.post('/wallet/biometric-verify', {
      challenge: challenge,
      biometric_hash: biometricHash,
    });
    return data;
  },

  // Ghost Pass revocation
  revokeGhostPass: async (ghostPassToken: string, reason: string = 'Manual revocation'): Promise<any> => {
    const { data } = await api.post('/wallet/revoke-ghost-pass', {
      ghost_pass_token: ghostPassToken,
      reason: reason,
    });
    return data;
  },

  // Anonymous wallet surfacing (fast entry flow)
  surfaceWalletAnonymous: async (params: {
    device_fingerprint: string;
    venue_id?: string;
    event_name?: string;
    venue_name?: string;
    entry_fee_cents?: number;
  }): Promise<any> => {
    const { data } = await api.post('/wallet/surface-wallet-anonymous', params);
    return data;
  },

  // Admin fee distribution endpoints
  getFeeDistribution: async (): Promise<any> => {
    const { data } = await api.get('/wallet/admin/fee-distribution');
    return data;
  },

  setFeeDistribution: async (
    validPercentage: number,
    vendorPercentage: number,
    poolPercentage: number,
    promoterPercentage: number
  ): Promise<any> => {
    const { data } = await api.post('/wallet/admin/fee-distribution', {}, {
      params: {
        valid_percentage: validPercentage,
        vendor_percentage: vendorPercentage,
        pool_percentage: poolPercentage,
        promoter_percentage: promoterPercentage,
      }
    });
    return data;
  },

  // Admin platform fee setting
  setPlatformFee: async (feeCents: number, context: string = 'general'): Promise<any> => {
    const { data } = await api.post('/wallet/admin/platform-fee', {}, {
      params: {
        fee_cents: feeCents,
        context: context,
      }
    });
    return data;
  },

  // Vendor payout processing
  processVendorPayouts: async (vendorId?: string): Promise<any> => {
    const { data } = await api.post('/wallet/admin/process-vendor-payouts', {
      vendor_id: vendorId,
    });
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

  getPricing: async () => {
    const { data } = await api.get('/ghostpass/pricing');
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

  createEntryPoint: async (entryPoint: { 
    name: string; 
    status: 'ENABLED' | 'DISABLED';
    employee_name: string;
    employee_id: string;
    visual_identifier?: string;
  }) => {
    const { data } = await api.post('/gateway/points', {
      ...entryPoint,
      type: 'ENTRY_POINT'
    });
    return data;
  },

  updateEntryPoint: async (id: string, updates: { 
    name?: string; 
    status?: 'ENABLED' | 'DISABLED';
    employee_name?: string;
    employee_id?: string;
    visual_identifier?: string;
  }) => {
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
    status: 'ENABLED' | 'DISABLED';
    employee_name: string;
    employee_id: string;
    visual_identifier?: string;
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
    status?: 'ENABLED' | 'DISABLED';
    employee_name?: string;
    employee_id?: string;
    visual_identifier?: string;
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
    status: 'ENABLED' | 'DISABLED';
    employee_name: string;
    employee_id: string;
    visual_identifier?: string;
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
    status?: 'ENABLED' | 'DISABLED';
    employee_name?: string;
    employee_id?: string;
    visual_identifier?: string;
  }) => {
    const { data } = await api.put(`/gateway/points/${id}`, updates);
    return data;
  },

  deleteTableSeat: async (id: string) => {
    const { data } = await api.delete(`/gateway/points/${id}`);
    return data;
  },

  // Metrics
  getMetrics: async (pointId: string) => {
    const { data } = await api.get(`/gateway/metrics/${pointId}`);
    return data;
  },

  getAllMetrics: async (type?: 'ENTRY_POINT' | 'INTERNAL_AREA' | 'TABLE_SEAT') => {
    const params = type ? { type } : {};
    const { data } = await api.get('/gateway/metrics', { params });
    return data;
  },

  recordMetric: async (metric: {
    gateway_point_id: string;
    metric_type: 'QR_SCAN' | 'TRANSACTION' | 'SALE';
    amount_cents?: number;
    metadata?: Record<string, any>;
  }) => {
    const { data } = await api.post('/gateway/metrics/record', metric);
    return data;
  },

  // Financial Distribution (Read-Only)
  getFinancialDistribution: async () => {
    const { data } = await api.get('/gateway/financial-distribution');
    return data;
  }
};

// Audit API - ENTRY POINT AUDIT TRAIL
export const auditApi = {
  // Get audit logs with filtering
  getEntryPointAuditLogs: async (params?: {
    entry_point_id?: string;
    employee_name?: string;
    action_type?: 'SCAN' | 'CREATE' | 'EDIT' | 'DEACTIVATE' | 'ACTIVATE' | 'DELETE';
    start_date?: string;
    end_date?: string;
    source_location?: string;
    limit?: number;
    offset?: number;
  }) => {
    const { data } = await api.get('/audit/entry-point', { params });
    return data;
  },

  // Log manual audit action
  logEntryPointAction: async (auditData: {
    action_type: 'SCAN' | 'CREATE' | 'EDIT' | 'DEACTIVATE' | 'ACTIVATE' | 'DELETE';
    entry_point_id: string;
    source_location: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    metadata?: Record<string, any>;
  }) => {
    const { data } = await api.post('/audit/entry-point', auditData);
    return data;
  },

  // Get audit summary statistics
  getAuditSummary: async (days: number = 30) => {
    const { data } = await api.get('/audit/summary', {
      params: { days }
    });
    return data;
  },

  // Get complete history for specific entry point
  getEntryPointHistory: async (entryPointId: string, limit: number = 50) => {
    const { data } = await api.get('/audit/history', {
      params: { entry_point_id: entryPointId, limit }
    });
    return data;
  },

  // Get activity for specific employee
  getEmployeeActivity: async (employeeName: string, days: number = 7, limit: number = 100) => {
    const { data } = await api.get('/audit/employee-activity', {
      params: { employee_name: employeeName, days, limit }
    });
    return data;
  },

  // Get recent scan activity
  getRecentScans: async (hours: number = 24, limit: number = 50) => {
    const { data } = await api.get('/audit/recent-scans', {
      params: { hours, limit }
    });
    return data;
  },

  // Clean up old audit logs (admin only)
  cleanupOldLogs: async (daysToKeep: number = 90) => {
    const { data } = await api.delete('/audit/entry-point/cleanup', {
      params: { days_to_keep: daysToKeep }
    });
    return data;
  }
};
// Sensory System API - SENSORY CARGO MONITOR
export const sensoryApi = {
  // Get SCUs for monitoring
  getSignals: async (limit: number = 50, offset: number = 0) => {
    const { data } = await api.get('/sensory-monitor/signals', {
      params: { limit, offset }
    });
    return data;
  },

  // Get system statistics
  getStats: async () => {
    const { data } = await api.get('/sensory-monitor/stats');
    return data;
  },

  // Get Senate statistics
  getSenateStats: async () => {
    const { data } = await api.get('/senate/stats');
    return data;
  },

  // Get Senate decision history
  getSenateHistory: async (limit: number = 50) => {
    const { data } = await api.get('/senate/history', {
      params: { limit }
    });
    return data;
  },

  // Get pending Senate evaluations
  getPendingEvaluations: async () => {
    const { data } = await api.get('/senate/pending');
    return data;
  },

  // Submit Senate decision
  submitDecision: async (decision: {
    signal_id: string;
    decision: string;
    reason: string;
    reviewer_id: string;
    trust_score: number;
  }) => {
    const { data } = await api.post('/senate/evaluate', decision);
    return data;
  },

  // Get specific evaluation details
  getEvaluationDetails: async (evaluationId: string) => {
    const { data } = await api.get(`/senate/pending/${evaluationId}`);
    return data;
  },

  // Send test SCU (development only)
  sendTestSignal: async (signal: {
    schema_version: string;
    sensory_type: string;
    signal_data: any;
    metadata: {
      timestamp: string;
      source_id: string;
      integrity_hash: string;
    };
  }) => {
    const { data } = await api.post('/conduit/receive', signal);
    return data;
  },

  // Send test capsule (development only)
  sendTestCapsule: async (capsule: {
    capsule_id: string;
    timestamp: string;
    source_id: string;
    scus: any[];
  }) => {
    const { data } = await api.post('/conduit/receive', capsule);
    return data;
  },

  // Log audit entry for SCU processing
  logAuditEntry: async (entry: {
    signal_id: string;
    sensory_type: string;
    timestamp: string;
    outcome: string;
    metadata?: Record<string, any>;
  }) => {
    const { data } = await api.post('/sensory-monitor/audit', entry);
    return data;
  },

  // Get audit trail for an SCU
  getAuditTrail: async (signalId: string) => {
    const { data } = await api.get(`/sensory-monitor/audit/${signalId}`);
    return data;
  }
};

// Environment Configuration API
export const environmentApi = {
  // Get current environment mode
  getMode: async () => {
    const { data } = await api.get('/environment/mode');
    return data;
  },

  // Get all sensory channel statuses
  getSensoryChannels: async () => {
    const { data } = await api.get('/environment/sensory-channels');
    return data;
  },

  // Get specific sensory channel status
  getSensoryChannelStatus: async (sensoryType: string) => {
    const { data } = await api.get(`/environment/sensory-channels/${sensoryType}`);
    return data;
  },

  // Get authority policies
  getAuthorityPolicies: async () => {
    const { data } = await api.get('/environment/authority-policies');
    return data;
  }
};
// Scan API - QR and NFC validation
export const scanApi = {
  validateQRScan: async (passId: string, gatewayId: string, venueId: string): Promise<any> => {
    const { data } = await api.post('/scan/validate', {
      pass_id: passId,
      gateway_id: gatewayId,
      venue_id: venueId,
      interaction_method: 'QR'
    });
    return data;
  },

  validateNFCScan: async (passId: string, gatewayId: string, venueId: string): Promise<any> => {
    const { data } = await api.post('/scan/nfc', {
      pass_id: passId,
      gateway_id: gatewayId,
      venue_id: venueId,
      interaction_method: 'NFC'
    });
    return data;
  },

  getPlatformFeeStatus: async (): Promise<any> => {
    const { data } = await api.get('/scan/platform-fee-status');
    return data;
  },

  getVenueStats: async (venueId: string): Promise<any> => {
    const { data } = await api.get(`/scan/venue/${venueId}/stats`);
    return data;
  }
};


// Venue Admin API - REQUIRES VENUE_ADMIN OR ADMIN ROLE
export const venueApi = {
  // Get venue dashboard (all data)
  getDashboard: async (venueId?: string, eventId?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (eventId) params.append('event_id', eventId);
    
    const { data } = await api.get(`/venue/dashboard?${params.toString()}`);
    return data;
  },

  // Get venue entry configuration
  getConfig: async (venueId?: string, eventId?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (eventId) params.append('event_id', eventId);
    
    const { data } = await api.get(`/venue/config?${params.toString()}`);
    return data;
  },

  // Update venue entry configuration
  updateConfig: async (config: {
    venue_id?: string;
    event_id?: string;
    re_entry_allowed: boolean;
    initial_entry_fee_cents: number;
    venue_reentry_fee_cents: number;
    valid_reentry_scan_fee_cents: number;
    max_reentries?: number;
    reentry_time_limit_hours?: number;
  }) => {
    const { data } = await api.post('/venue/config', config);
    return data;
  },

  // Get venue statistics
  getStats: async (venueId?: string, eventId?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (eventId) params.append('event_id', eventId);
    
    const { data } = await api.get(`/venue/stats?${params.toString()}`);
    return data;
  },

  // Get vendor payouts for venue/event
  getVendorPayouts: async (venueId?: string, eventId?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (eventId) params.append('event_id', eventId);
    
    const { data } = await api.get(`/venue/payouts?${params.toString()}`);
    return data;
  },

  // Get audit logs for venue/event
  getAuditLogs: async (venueId?: string, eventId?: string, limit: number = 50) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (eventId) params.append('event_id', eventId);
    params.append('limit', limit.toString());
    
    const { data } = await api.get(`/venue/audit-logs?${params.toString()}`);
    return data;
  }
};
