export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface GhostPass {
  id: string;
  user_id: string;
  status: 'ACTIVE' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  venue_name?: string;
  qr_code?: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'FUND' | 'SPEND' | 'FEE';
  amount_cents: number;
  gateway_id?: string;
  venue_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WalletBalance {
  balance_cents: number;
  balance_dollars: number;
  updated_at: string;
}

export interface FundingSource {
  id: string;
  name: string;
  type: 'zelle' | 'stripe';
  enabled: boolean;
}

export interface PassPurchaseOption {
  duration: number; // days
  price: number;
  label: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}