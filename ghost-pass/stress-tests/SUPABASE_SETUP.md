# Supabase Setup for Stress Testing

## What SQL to Run and When

### STEP 1: Pre-Test Setup (Run Once Before Testing)

Open Supabase SQL Editor and run this:

```sql
-- ============================================
-- 1. CREATE REQUIRED INDEXES
-- ============================================
-- These indexes are CRITICAL for performance under load

-- Wallets table indexes
CREATE INDEX IF NOT EXISTS idx_wallets_device_fingerprint 
  ON wallets(device_fingerprint);
  
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_binding_id 
  ON wallets(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
  ON wallets(user_id);

-- Entry logs indexes
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_binding_id 
  ON entry_logs(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_venue_id 
  ON entry_logs(venue_id);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_entry_timestamp 
  ON entry_logs(entry_timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_entry_logs_receipt_id 
  ON entry_logs(receipt_id);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_binding_id 
  ON transactions(wallet_binding_id);
  
CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
  ON transactions(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_id 
  ON transactions(receipt_id);
  
CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON transactions(status);

-- Gateways table indexes
CREATE INDEX IF NOT EXISTS idx_gateways_venue_id 
  ON gateways(venue_id);
  
CREATE INDEX IF NOT EXISTS idx_gateways_gateway_id 
  ON gateways(gateway_id);

-- Venues table indexes
CREATE INDEX IF NOT EXISTS idx_venues_venue_id 
  ON venues(venue_id);

-- ============================================
-- 2. VERIFY INDEXES WERE CREATED
-- ============================================
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('wallets', 'entry_logs', 'transactions', 'gateways', 'venues')
ORDER BY tablename, indexname;

-- You should see all the indexes listed above
```

**Expected Output:**
You should see a list of all indexes including the ones you just created.

---

### STEP 2: During Testing (Monitor in Real-Time)

While your k6 tests are running, use these queries to monitor system health.

#### Option A: Quick Health Check (Run Every 30 seconds)

```sql
-- Quick system health snapshot
SELECT 
  'Active Connections' as metric,
  COUNT(*) as value
FROM pg_stat_activity
WHERE datname = current_database()
UNION ALL
SELECT 
  'Entry Logs (last 1 min)' as metric,
  COUNT(*) as value
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 
  'Transactions (last 1 min)' as metric,
  COUNT(*) as value
FROM transactions
WHERE created_at >= NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 
  'Failed Transactions (last 1 min)' as metric,
  COUNT(*) as value
FROM transactions
WHERE created_at >= NOW() - INTERVAL '1 minute'
  AND status = 'failed';
```

#### Option B: Detailed Monitoring (Run Every 1-2 minutes)

```sql
-- 1. Check for locks (should be empty or minimal)
SELECT 
  pg_class.relname as table_name,
  pg_locks.mode as lock_mode,
  COUNT(*) as lock_count
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
WHERE pg_class.relkind = 'r'
  AND NOT pg_locks.granted
GROUP BY pg_class.relname, pg_locks.mode
ORDER BY lock_count DESC;

-- 2. Check for slow queries (should be empty)
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  LEFT(query, 100) as query_preview,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- 3. Check throughput (entries and transactions per minute)
SELECT 
  DATE_TRUNC('minute', entry_timestamp) as minute,
  COUNT(*) as entries_per_minute
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '5 minutes'
GROUP BY DATE_TRUNC('minute', entry_timestamp)
ORDER BY minute DESC;

SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as transactions_per_minute,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
FROM transactions
WHERE created_at >= NOW() - INTERVAL '5 minutes'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
```

---

### STEP 3: After Testing (Validation Queries)

Run these after your stress test completes:

```sql
-- ============================================
-- POST-TEST VALIDATION QUERIES
-- ============================================

-- 1. Check for negative balances (should be 0)
SELECT 
  COUNT(*) as negative_balance_count,
  MIN(balance_cents) as lowest_balance
FROM wallets
WHERE balance_cents < 0;

-- 2. Check for duplicate entries (should be 0)
SELECT 
  wallet_binding_id,
  venue_id,
  gateway_id,
  entry_timestamp,
  COUNT(*) as duplicate_count
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '30 minutes'
GROUP BY wallet_binding_id, venue_id, gateway_id, entry_timestamp
HAVING COUNT(*) > 1;

-- 3. Check for orphaned funding (should be minimal)
SELECT 
  COUNT(*) as orphaned_funding_count
FROM transactions
WHERE status = 'pending'
  AND type = 'credit'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- 4. Check transaction failure rate
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate_percent
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 minutes';

-- 5. Check wallet balance consistency (sample check)
SELECT 
  w.wallet_binding_id,
  w.balance_cents as current_balance,
  COALESCE(SUM(
    CASE 
      WHEN t.type IN ('credit', 'FUND') THEN t.amount_cents
      ELSE -t.amount_cents
    END
  ), 0) as calculated_balance,
  w.balance_cents - COALESCE(SUM(
    CASE 
      WHEN t.type IN ('credit', 'FUND') THEN t.amount_cents
      ELSE -t.amount_cents
    END
  ), 0) as difference
FROM wallets w
LEFT JOIN transactions t ON t.wallet_binding_id = w.wallet_binding_id
WHERE w.wallet_binding_id LIKE 'wallet_test_%'
GROUP BY w.wallet_binding_id, w.balance_cents
HAVING ABS(w.balance_cents - COALESCE(SUM(
    CASE 
      WHEN t.type IN ('credit', 'FUND') THEN t.amount_cents
      ELSE -t.amount_cents
    END
  ), 0)) > 100
LIMIT 10;

-- 6. Overall test summary
SELECT 
  'Total Test Wallets' as metric,
  COUNT(*) as value
FROM wallets
WHERE wallet_binding_id LIKE 'wallet_test_%'
UNION ALL
SELECT 
  'Total Entries (30 min)',
  COUNT(*)
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '30 minutes'
UNION ALL
SELECT 
  'Total Transactions (30 min)',
  COUNT(*)
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 minutes'
UNION ALL
SELECT 
  'Unique Active Wallets',
  COUNT(DISTINCT wallet_binding_id)
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '30 minutes';
```

---

## What About db-monitor.sql?

The `monitoring/db-monitor.sql` file contains ALL the monitoring queries in one file. You have 3 options:

### Option 1: Run Individual Queries (Recommended for Beginners)
Copy-paste the specific queries above into Supabase SQL Editor as needed.

### Option 2: Run Entire File (Advanced)
If you have `psql` command-line access:
```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Run all monitoring queries
psql $DATABASE_URL -f monitoring/db-monitor.sql
```

### Option 3: Use Node.js Script (Coming Soon)
```bash
npm run monitor:db
```
This would run the queries automatically and display results in terminal.

---

## Quick Reference: What to Run When

| When | What to Run | Why |
|------|-------------|-----|
| **Before Testing** | Index creation queries | Ensure database is optimized |
| **During Testing** | Quick health check every 30s | Monitor system in real-time |
| **During Testing** | Detailed monitoring every 1-2 min | Catch issues early |
| **After Testing** | Validation queries | Verify success criteria |
| **After Testing** | `npm run validate-results` | Automated validation |

---

## Supabase Dashboard Monitoring

You can also monitor without SQL:

1. **Database > Logs** - See query logs in real-time
2. **Database > Roles** - Check connection count
3. **Database > Extensions** - Verify pg_stat_statements is enabled
4. **Reports** - View performance metrics

---

## Troubleshooting

### "Too many connections" error
```sql
-- Check current connections
SELECT COUNT(*) FROM pg_stat_activity;

-- See what's using connections
SELECT 
  state,
  COUNT(*) 
FROM pg_stat_activity 
GROUP BY state;
```

**Fix:** Increase connection limit in Supabase Dashboard > Settings > Database

### Slow queries
```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Fix:** Add missing indexes or optimize queries

### High lock contention
```sql
-- Check for blocking queries
SELECT 
  blocked_activity.pid AS blocked_pid,
  blocking_activity.pid AS blocking_pid,
  blocked_activity.query AS blocked_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Fix:** Review transaction isolation levels and optimize concurrent writes

---

## Summary

**Minimum Required SQL:**
1. Run index creation queries ONCE before testing
2. Run validation queries ONCE after testing
3. Optionally monitor during testing with health check queries

The `npm run validate-results` script will handle most validation automatically, but these SQL queries give you deeper insight into what's happening.
