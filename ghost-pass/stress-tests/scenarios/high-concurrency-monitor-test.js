/**
 * High Concurrency Monitoring Test
 * 
 * Targets: 80-120 RPS sustained for 3-5 minutes
 * 
 * Monitors:
 * - Supabase connections used
 * - Function memory usage
 * - Cold start frequency
 * - Stripe latency
 * 
 * Logs:
 * - Transaction time (end-to-end)
 * - Lock wait time (database)
 * - Failed atomic updates
 * - Response time breakdown
 * 
 * Test Pattern:
 * - Ramp to 80 RPS (1 min)
 * - Sustain 80-120 RPS (3-5 min)
 * - Monitor all metrics
 * - Log detailed timing data
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Performance Metrics
const requestRate = new Gauge('request_rate_per_sec');
const transactionTime = new Trend('transaction_time_ms');
const lockWaitTime = new Trend('lock_wait_time_ms');
const coldStarts = new Counter('cold_starts');
const failedAtomicUpdates = new Counter('failed_atomic_updates');
const stripeLatency = new Trend('stripe_latency_ms');
const databaseLatency = new Trend('database_latency_ms');
const functionMemory = new Gauge('function_memory_mb');

// Success Metrics
const entrySuccessRate = new Rate('entry_success_rate');
const concessionSuccessRate = new Rate('concession_success_rate');
const overallSuccessRate = new Rate('overall_success_rate');

// Error Tracking
const timeoutErrors = new Counter('timeout_errors');
const connectionErrors = new Counter('connection_errors');
const insufficientBalanceErrors = new Counter('insufficient_balance_errors');
const databaseErrors = new Counter('database_errors');

// Test configuration - Target 80-120 RPS
// With 200 VUs doing 1 request every 2 seconds = 100 RPS
export const options = {
  stages: [
    { duration: '1m', target: 160 },   // Ramp to 80 RPS (160 VUs * 0.5 req/sec)
    { duration: '3m', target: 200 },   // Increase to 100 RPS
    { duration: '2m', target: 240 },   // Peak at 120 RPS
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'overall_success_rate': ['rate>0.85'],
    'transaction_time_ms': ['p(95)<3000', 'p(99)<5000'],
    'http_req_duration': ['p(95)<3000'],
    'failed_atomic_updates': ['count<10'],
    'timeout_errors': ['count<50'],
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-stress-001';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY;
const REFILL_AMOUNT_CENTS = 100000; // $1000

let vendorItems = [];
let requestCounter = 0;
let lastRateCheck = Date.now();

export function setup() {
  console.log('🔥 High Concurrency Monitoring Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Target Load:');
  console.log('  📊 80-120 RPS sustained');
  console.log('  ⏱️  3-5 minute duration');
  console.log('  🔄 Mixed operations (entry + concessions)');
  console.log('');
  console.log('Monitoring:');
  console.log('  🗄️  Supabase connections');
  console.log('  💾 Function memory usage');
  console.log('  ❄️  Cold start frequency');
  console.log('  💳 Stripe latency');
  console.log('');
  console.log('Logging:');
  console.log('  ⏲️  Transaction time');
  console.log('  🔒 Lock wait time');
  console.log('  ❌ Failed atomic updates');
  console.log('═══════════════════════════════════════════════\n');

  // Fetch vendor items
  if (!SUPABASE_URL || SUPABASE_URL === 'undefined') {
    console.error('❌ SUPABASE_URL is not set!');
    return { vendorItems: [], startTime: Date.now() };
  }

  const itemsUrl = `${SUPABASE_URL}/rest/v1/vendor_items?venue_id=eq.${TEST_VENUE_ID}&select=id,name,price_cents`;
  const itemsResponse = http.get(itemsUrl, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (itemsResponse.status === 200) {
    const items = JSON.parse(itemsResponse.body);
    console.log(`✅ Loaded ${items.length} vendor items\n`);
    return { vendorItems: items, startTime: Date.now() };
  } else {
    console.error(`❌ Failed to load vendor items: ${itemsResponse.status}`);
    return { vendorItems: [], startTime: Date.now() };
  }
}

export default function (data) {
  vendorItems = data.vendorItems;
  
  const vuId = __VU;
  const attendeeNum = ((vuId - 1) % 5000) + 1;
  const walletBindingId = `wallet_test_${attendeeNum}`;
  const deviceFingerprint = `device_test_${attendeeNum}`;
  
  // Track request rate
  requestCounter++;
  const now = Date.now();
  if (now - lastRateCheck >= 1000) {
    requestRate.add(requestCounter);
    requestCounter = 0;
    lastRateCheck = now;
  }
  
  // 60% entry, 40% concession for mixed load
  const operationType = Math.random() < 0.6 ? 'entry' : 'concession';
  
  if (operationType === 'entry') {
    performMonitoredEntry(walletBindingId, deviceFingerprint);
  } else {
    performMonitoredConcession(walletBindingId, deviceFingerprint);
  }
  
  // High frequency - 2 second intervals for 100 RPS with 200 VUs
  sleep(2);
}

function refillWallet(walletBindingId) {
  const refillPayload = JSON.stringify({
    balance_cents: REFILL_AMOUNT_CENTS,
  });

  const refillParams = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    timeout: '10s',
  };

  const refillResponse = http.patch(
    `${SUPABASE_URL}/rest/v1/wallets?wallet_binding_id=eq.${walletBindingId}`,
    refillPayload,
    refillParams
  );

  return refillResponse.status === 204 || refillResponse.status === 200;
}

function performMonitoredEntry(walletBindingId, deviceFingerprint) {
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  const startTime = Date.now();
  
  const payload = JSON.stringify({
    wallet_binding_id: walletBindingId,
    venue_id: TEST_VENUE_ID,
    gateway_id: gatewayId,
    interaction_method: 'QR',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    timeout: '15s',
  };

  const response = http.post(`${API_BASE_URL}/api/entry/scan`, payload, params);
  const totalTime = Date.now() - startTime;
  
  // Log transaction time
  transactionTime.add(totalTime);
  
  let body = null;
  let success = false;
  let isColdStart = false;
  let hasLockWait = false;
  let isAtomicFailure = false;
  
  try {
    body = JSON.parse(response.body);
    success = response.status === 200 && body.success;
    
    // Detect cold start (typically > 1000ms on first request)
    if (totalTime > 1000 && response.status === 200) {
      isColdStart = true;
      coldStarts.add(1);
      console.log(`❄️  Cold start detected [VU ${__VU}]: ${totalTime}ms`);
    }
    
    // Check for lock wait indicators in response
    if (body.metadata && body.metadata.lock_wait_ms) {
      hasLockWait = true;
      lockWaitTime.add(body.metadata.lock_wait_ms);
      console.log(`🔒 Lock wait detected [VU ${__VU}]: ${body.metadata.lock_wait_ms}ms`);
    }
    
    // Check for atomic update failures
    if (response.status === 500 && body.error && 
        (body.error.includes('concurrent') || body.error.includes('lock') || body.error.includes('deadlock'))) {
      isAtomicFailure = true;
      failedAtomicUpdates.add(1);
      console.error(`❌ Atomic update failed [VU ${__VU}]: ${body.error}`);
    }
    
    // Track database latency from response headers
    const dbTime = response.headers['X-Database-Time'];
    if (dbTime) {
      databaseLatency.add(parseInt(dbTime));
    }
    
    // Track function memory from response headers
    const memUsage = response.headers['X-Memory-Used'];
    if (memUsage) {
      functionMemory.add(parseInt(memUsage));
    }
    
  } catch (e) {
    console.error(`❌ Parse error [VU ${__VU}]: ${e.message}`);
  }
  
  // Handle insufficient balance
  if (response.status === 402) {
    insufficientBalanceErrors.add(1);
    const refilled = refillWallet(walletBindingId);
    if (refilled) {
      sleep(1);
      const retryResponse = http.post(`${API_BASE_URL}/api/entry/scan`, payload, params);
      success = retryResponse.status === 200;
    }
  }
  
  // Track error types
  if (response.status === 0 || response.error_code === 1050) {
    timeoutErrors.add(1);
    console.error(`⏱️  Timeout [VU ${__VU}]: ${totalTime}ms`);
  }
  
  if (response.status >= 500) {
    databaseErrors.add(1);
  }
  
  entrySuccessRate.add(success);
  overallSuccessRate.add(success);
  
  check(response, {
    'entry successful': () => success,
    'no timeout': () => response.status !== 0,
    'no atomic failure': () => !isAtomicFailure,
  });
}

function performMonitoredConcession(walletBindingId, deviceFingerprint) {
  if (!vendorItems || vendorItems.length === 0) {
    return;
  }

  const item = randomItem(vendorItems);
  const quantity = randomIntBetween(1, 2);
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  const startTime = Date.now();
  
  const payload = JSON.stringify({
    wallet_binding_id: walletBindingId,
    item_id: item.id,
    gateway_id: gatewayId,
    quantity: quantity,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    timeout: '15s',
  };

  const response = http.post(`${API_BASE_URL}/api/vendor/purchase`, payload, params);
  const totalTime = Date.now() - startTime;
  
  // Log transaction time
  transactionTime.add(totalTime);
  
  let body = null;
  let success = false;
  let isColdStart = false;
  let hasLockWait = false;
  let isAtomicFailure = false;
  
  try {
    body = JSON.parse(response.body);
    success = response.status === 200 && body.success;
    
    // Detect cold start
    if (totalTime > 1000 && response.status === 200) {
      isColdStart = true;
      coldStarts.add(1);
      console.log(`❄️  Cold start detected [VU ${__VU}]: ${totalTime}ms`);
    }
    
    // Check for lock wait
    if (body.metadata && body.metadata.lock_wait_ms) {
      hasLockWait = true;
      lockWaitTime.add(body.metadata.lock_wait_ms);
      console.log(`🔒 Lock wait detected [VU ${__VU}]: ${body.metadata.lock_wait_ms}ms`);
    }
    
    // Check for atomic failures
    if (response.status === 500 && body.error && 
        (body.error.includes('concurrent') || body.error.includes('lock') || body.error.includes('deadlock'))) {
      isAtomicFailure = true;
      failedAtomicUpdates.add(1);
      console.error(`❌ Atomic update failed [VU ${__VU}]: ${body.error}`);
    }
    
    // Track Stripe latency if present
    const stripeTime = response.headers['X-Stripe-Time'];
    if (stripeTime) {
      stripeLatency.add(parseInt(stripeTime));
    }
    
    // Track database latency
    const dbTime = response.headers['X-Database-Time'];
    if (dbTime) {
      databaseLatency.add(parseInt(dbTime));
    }
    
    // Track function memory
    const memUsage = response.headers['X-Memory-Used'];
    if (memUsage) {
      functionMemory.add(parseInt(memUsage));
    }
    
  } catch (e) {
    console.error(`❌ Parse error [VU ${__VU}]: ${e.message}`);
  }
  
  // Handle insufficient balance
  if (response.status === 402) {
    insufficientBalanceErrors.add(1);
    const refilled = refillWallet(walletBindingId);
    if (refilled) {
      sleep(1);
      const retryResponse = http.post(`${API_BASE_URL}/api/vendor/purchase`, payload, params);
      success = retryResponse.status === 200;
    }
  }
  
  // Track error types
  if (response.status === 0 || response.error_code === 1050) {
    timeoutErrors.add(1);
    console.error(`⏱️  Timeout [VU ${__VU}]: ${totalTime}ms`);
  }
  
  if (response.status >= 500) {
    databaseErrors.add(1);
  }
  
  concessionSuccessRate.add(success);
  overallSuccessRate.add(success);
  
  check(response, {
    'concession successful': () => success,
    'no timeout': () => response.status !== 0,
    'no atomic failure': () => !isAtomicFailure,
  });
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ High Concurrency Monitoring Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Key Metrics to Review:');
  console.log('  📊 Request rate (target: 80-120 RPS)');
  console.log('  ⏲️  Transaction time (p95, p99)');
  console.log('  🔒 Lock wait time (if any)');
  console.log('  ❌ Failed atomic updates (should be < 10)');
  console.log('  ❄️  Cold starts (frequency)');
  console.log('  ⏱️  Timeout errors');
  console.log('  🗄️  Database errors');
  console.log('  💳 Stripe latency (if applicable)');
  console.log('═══════════════════════════════════════════════');
}
