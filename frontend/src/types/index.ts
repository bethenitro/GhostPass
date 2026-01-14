export interface User {
  id: string;
  email: string;
  role: 'USER' | 'VENDOR' | 'ADMIN';
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

export interface Session {
  id: string;
  user_id: string;
  session_type: '30_seconds' | '3_minutes' | '10_minutes';
  status: 'ACTIVE' | 'VAPORIZED';
  created_at: string;
  vaporizes_at: string;
  venue_id?: string;
  qr_code?: string;
}

export interface SessionStatusResponse {
  session: Session | null;
  can_create: boolean;
  message: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'FUND' | 'SPEND' | 'FEE';
  amount_cents: number;
  gateway_id?: string;
  gateway_name?: string;
  gateway_type?: 'ENTRY_POINT' | 'INTERNAL_AREA' | 'TABLE_SEAT';
  venue_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  balance_before_cents?: number;
  balance_after_cents?: number;
  vendor_name?: string;
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
// Admin Types
export interface AdminUser {
  id: string;
  email: string;
  role: 'USER' | 'VENDOR' | 'ADMIN';
  created_at: string;
}

export interface FeeConfig {
  id: string;
  venue_id: string;
  valid_pct: number;
  vendor_pct: number;
  pool_pct: number;
  promoter_pct: number;
}

export interface FeeConfigUpdate {
  venue_id?: string;
  valid_pct: number;
  vendor_pct: number;
  pool_pct: number;
  promoter_pct: number;
}

export interface ScanFeeUpdate {
  venue_id: string;
  fee_cents: number;
}

export interface GhostPassPricingUpdate {
  one_day_cents: number;
  three_day_cents: number;
  seven_day_cents: number;
}

export interface PayoutRequest {
  id: string;
  vendor_user_id: string;
  vendor_email: string;
  amount_cents: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
  notes?: string;
}

export interface PayoutAction {
  action: 'approve' | 'reject' | 'process';
  notes?: string;
}

export interface RetentionOverride {
  retention_days: number;
  justification: string;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SystemStats {
  total_users: number;
  total_wallets: number;
  total_balance_cents: number;
  active_passes: number;
  expired_passes: number;
  pending_payouts: number;
  total_transactions: number;
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
}

export interface AdminDashboard {
  stats: SystemStats;
  recent_transactions: Transaction[];
  pending_payouts: PayoutRequest[];
  recent_audit_logs: AuditLog[];
  current_fee_config?: {
    valid_pct: number;
    vendor_pct: number;
    pool_pct: number;
    promoter_pct: number;
  };
  current_scan_fees?: Record<string, number>;
  current_pricing?: {
    "1": number;
    "3": number;
    "7": number;
  };
  current_retention?: {
    retention_days: number;
  };
}

// Gateway Management Types
export type GatewayStatus = 'ENABLED' | 'DISABLED';
export type GatewayType = 'ENTRY_POINT' | 'INTERNAL_AREA' | 'TABLE_SEAT';

export interface EntryPoint {
  id: string;
  venue_id: string;
  name: string;
  status: GatewayStatus;
  type: 'ENTRY_POINT';
  created_at: string;
  updated_at: string;
}

export interface InternalArea {
  id: string;
  venue_id: string;
  name: string;
  number?: number;
  accepts_ghostpass: boolean;
  status: GatewayStatus;
  type: 'INTERNAL_AREA';
  created_at: string;
  updated_at: string;
}

export interface TableSeat {
  id: string;
  venue_id: string;
  name: string;
  number?: number;
  linked_area_id: string;
  status: GatewayStatus;
  type: 'TABLE_SEAT';
  created_at: string;
  updated_at: string;
}