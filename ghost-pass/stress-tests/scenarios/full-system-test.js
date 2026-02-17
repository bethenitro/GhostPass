/**
 * Full System Integration Stress Test
 * 
 * Uses device fingerprint authentication (anonymous wallet flow)
 * Tests the complete GhostPass flow with actual endpoints
 * 
 * Combines:
 * - Entry scans via /api/modes/process-scan (200/min)
 * - Wallet funding via /api/wallet/fund (50 concurrent)
 * 
 * Duration: 20-25 minutes continuous
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const overallSuccessRate = new Rate('overall_success_rate');
const entrySuccessRate = new Rate('entry_success_rate');
const fundingSuccessRate = new Rate('funding_success_rate');
const systemErrors = new Counter('system_errors');

// Test configuration
export const options = {
  scenarios: {
    // Entry scans - 200/min
    entry_scans: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      stages: [
        { duration: '3m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '20m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      exec: 'entryScan',
    },
    
    // Wallet funding - 50 concurrent
    wallet_funding: {
      executor: 'constant-vus',
      vus: 50,
      duration: '25m',
      exec: 'walletFunding',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'overall_success_rate': ['rate>0.995'],
    'entry_success_rate': ['rate>0.995'],
    'funding_success_rate': ['rate>0.99'],
    'system_errors': ['count<50'],
  },
};

// Environment variables
const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const CONTEXT = 'club'; // Use existing context: 50 cents per scan

// Test data
const walletIds = Array.from({ length: 5000 }, (_, i) => `wallet_test_${i + 1}`);
const deviceFingerprints = Array.from({ length: 5000 }, (_, i) => `device_test_${i + 1}`);

export function setup() {
  console.log('🚀 Starting Full System Integration Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Configuration:');
  console.log(`  API: ${API_BASE_URL}`);
  console.log(`  Context: ${CONTEXT}`);
  console.log('Target Load:');
  console.log('  - 5,000 unique wallets');
  console.log('  - 200 entry scans/minute');
  console.log('  - 50 concurrent wallet funding requests');
  console.log('  - Device fingerprint authentication');
  console.log('Duration: 27 minutes');
  console.log('');
  console.log('⚠️  Watching for errors - will log immediately if any occur');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  return { startTime: Date.now() };
}

// Entry Scan Scenario
export function entryScan() {
  const walletIndex = randomIntBetween(0, 4999);
  const walletBindingId = walletIds[walletIndex];
  const deviceFingerprint = deviceFingerprints[walletIndex];
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  
  const payload = JSON.stringify({
    context: CONTEXT,
    wallet_binding_id: walletBindingId,
    interaction_method: 'QR',
    gateway_id: gatewayId,
    ghost_pass_token: null,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    tags: { scenario: 'entry_scan' },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/modes/process-scan`,
    payload,
    params
  );

  // Determine if this is a real failure
  let isRealFailure = false;
  try {
    const body = JSON.parse(response.body);
    isRealFailure = response.status !== 200 || body.success !== true;
  } catch (e) {
    isRealFailure = true;
  }

  // Log only real errors
  if (isRealFailure) {
    console.error(`❌ Entry scan failed [VU ${__VU}] Status: ${response.status}`);
    console.error(`   Wallet: ${walletBindingId}`);
    try {
      const body = JSON.parse(response.body);
      console.error(`   Response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body.substring(0, 200)}`);
    }
  }

  const success = check(response, {
    'entry scan success': (r) => {
      try {
        const body = JSON.parse(r.body);
        return r.status === 200 && body.success === true;
      } catch (e) {
        return false;
      }
    },
    'entry scan < 500ms': (r) => r.timings.duration < 500,
  });

  entrySuccessRate.add(success);
  overallSuccessRate.add(success);
  
  if (isRealFailure && response.status >= 500) {
    systemErrors.add(1);
  }
}

// Wallet Funding Scenario
export function walletFunding() {
  const walletIndex = randomIntBetween(0, 4999);
  const deviceFingerprint = deviceFingerprints[walletIndex];
  const fundAmount = randomIntBetween(20, 100); // $20-$100
  
  const payload = JSON.stringify({
    sources: [
      {
        type: 'card',
        amount: fundAmount,
        last4: '4242',
      }
    ]
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    tags: { scenario: 'wallet_funding' },
    timeout: '15s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/wallet/fund`,
    payload,
    params
  );

  // Determine if this is a real failure
  let isRealFailure = false;
  try {
    const body = JSON.parse(response.body);
    isRealFailure = response.status !== 200 || body.status !== 'success';
  } catch (e) {
    isRealFailure = true;
  }

  // Log only real errors
  if (isRealFailure) {
    console.error(`❌ Wallet funding failed [VU ${__VU}] Status: ${response.status}`);
    console.error(`   Device: ${deviceFingerprint}`);
    console.error(`   Amount: $${fundAmount}`);
    try {
      const body = JSON.parse(response.body);
      console.error(`   Response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body.substring(0, 200)}`);
    }
  }

  const success = check(response, {
    'funding success': (r) => {
      try {
        const body = JSON.parse(r.body);
        return r.status === 200 && body.status === 'success';
      } catch (e) {
        return false;
      }
    },
    'funding < 5000ms': (r) => r.timings.duration < 5000,
  });

  fundingSuccessRate.add(success);
  overallSuccessRate.add(success);
  
  if (isRealFailure && response.status >= 500) {
    systemErrors.add(1);
  }
  
  sleep(randomIntBetween(20, 40));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Full System Integration Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Check detailed metrics above for:');
  console.log('  - Response time percentiles');
  console.log('  - Success rates by scenario');
  console.log('  - System error count');
  console.log('  - Threshold pass/fail status');
  console.log('═══════════════════════════════════════════════');
}
