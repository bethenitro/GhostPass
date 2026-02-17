-- ============================================
-- GhostPass Stress Test - Pre-Test Setup SQL
-- Run this ONCE in Supabase SQL Editor before starting tests
-- ============================================

-- ============================================
-- 1. CREATE REQUIRED INDEXES FOR PERFORMANCE
-- ============================================

-- Wallets table indexes
CREATE INDEX IF NOT EXISTS idx_wallets_device_fingerprint 
  ON wallets(device_fingerprint);
  
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_binding_id 
  ON wallets(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
  ON wallets(user_id);

-- Entry events table indexes (this is the main entry log table)
CREATE INDEX IF NOT EXISTS idx_entry_events_wallet_binding_id 
  ON entry_events(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_events_venue_id 
  ON entry_events(venue_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_events_timestamp 
  ON entry_events(timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_entry_events_receipt_id 
  ON entry_events(receipt_id);

-- Entry logs table indexes (if used)
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_binding_id 
  ON entry_logs(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_venue_id 
  ON entry_logs(venue_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_timestamp 
  ON entry_logs(timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_receipt_id 
  ON entry_logs(receipt_id);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id 
  ON transactions(wallet_id);
  
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
  ON transactions(timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_transactions_type 
  ON transactions(type);

-- Gateway points table indexes
CREATE INDEX IF NOT EXISTS idx_gateway_points_venue_id 
  ON gateway_points(venue_id);

-- ============================================
-- 2. VERIFY INDEXES WERE CREATED
-- ============================================
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('wallets', 'entry_events', 'entry_logs', 'transactions', 'gateway_points')
ORDER BY tablename, indexname;

-- Expected output: You should see all the indexes listed above

-- ============================================
-- 3. CHECK CURRENT DATABASE STATE
-- ============================================

-- Check existing test data
SELECT 
  'Existing Test Wallets' as metric,
  COUNT(*) as count
FROM wallets
WHERE wallet_binding_id LIKE 'wallet_test_%'
UNION ALL
SELECT 
  'Existing Test Entries',
  COUNT(*)
FROM entry_events
WHERE timestamp >= NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'Existing Test Transactions',
  COUNT(*)
FROM transactions
WHERE timestamp >= NOW() - INTERVAL '1 hour';

-- ============================================
-- 4. OPTIONAL: CLEAN UP OLD TEST DATA
-- ============================================
-- Uncomment these lines if you want to clean up old test data

-- DELETE FROM entry_events WHERE wallet_binding_id LIKE 'wallet_test_%';
-- DELETE FROM transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE wallet_binding_id LIKE 'wallet_test_%');
-- DELETE FROM wallets WHERE wallet_binding_id LIKE 'wallet_test_%';

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Next steps:
-- 1. Run: npm run seed-test-data
-- 2. Run: npm run test:full
-- 3. Run: npm run validate-results
