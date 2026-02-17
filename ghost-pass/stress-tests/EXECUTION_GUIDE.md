# GhostPass Stress Test Execution Guide

## Complete Step-by-Step Instructions

This guide walks you through executing the complete 5,000-user pilot stress test for GhostPass.

---

## Phase 1: Pre-Test Setup (1-2 hours)

### Step 1: Install k6

**macOS:**
```bash
brew install k6
```

**Linux (Ubuntu/Debian):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```powershell
choco install k6
```

**Verify installation:**
```bash
k6 version
```

### Step 2: Install Node.js Dependencies

```bash
cd ghost-pass/stress-tests
npm install
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.test.example .env.test

# Edit with your values
nano .env.test
```

Required values:
- `API_BASE_URL`: Your deployed GhostPass API URL
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key (for admin operations)
- `TEST_VENUE_ID`: Unique ID for test venue
- `TEST_GATEWAY_1_ID` and `TEST_GATEWAY_2_ID`: Gateway IDs
- `STRIPE_TEST_KEY`: Stripe test secret key

### Step 4: Setup Supabase Database

**See `SUPABASE_SETUP.md` for complete SQL instructions.**

Quick version - Run this in Supabase SQL Editor:

```sql
-- Create required indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_wallets_device_fingerprint ON wallets(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_binding_id ON wallets(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_binding_id ON entry_logs(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_venue_id ON entry_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_entry_timestamp ON entry_logs(entry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entry_logs_receipt_id ON entry_logs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_binding_id ON transactions(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_id ON transactions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
```

Verify indexes were created:
```sql
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('wallets', 'entry_logs', 'transactions')
ORDER BY tablename;
```

### Step 5: Backup Database

```bash
# Create backup before testing
# In Supabase Dashboard: Database > Backups > Create Backup
```

### Step 6: Seed Test Data

```bash
npm run seed-test-data
```

This creates:
- 5,000 test wallets with $100 each
- Test venue and 2 gateways
- Test vendor items

**Expected output:**
```
🌱 Seeding Test Data for Stress Testing
═══════════════════════════════════════════════
📍 Creating test venue...
  ✅ Venue created: Stress Test Venue
🚪 Creating test gateways...
  ✅ Gateway created: Main Entrance - Door 1
  ✅ Gateway created: Main Entrance - Door 2
💰 Creating 5000 test wallets...
  ⏳ Created 1000/5000 wallets...
  ⏳ Created 2000/5000 wallets...
  ...
  ✅ Created 5000 wallets (0 errors)
🍔 Creating test vendor items...
  ✅ Item created: Beer - $8.00
  ...
✅ Test Data Seeding Complete
```

---

## Phase 2: Individual Component Tests (2-3 hours)

Run each test individually to validate components before full system test.

### Test A: Entry Scan System

```bash
npm run test:entry
```

**What it tests:**
- 200 scans/minute across 2 doors
- Duplicate entry validation
- Re-entry logic
- Audit logging

**Duration:** ~19 minutes

**Success criteria:**
- ✅ p95 response time < 500ms
- ✅ Success rate > 99.5%
- ✅ No duplicate entries

**Monitor during test:**
```bash
# In another terminal, watch database
watch -n 5 'psql $DATABASE_URL -c "SELECT COUNT(*) FROM entry_logs WHERE entry_timestamp > NOW() - INTERVAL '\''1 minute'\'';"'
```

### Test B: Concession Transactions

```bash
npm run test:concession
```

**What it tests:**
- 120 transactions/minute across 4 terminals
- Atomic wallet debits
- Platform fee calculation
- No double-charging

**Duration:** ~22 minutes

**Success criteria:**
- ✅ p95 response time < 800ms
- ✅ Success rate > 99.5%
- ✅ Zero negative balances
- ✅ Correct fee calculations

### Test C: Wallet Funding

```bash
npm run test:wallet
```

**What it tests:**
- 50 concurrent funding requests
- Stripe webhook flow
- Duplicate webhook handling
- Ledger consistency

**Duration:** ~20 minutes

**Success criteria:**
- ✅ p95 completion time < 5 seconds
- ✅ Success rate > 99.5%
- ✅ Zero duplicate credits

### Test D: Re-Entry Flow

```bash
npm run test:reentry
```

**What it tests:**
- Entry → Exit → Re-entry flow
- Entry count increments
- Re-entry fees apply correctly
- Separate logging

**Duration:** ~15 minutes

**Success criteria:**
- ✅ Re-entry fees calculated correctly
- ✅ Entry counts accurate
- ✅ All flows logged

---

## Phase 3: Full System Integration Test (30 minutes)

This is the main pilot readiness test.

### Pre-Flight Checklist

- [ ] All individual tests passed
- [ ] Database backup confirmed
- [ ] Monitoring dashboards open
- [ ] Team notified of test window
- [ ] Vercel function limits checked
- [ ] Supabase connection pool configured

### Execute Full Test

```bash
npm run test:full
```

**What it tests:**
- 5,000 unique wallets
- 2,000 concurrent active users
- 200 entry scans/minute
- 120 concession transactions/minute
- 50 concurrent wallet funding
- 50 re-entry flows/minute

**Duration:** 27 minutes

### Monitor in Real-Time

**Terminal 1: k6 test output**
```bash
npm run test:full
```

**Terminal 2: Database monitoring**

Option A - In Supabase SQL Editor, run this every 30 seconds:
```sql
-- Quick health check
SELECT 'Active Connections' as metric, COUNT(*) as value
FROM pg_stat_activity WHERE datname = current_database()
UNION ALL
SELECT 'Entry Logs (last 1 min)', COUNT(*)
FROM entry_logs WHERE entry_timestamp >= NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 'Transactions (last 1 min)', COUNT(*)
FROM transactions WHERE created_at >= NOW() - INTERVAL '1 minute';
```

Option B - If you have psql access:
```bash
watch -n 30 'psql $DATABASE_URL -c "SELECT COUNT(*) FROM entry_logs WHERE entry_timestamp > NOW() - INTERVAL '\''1 minute'\'';"'
```

See `SUPABASE_SETUP.md` for more monitoring queries.

**Terminal 3: API health**
```bash
# Monitor API response times
while true; do
  curl -w "@curl-format.txt" -o /dev/null -s "$API_BASE_URL/api/health"
  sleep 5
done
```

**Terminal 4: Error logs**
```bash
# Watch for errors in Vercel logs
vercel logs --follow
```

### Expected Output

```
execution: local
    script: scenarios/full-system-test.js
    output: -

scenarios: (100.00%) 4 scenarios, 380 max VUs, 27m30s max duration
           ✓ entry_scans ............... [ 100% ] 200/min
           ✓ concession_transactions ... [ 100% ] 120/min
           ✓ wallet_funding ............ [ 100% ] 50 VUs
           ✓ reentry_flow .............. [ 100% ] 50/min

✓ entry scan success
✓ entry scan < 500ms
✓ transaction success
✓ transaction < 800ms
✓ no negative balance
✓ funding initiated
✓ funding < 5000ms
✓ reentry processed
✓ reentry fee applied

checks.........................: 99.87% ✓ 45234    ✗ 59
data_received..................: 125 MB 4.6 MB/s
data_sent......................: 89 MB  3.3 MB/s
http_req_blocked...............: avg=1.23ms   min=0s      med=1ms     max=234ms   p(95)=3ms    p(99)=8ms
http_req_connecting............: avg=0.89ms   min=0s      med=0.7ms   max=189ms   p(95)=2ms    p(99)=5ms
http_req_duration..............: avg=287ms    min=45ms    med=234ms   max=1.2s    p(95)=456ms  p(99)=789ms
http_req_failed................: 0.13%  ✓ 59       ✗ 45234
http_req_receiving.............: avg=0.34ms   min=0.01ms  med=0.2ms   max=45ms    p(95)=1ms    p(99)=3ms
http_req_sending...............: avg=0.12ms   min=0.01ms  med=0.08ms  max=23ms    p(95)=0.3ms  p(99)=1ms
http_req_tls_handshaking.......: avg=0ms      min=0s      med=0ms     max=0s      p(95)=0s     p(99)=0s
http_req_waiting...............: avg=286ms    min=44ms    med=233ms   max=1.2s    p(95)=455ms  p(99)=788ms
http_reqs......................: 45293  1676/s
iteration_duration.............: avg=1.2s     min=234ms   med=1.1s    max=8.9s    p(95)=2.3s   p(99)=4.5s
iterations.....................: 45293  1676/s
vus............................: 50     min=50     max=380
vus_max........................: 380    min=380    max=380

✅ ALL THRESHOLDS PASSED
```

---

## Phase 4: Chaos Engineering Test (15 minutes)

Test system resilience under failure conditions.

```bash
npm run test:chaos
```

**What it tests:**
- Stripe webhook delays (15-30 seconds)
- Duplicate webhook delivery
- Scanner offline scenarios
- Terminal offline scenarios
- Database latency spikes

**Success criteria:**
- ✅ System stability > 95%
- ✅ Zero catastrophic failures
- ✅ Zero data corruption
- ✅ Graceful degradation

---

## Phase 5: Post-Test Validation (30 minutes)

### Step 1: Run Validation Script

```bash
npm run validate-results
```

**This checks:**
- ✅ 0 data corruption
- ✅ < 0.5% transaction failure
- ✅ No duplicate entries
- ✅ No negative wallet balances
- ✅ No orphaned Stripe funding states
- ✅ No unlogged transactions

**Expected output:**
```
🔍 Starting Post-Test Validation
═══════════════════════════════════════════════

📊 Checking for data corruption...
📊 Checking for duplicate entries...
📊 Checking for negative wallet balances...
📊 Checking for orphaned Stripe funding states...
📊 Checking for unlogged transactions...
📊 Checking transaction failure rate...
📊 Checking audit log completeness...

═══════════════════════════════════════════════
📋 VALIDATION RESULTS
═══════════════════════════════════════════════

✅ PASSED CHECKS:
   ✅ No data corruption detected
   ✅ No duplicate entries detected
   ✅ No negative wallet balances
   ✅ No orphaned funding states
   ✅ All transactions properly logged
   ✅ Transaction failure rate: 0.23% (< 0.5%)
   ✅ Audit logs: 5234 entries, 8901 transactions

═══════════════════════════════════════════════
✅ ALL VALIDATION CHECKS PASSED
🎉 GhostPass is PILOT READY!
═══════════════════════════════════════════════
```

### Step 2: Generate Report

```bash
npm run generate-report
```

Creates: `results/test-report-YYYY-MM-DD.md`

### Step 3: Database Health Check

Run final database queries:

```sql
-- Check for any lingering issues
SELECT * FROM monitoring/db-monitor.sql;

-- Verify no locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check connection count
SELECT COUNT(*) FROM pg_stat_activity;
```

### Step 4: Clean Up Test Data (Optional)

```bash
npm run rollback-test-data
```

---

## Interpreting Results

### ✅ PASS Criteria

GhostPass is pilot-ready if ALL of these are true:

1. **Performance**
   - Entry scans: p95 < 500ms ✅
   - Transactions: p95 < 800ms ✅
   - Wallet funding: p95 < 5000ms ✅

2. **Reliability**
   - Overall success rate > 99.5% ✅
   - Transaction failure rate < 0.5% ✅
   - System errors < 50 total ✅

3. **Data Integrity**
   - Zero data corruption ✅
   - Zero duplicate entries ✅
   - Zero negative balances ✅
   - Zero orphaned funding states ✅
   - All transactions logged ✅

4. **Resilience**
   - System stability > 95% under chaos ✅
   - Zero catastrophic failures ✅
   - Graceful degradation ✅

### ❌ FAIL Scenarios

If any of these occur, system is NOT pilot-ready:

- Response times exceed thresholds
- Success rate < 99.5%
- Any data corruption detected
- Duplicate entries found
- Negative wallet balances exist
- Orphaned Stripe funding states
- Unlogged transactions
- Catastrophic failures during chaos test

### ⚠️ Warning Scenarios

These require investigation but may not block pilot:

- Success rate 99.5-99.8% (marginal)
- Occasional timeout errors (< 10 total)
- Pending funding > 10 minutes (< 5 instances)
- Database connection spikes (if recovered)

---

## Troubleshooting

### Issue: k6 installation fails

**Solution:**
```bash
# Alternative: Use Docker
docker pull grafana/k6
docker run -i grafana/k6 run - <scenarios/entry-scan-test.js
```

### Issue: "Too many connections" error

**Solution:**
```sql
-- Increase Supabase connection limit
-- In Supabase Dashboard: Settings > Database > Connection Pooling
-- Set max connections to 100+
```

### Issue: Vercel function timeouts

**Solution:**
```bash
# Check Vercel function limits
vercel inspect

# Upgrade plan if needed for longer timeouts
```

### Issue: Stripe webhook failures

**Solution:**
```bash
# Use Stripe CLI for local testing
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Verify webhook secret matches
```

### Issue: Test data seeding fails

**Solution:**
```bash
# Reduce batch size in seed script
# Edit scripts/seed-test-data.js
# Change: const batchSize = 100; to const batchSize = 50;
```

---

## Next Steps After Passing

1. **Document Results**
   - Save all test reports
   - Screenshot key metrics
   - Document any warnings

2. **Capacity Planning**
   - Calculate cost at 5,000 users
   - Plan scaling strategy for 10,000+
   - Set up auto-scaling rules

3. **Monitoring Setup**
   - Configure production monitoring
   - Set up alerts for key metrics
   - Create runbooks for incidents

4. **Pilot Launch**
   - Schedule pilot start date
   - Prepare support team
   - Create incident response plan

---

## Support

For issues during testing:
- Check logs: `vercel logs --follow`
- Database issues: Supabase Dashboard > Logs
- k6 docs: https://k6.io/docs/
- GhostPass team: [your-contact]
