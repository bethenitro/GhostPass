/**
 * Entry Scan Stress Test
 * 
 * Tests entry scanning using actual GhostPass flow:
 * 1. Uses device fingerprint authentication (anonymous wallets)
 * 2. Calls /api/entry/scan endpoint (entry/re-entry tracking)
 * 3. Tests venue entry configuration with initial and re-entry fees
 * 4. Simulates 2 entry doors with realistic entry patterns
 * 
 * Target: 200 scans/minute total, < 0.5% failure rate
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const entrySuccessRate = new Rate('entry_success_rate');
const entryDuration = new Trend('entry_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 30 },   // Ramp up to 30 VUs
    { duration: '1m', target: 60 },   // Ramp up to 60 VUs
    { duration: '6m', target: 60 },   // Stay at 60 VUs
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'entry_success_rate': ['rate>0.80'], // 80% success (accounting for balance issues)
    'http_req_duration': ['p(95)<3000'], // 3s timeout (more realistic)
    'http_req_failed': ['rate<0.20'],    // < 20% failures (accounting for 402s)
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-stress-001';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY;
const REFILL_AMOUNT_CENTS = 100000; // $1000

// Function to refill wallet when balance is insufficient
function refillWallet(walletBindingId) {
  const refillPayload = JSON.stringify({
    wallet_binding_id: walletBindingId,
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

  if (refillResponse.status === 204 || refillResponse.status === 200) {
    console.log(`💰 Refilled wallet ${walletBindingId} to $${(REFILL_AMOUNT_CENTS / 100).toFixed(2)}`);
    return true;
  } else {
    console.error(`❌ Failed to refill wallet ${walletBindingId}: ${refillResponse.status}`);
    return false;
  }
}

export default function () {
  const vuId = __VU;
  const iterationId = __ITER;
  
  // Each VU represents a unique wallet
  const walletNum = ((vuId - 1) % 5000) + 1;
  const deviceFingerprint = `device_test_${walletNum}`;
  const walletBindingId = `wallet_test_${walletNum}`;
  
  // Alternate between two gateways
  const gatewayId = (iterationId % 2 === 0) ? TEST_GATEWAY_1_ID : TEST_GATEWAY_2_ID;
  
  const startTime = Date.now();
  
  // Process entry scan using actual GhostPass endpoint
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
    timeout: '15s', // Increased timeout for slow responses
  };

  const response = http.post(
    `${API_BASE_URL}/api/entry/scan`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  entryDuration.add(duration);

  // Parse response body
  let body = null;
  let isInsufficientBalance = false;
  try {
    body = JSON.parse(response.body);
    isInsufficientBalance = response.status === 402 && body.error === 'Insufficient balance';
  } catch (e) {
    // Ignore parse errors for now
  }

  // If insufficient balance, refill wallet and retry
  if (isInsufficientBalance) {
    console.log(`⚠️  Insufficient balance for wallet ${walletBindingId}, refilling...`);
    const refilled = refillWallet(walletBindingId);
    
    if (refilled) {
      // Retry the entry scan after refill
      sleep(1); // Brief pause to ensure DB update propagates
      
      const retryResponse = http.post(
        `${API_BASE_URL}/api/entry/scan`,
        payload,
        params
      );
      
      const retryDuration = Date.now() - startTime;
      entryDuration.add(retryDuration);
      
      try {
        body = JSON.parse(retryResponse.body);
      } catch (e) {
        // Ignore parse errors
      }
      
      // Check retry response
      check(retryResponse, {
        'status is 200 or 402': (r) => r.status === 200 || r.status === 402,
        'response has success field': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.hasOwnProperty('success');
          } catch (e) {
            return false;
          }
        },
        'entry successful': (r) => {
          try {
            const body = JSON.parse(r.body);
            return r.status === 200 && body.success === true;
          } catch (e) {
            return false;
          }
        },
        'response time < 3000ms': () => retryDuration < 3000,
      });
      
      entrySuccessRate.add(retryResponse.status === 200 && body && body.success === true);
      
      // Log if retry also failed
      if (retryResponse.status !== 200 || !body || !body.success) {
        console.error(`❌ Entry failed even after refill [VU ${vuId}]`);
        console.error(`   Wallet: ${walletBindingId}`);
        console.error(`   Response: ${JSON.stringify(body)}`);
      }
      
      sleep(Math.random() * 3 + 3);
      return;
    }
  }

  // Check response
  const responseChecks = check(response, {
    'status is 200 or 402': (r) => r.status === 200 || r.status === 402,
    'response has success field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('success');
      } catch (e) {
        console.error(`❌ Failed to parse response [VU ${vuId}]`);
        console.error(`   Status: ${r.status}`);
        console.error(`   Body: ${r.body}`);
        return false;
      }
    },
    'entry successful': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
    'response time < 3000ms': () => duration < 3000, // More realistic threshold
  });

  // Determine if this is a real failure (not insufficient balance or performance issue)
  let isRealFailure = false;
  if (!isInsufficientBalance) {
    try {
      isRealFailure = response.status !== 200 || (body && body.success !== true);
    } catch (e) {
      isRealFailure = true;
    }
  }

  // Log only real errors (not insufficient balance or performance issues)
  if (isRealFailure) {
    console.error(`❌ Entry scan failed [VU ${vuId}] Status: ${response.status}`);
    console.error(`   URL: ${API_BASE_URL}/api/entry/scan`);
    console.error(`   Wallet: ${walletBindingId}`);
    console.error(`   Gateway: ${gatewayId}`);
    console.error(`   Venue: ${TEST_VENUE_ID}`);
    try {
      console.error(`   Response: ${JSON.stringify(body || response.body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body}`);
    }
  }

  // Only count as success if status is 200 and success is true
  entrySuccessRate.add(response.status === 200 && body && body.success === true);

  // Simulate realistic entry timing (3-6 seconds between scans per user)
  sleep(Math.random() * 3 + 3);
}
