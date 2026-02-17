/**
 * Full System Integration Stress Test - Device Fingerprint Auth
 * 
 * Uses device fingerprint authentication (anonymous wallet flow)
 * This is the most realistic scenario for anonymous users
 * 
 * Combines:
 * - Entry permission checks (200/min)
 * - Wallet funding (50 concurrent)
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
    // Entry permission checks - 200/min
    entry_checks: {
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
      exec: 'entryCheck',
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
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-001';

// Test data
const walletIds = Array.from({ length: 5000 }, (_, i) => `wallet_test_${i + 1}`);

export function setup() {
  console.log('🚀 Starting Full System Integration Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Configuration:');
  console.log(`  API: ${API_BASE_URL}`);
  console.log(`  Venue: ${VENUE_ID}`);
  console.log('Target Load:');
  console.log('  - 5,000 unique wallets');
  console.log('  - 200 entry checks/minute');
  console.log('  - 50 concurrent wallet funding requests');
  console.log('  - Device fingerprint authentication');
  console.log('Duration: 27 minutes');
  console.log('');
  console.log('⚠️  Watching for errors - will log immediately if any occur');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  return { startTime: Date.now() };
}

// Entry Permission Check Scenario
export function entryCheck() {
  const vuIndex = __VU - 1;
  const walletId = randomItem(walletIds);
  const deviceFingerprint = `device_test_${vuIndex}`;
  
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    tags: { scenario: 'entry_check' },
  };

  const response = http.post(
    `${API_BASE_URL}/api/entry/check-permission`,
    payload,
    params
  );

  // Log errors immediately
  if (response.status !== 200) {
    console.error(`❌ Entry check failed [VU ${__VU}] Status: ${response.status}`);
    console.error(`   Response: ${response.body.substring(0, 200)}`);
  }

  const success = check(response, {
    'entry check success': (r) => r.status === 200,
    'entry check < 500ms': (r) => r.timings.duration < 500,
  });

  entrySuccessRate.add(success);
  overallSuccessRate.add(success);
  
  if (!success && response.status >= 500) {
    systemErrors.add(1);
  }
}

// Wallet Funding Scenario
export function walletFunding() {
  const vuIndex = __VU - 1;
  const walletId = randomItem(walletIds);
  const deviceFingerprint = `device_test_${vuIndex}`;
  const fundingAmount = randomItem([1000, 2000, 5000, 10000]);
  
  const payload = JSON.stringify({
    sources: [{ type: 'test', amount: fundingAmount / 100 }],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    tags: { scenario: 'wallet_funding' },
  };

  const response = http.post(
    `${API_BASE_URL}/api/wallet/fund`,
    payload,
    params
  );

  // Log errors immediately
  if (response.status !== 200) {
    console.error(`❌ Funding failed [VU ${__VU}] Status: ${response.status}`);
    console.error(`   Response: ${response.body.substring(0, 200)}`);
  }

  const success = check(response, {
    'funding initiated': (r) => r.status === 200,
    'funding < 5000ms': (r) => r.timings.duration < 5000,
  });

  fundingSuccessRate.add(success);
  overallSuccessRate.add(success);
  
  if (!success && response.status >= 500) {
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
