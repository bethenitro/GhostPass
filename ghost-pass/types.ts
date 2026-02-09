import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database
export type DatabaseClient = SupabaseClient;

// Enums
export type UserRole = 'USER' | 'VENDOR' | 'ADMIN';
export type RefundStatus = 'NONE' | 'PARTIAL' | 'FULL';
export type TransactionType = 'FUND' | 'SPEND' | 'FEE' | 'REFUND';
export type PassStatus = 'ACTIVE' | 'EXPIRED';

// Interfaces
export interface SessionRequest {
  token: string;
}

export interface SessionResponse {
  user_id: string;
  email: string;
  authenticated: boolean;
}

export interface FundingSourceAmount {
  source: string;
  amount: number;
}

export interface FundRequest {
  sources: FundingSourceAmount[];
}

export interface WalletBalance {
  balance_cents: number;
  balance_dollars: number;
  updated_at: string;
}

export interface RefundRequest {
  amount_cents: number;
  funding_transaction_id: string;
}

export interface RefundResponse {
  status: 'SUCCESS' | 'FAILED';
  refund_id?: string;
  original_transaction_id: string;
  amount_refunded_cents: number;
  processor_refund_id?: string;
  message: string;
  estimated_arrival?: string;
}

export interface RefundHistoryItem {
  id: string;
  original_transaction_id: string;
  amount_cents: number;
  refund_status: RefundStatus;
  refund_reference_id?: string;
  requested_at: string;
  completed_at?: string;
  provider: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount_cents: number;
  balance_before_cents?: number;
  balance_after_cents?: number;
  vendor_name?: string;
  gateway_id?: string;
  gateway_name?: string;
  gateway_type?: string;
  venue_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  refund_status?: RefundStatus;
}

export interface PurchaseRequest {
  duration: 1 | 3 | 7;
}

export interface PurchaseResponse {
  pass_id: string;
  duration_days: number;
  expires_at: string;
  price_cents: number;
  message: string;
}

export interface GhostPass {
  id: string;
  user_id: string;
  purchased_at: string;
  expires_at: string;
  duration_days: number;
  price_cents: number;
  status: PassStatus;
  is_active: boolean;
}

export interface GhostPass {
  id: string;
  user_id: string;
  purchased_at: string;
  expires_at: string;
  duration_days: number;
  price_cents: number;
  status: PassStatus;
  is_active: boolean;
}