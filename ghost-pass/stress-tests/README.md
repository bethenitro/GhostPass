# GhostPass 5,000-User Pilot Stress Test Protocol

## Overview

This stress test suite validates GhostPass readiness for a 5,000-user pilot with:
- 2 entry doors (simultaneous scans)
- 4 internal concession points (simultaneous transactions)
- Wallet funding + scanning + re-entry
- Full audit logging
- Zero bottlenecks

## Test Targets

### Load Specifications
- **5,000 unique wallet IDs**
- **2,000 concurrent active users**
- **200 scans per minute** at entry (combined doors)
- **120 transactions per minute** inside concessions
- **50 concurrent wallet funding requests**
- **Duration**: 20-30 minutes continuous
- **Failure Rate**: < 0.5%

### Performance Requirements
- Entry scan: < 500ms response time
- Concession transaction: < 800ms response time
- Wallet funding: 3-5 seconds average (including Stripe)
- CPU/Memory: Stable under load
- Zero data corruption
- Zero duplicate entries
- Zero negative wallet balances

## Prerequisites

### 1. Install k6
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### 2. Install Dependencies
```bash
cd ghost-pass/stress-tests
npm install
```

### 3. Environment Setup
Create `.env.test` file:
```env
API_BASE_URL=https://your-ghostpass-api.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
TEST_VENUE_ID=test-venue-001
TEST_GATEWAY_1_ID=gateway-door-1
TEST_GATEWAY_2_ID=gateway-door-2
STRIPE_TEST_KEY=sk_test_...
```

## Test Scenarios

### A. Entry Scan System Test
**File**: `scenarios/entry-scan-test.js`

Simulates:
- 2 QR/NFC entry points
- 100 scans per minute per door
- Duplicate entry validation
- Re-entry logic
- Audit logging

**Run**:
```bash
k6 run scenarios/entry-scan-test.js
```

### B. Concession Transaction Test
**File**: `scenarios/concession-test.js`

Simulates:
- 4 concession terminals
- 30 transactions per minute each
- Atomic wallet debits
- Platform fee calculation
- Revenue splits

**Run**:
```bash
k6 run scenarios/concession-test.js
```

### C. Wallet Funding Test
**File**: `scenarios/wallet-funding-test.js`

Simulates:
- 50 concurrent funding calls
- Stripe webhook flow
- Pending → Confirmed transitions
- Duplicate webhook handling

**Run**:
```bash
k6 run scenarios/wallet-funding-test.js
```

### D. Re-Entry Logic Test
**File**: `scenarios/reentry-test.js`

Simulates:
- User enters → exits → re-enters
- Entry count increments
- Re-entry fees apply correctly
- Separate logging

**Run**:
```bash
k6 run scenarios/reentry-test.js
```

### E. Full System Integration Test
**File**: `scenarios/full-system-test.js`

Combines all scenarios:
- 5,000 unique wallets
- 2,000 concurrent users
- All operations simultaneously
- 20-30 minute duration

**Run**:
```bash
k6 run scenarios/full-system-test.js
```

## Failure Simulation Tests

### F. Chaos Engineering Tests
**File**: `scenarios/failure-simulation-test.js`

Tests:
- Stripe webhook delay
- Stripe webhook duplication
- One scanner offline
- One concession offline
- Database latency spike

**Run**:
```bash
k6 run scenarios/failure-simulation-test.js
```

## Monitoring & Observability

### Real-Time Monitoring
```bash
# Run with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 scenarios/full-system-test.js

# Run with Grafana Cloud
k6 run --out cloud scenarios/full-system-test.js
```

### Database Monitoring
**File**: `monitoring/db-monitor.sql`

Queries to run during tests:
- Active connections
- Lock escalation
- Transaction rollbacks
- Index usage
- Write throughput

### Log Analysis
**File**: `monitoring/log-analyzer.js`

Structured log analysis:
- Error rate tracking
- 95th percentile latency
- Wallet mismatch detection
- Transaction failures

## Success Criteria Validation

After each test run, execute:
```bash
npm run validate-results
```

This checks:
- ✅ 0 data corruption
- ✅ < 0.5% transaction failure
- ✅ No duplicate entries
- ✅ No negative wallet balances
- ✅ No orphaned Stripe funding states
- ✅ No unlogged transactions

## Pre-Test Checklist

- [ ] Supabase database indexes verified
- [ ] Vercel serverless function limits checked
- [ ] Stripe webhook endpoint configured
- [ ] Test data seeded (5,000 wallets)
- [ ] Monitoring dashboards ready
- [ ] Backup database snapshot taken
- [ ] Team notified of test window

## Post-Test Analysis

1. **Generate Report**:
   ```bash
   npm run generate-report
   ```

2. **Review Metrics**:
   - Response time percentiles (p50, p95, p99)
   - Error rates by endpoint
   - Database query performance
   - Memory/CPU usage patterns

3. **Identify Bottlenecks**:
   - Slow queries
   - Connection pool exhaustion
   - API rate limits
   - Lock contention

4. **Document Findings**:
   - Update `results/test-report-YYYY-MM-DD.md`
   - Create GitHub issues for failures
   - Update capacity planning docs

## Emergency Procedures

If tests cause production issues:

1. **Stop Tests Immediately**:
   ```bash
   pkill k6
   ```

2. **Check System Health**:
   ```bash
   npm run health-check
   ```

3. **Rollback if Needed**:
   ```bash
   npm run rollback-test-data
   ```

## Contact

For questions or issues:
- Technical Lead: [Your Name]
- DevOps: [DevOps Contact]
- Supabase Support: support@supabase.io
