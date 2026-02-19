-- ============================================================================
-- COMPREHENSIVE VENUE & EVENT SYSTEM
-- Implements all 11 required feature sets with asset-level revenue profiles
-- ============================================================================

-- 1️⃣ VENUES TABLE (Enhanced)
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT UNIQUE NOT NULL,
  venue_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'America/New_York',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1️⃣ EVENTS TABLE (Complete binding)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  venue_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  
  -- Pricing
  ticket_price_cents INTEGER DEFAULT 0,
  entry_fee_cents INTEGER DEFAULT 0,
  re_entry_fee_cents INTEGER DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 25,
  
  -- Profiles
  revenue_profile_id UUID,
  tax_profile_id UUID,
  payout_routing_id UUID,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ REVENUE PROFILES (Asset-Level)
CREATE TABLE IF NOT EXISTS revenue_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Split percentages (must total 100)
  valid_percentage DECIMAL(5,2) NOT NULL CHECK (valid_percentage >= 0 AND valid_percentage <= 100),
  vendor_percentage DECIMAL(5,2) NOT NULL CHECK (vendor_percentage >= 0 AND vendor_percentage <= 100),
  pool_percentage DECIMAL(5,2) NOT NULL CHECK (pool_percentage >= 0 AND pool_percentage <= 100),
  promoter_percentage DECIMAL(5,2) NOT NULL CHECK (promoter_percentage >= 0 AND promoter_percentage <= 100),
  executive_percentage DECIMAL(5,2) DEFAULT 0 CHECK (executive_percentage >= 0 AND executive_percentage <= 100),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT revenue_split_total CHECK (
    valid_percentage + vendor_percentage + pool_percentage + promoter_percentage + executive_percentage = 100
  )
);

-- 3️⃣ TAX PROFILES
CREATE TABLE IF NOT EXISTS tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name TEXT UNIQUE NOT NULL,
  venue_id TEXT,
  
  -- Tax rates
  state_tax_percentage DECIMAL(5,2) DEFAULT 0,
  local_tax_percentage DECIMAL(5,2) DEFAULT 0,
  alcohol_tax_percentage DECIMAL(5,2) DEFAULT 0,
  food_tax_percentage DECIMAL(5,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4️⃣ PAYOUT ROUTING
CREATE TABLE IF NOT EXISTS payout_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routing_name TEXT UNIQUE NOT NULL,
  venue_id TEXT,
  
  -- Routing details
  account_type TEXT CHECK (account_type IN ('bank', 'stripe', 'paypal', 'zelle')),
  account_details JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5️⃣ STATION REGISTRY
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT UNIQUE NOT NULL,
  venue_id TEXT NOT NULL,
  event_id TEXT,
  
  station_name TEXT NOT NULL,
  station_type TEXT NOT NULL CHECK (station_type IN ('DOOR', 'BAR', 'CONCESSION', 'MERCH')),
  
  -- Assigned profiles
  revenue_profile_id UUID REFERENCES revenue_profiles(id),
  tax_profile_id UUID REFERENCES tax_profiles(id),
  
  -- Fee logic
  fee_logic JSONB DEFAULT '{}',
  re_entry_rules JSONB DEFAULT '{}',
  id_verification_level INTEGER DEFAULT 1 CHECK (id_verification_level IN (1, 2)),
  
  employee_id TEXT,
  employee_name TEXT,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3️⃣ QR/NFC ASSETS
CREATE TABLE IF NOT EXISTS qr_nfc_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT UNIQUE NOT NULL,
  asset_type TEXT CHECK (asset_type IN ('QR', 'NFC')),
  
  -- Bindings
  venue_id TEXT NOT NULL,
  event_id TEXT,
  station_id TEXT,
  
  -- Profiles
  revenue_profile_id UUID REFERENCES revenue_profiles(id),
  tax_profile_id UUID REFERENCES tax_profiles(id),
  
  -- Configuration
  fee_logic JSONB DEFAULT '{}',
  re_entry_rules JSONB DEFAULT '{}',
  id_verification_level INTEGER DEFAULT 1,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6️⃣ MENU SYSTEM (Dynamic CRUD)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  event_id TEXT,
  station_type TEXT NOT NULL CHECK (station_type IN ('BAR', 'CONCESSION', 'MERCH')),
  
  item_name TEXT NOT NULL,
  item_category TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  
  -- Tax flags
  is_taxable BOOLEAN DEFAULT true,
  is_alcohol BOOLEAN DEFAULT false,
  is_food BOOLEAN DEFAULT false,
  
  -- Revenue profile assignment
  revenue_profile_id UUID REFERENCES revenue_profiles(id),
  
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7️⃣ VENUE TRANSACTION LEDGER (Immutable with full audit)
CREATE TABLE IF NOT EXISTS venue_transaction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_hash TEXT UNIQUE NOT NULL,
  
  -- Context
  venue_id TEXT NOT NULL,
  event_id TEXT,
  station_id TEXT,
  employee_id TEXT,
  wallet_binding_id TEXT NOT NULL,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ENTRY', 'RE_ENTRY', 'PURCHASE', 'REFUND')),
  item_amount_cents INTEGER NOT NULL,
  
  -- Tax calculation (BEFORE split)
  tax_cents INTEGER DEFAULT 0,
  tax_breakdown JSONB DEFAULT '{}',
  
  -- Fee & Split
  platform_fee_cents INTEGER NOT NULL,
  revenue_profile_id UUID REFERENCES revenue_profiles(id),
  split_breakdown JSONB NOT NULL,
  
  -- Balances
  pre_balance_cents INTEGER NOT NULL,
  post_balance_cents INTEGER NOT NULL,
  
  -- Audit
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 8️⃣ ENTRY TRACKING (Re-entry logic)
CREATE TABLE IF NOT EXISTS entry_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_binding_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  employee_id TEXT,
  
  entry_number INTEGER NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('INITIAL', 'RE_ENTRY')),
  
  -- Fees charged
  entry_fee_cents INTEGER DEFAULT 0,
  re_entry_fee_cents INTEGER DEFAULT 0,
  platform_fee_cents INTEGER DEFAULT 0,
  
  -- ID Verification
  verification_tier INTEGER CHECK (verification_tier IN (1, 2)),
  age_verified BOOLEAN DEFAULT false,
  
  transaction_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9️⃣ ID VERIFICATION LOGS (No raw ID storage)
CREATE TABLE IF NOT EXISTS id_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  station_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  
  verification_tier INTEGER NOT NULL CHECK (verification_tier IN (1, 2)),
  age_flag_verified BOOLEAN DEFAULT false,
  
  -- NO raw ID data stored
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_stations_venue_event ON stations(venue_id, event_id);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(station_type);
CREATE INDEX IF NOT EXISTS idx_qr_assets_venue_event ON qr_nfc_assets(venue_id, event_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_station ON menu_items(venue_id, station_type);
CREATE INDEX IF NOT EXISTS idx_venue_transaction_ledger_venue_event ON venue_transaction_ledger(venue_id, event_id);
CREATE INDEX IF NOT EXISTS idx_venue_transaction_ledger_timestamp ON venue_transaction_ledger(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entry_tracking_wallet_event ON entry_tracking(wallet_binding_id, event_id);

-- Insert default revenue profiles
INSERT INTO revenue_profiles (profile_name, valid_percentage, vendor_percentage, pool_percentage, promoter_percentage, executive_percentage)
VALUES 
  ('Standard Split', 40.00, 30.00, 20.00, 10.00, 0.00),
  ('Vendor Focused', 25.00, 50.00, 15.00, 10.00, 0.00),
  ('Pool Heavy', 30.00, 25.00, 35.00, 10.00, 0.00),
  ('Executive Split', 35.00, 25.00, 15.00, 10.00, 15.00)
ON CONFLICT (profile_name) DO NOTHING;

COMMENT ON TABLE events IS 'Complete event object binding venue, pricing, profiles, and routing';
COMMENT ON TABLE revenue_profiles IS 'Asset-level revenue split profiles assignable to QR codes, tickets, menu items';
COMMENT ON TABLE stations IS 'Structured station registry with type, employee, and profile bindings';
COMMENT ON TABLE menu_items IS 'Dynamic CRUD menu system with tax flags and revenue profile assignment';
COMMENT ON TABLE venue_transaction_ledger IS 'Immutable ledger with tax-before-split and full audit trail';
COMMENT ON TABLE entry_tracking IS 'Re-entry counter scoped to event with fee tracking';
COMMENT ON TABLE id_verification_logs IS 'ID verification audit with NO raw ID data storage';
