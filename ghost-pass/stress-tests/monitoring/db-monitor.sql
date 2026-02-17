-- Database Monitoring Queries for Stress Testing
-- Run these queries during stress tests to monitor database health

-- ============================================
-- 1. ACTIVE CONNECTIONS
-- ============================================
-- Monitor connection count and states
SELECT 
  state,
  COUNT(*) as connection_count,
  MAX(EXTRACT(EPOCH FROM (NOW() - state_change))) as max_duration_seconds
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY connection_count DESC;

-- ============================================
-- 2. LOCK MONITORING
-- ============================================
-- Check for table locks and lock escalation
SELECT 
  pg_class.relname as table_name,
  pg_locks.mode as lock_mode,
  pg_locks.granted,
  COUNT(*) as lock_count
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
WHERE pg_class.relkind = 'r'
GROUP BY pg_class.relname, pg_locks.mode, pg_locks.granted
ORDER BY lock_count DESC
LIMIT 20;

-- ============================================
-- 3. BLOCKING QUERIES
-- ============================================
-- Identify queries blocking other queries
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  blocked_activity.application_name AS blocked_application
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================
-- 4. TRANSACTION ROLLBACKS
-- ============================================
-- Monitor transaction rollback rate
SELECT 
  schemaname,
  relname as table_name,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_tup_hot_upd as hot_updates,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 20;

-- ============================================
-- 5. WRITE THROUGHPUT
-- ============================================
-- Monitor write operations per table
SELECT 
  relname as table_name,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_tup_ins + n_tup_upd + n_tup_del as total_writes,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY total_writes DESC
LIMIT 20;

-- ============================================
-- 6. INDEX USAGE
-- ============================================
-- Verify indexes are being used effectively
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- ============================================
-- 7. SLOW QUERIES
-- ============================================
-- Identify long-running queries
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- ============================================
-- 8. TABLE BLOAT
-- ============================================
-- Check for table bloat that could slow queries
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_tuple_percent DESC
LIMIT 20;

-- ============================================
-- 9. CACHE HIT RATIO
-- ============================================
-- Monitor buffer cache effectiveness
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 AS cache_hit_ratio
FROM pg_statio_user_tables;

-- ============================================
-- 10. GHOSTPASS SPECIFIC METRICS
-- ============================================

-- Entry logs per minute (last 10 minutes)
SELECT 
  DATE_TRUNC('minute', entry_timestamp) as minute,
  COUNT(*) as entries_per_minute,
  COUNT(DISTINCT wallet_binding_id) as unique_wallets,
  COUNT(DISTINCT gateway_id) as active_gateways
FROM entry_logs
WHERE entry_timestamp >= NOW() - INTERVAL '10 minutes'
GROUP BY DATE_TRUNC('minute', entry_timestamp)
ORDER BY minute DESC;

-- Transaction volume per minute
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as transactions_per_minute,
  SUM(CASE WHEN type = 'credit' THEN 1 ELSE 0 END) as credits,
  SUM(CASE WHEN type = 'debit' THEN 1 ELSE 0 END) as debits,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
FROM transactions
WHERE created_at >= NOW() - INTERVAL '10 minutes'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;

-- Wallet balance distribution
SELECT 
  CASE 
    WHEN balance_cents < 0 THEN 'NEGATIVE'
    WHEN balance_cents = 0 THEN 'ZERO'
    WHEN balance_cents < 1000 THEN '< $10'
    WHEN balance_cents < 5000 THEN '$10-$50'
    WHEN balance_cents < 10000 THEN '$50-$100'
    ELSE '> $100'
  END as balance_range,
  COUNT(*) as wallet_count,
  AVG(balance_cents) as avg_balance_cents
FROM wallets
GROUP BY balance_range
ORDER BY 
  CASE balance_range
    WHEN 'NEGATIVE' THEN 1
    WHEN 'ZERO' THEN 2
    WHEN '< $10' THEN 3
    WHEN '$10-$50' THEN 4
    WHEN '$50-$100' THEN 5
    ELSE 6
  END;

-- Recent errors and failures
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  status,
  COUNT(*) as count
FROM transactions
WHERE created_at >= NOW() - INTERVAL '10 minutes'
  AND status IN ('failed', 'error', 'pending')
GROUP BY DATE_TRUNC('minute', created_at), status
ORDER BY minute DESC, count DESC;
