/**
 * Entry Scan Stress Test
 * 
 * Tests entry scanning using actual GhostPass flow:
 * 1. Uses device fingerprint authentication (anonymous wallets)
 * 2. Calls /api/modes/process-scan endpoint (Mode A: pay-per-scan)
 * 3. Uses existing 'club' context (50 cents per scan)
 * 4. Simulates 2 entry doors with 100 scans/min each
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
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs
    { duration: '5m', target: 100 },  // Ramp up to 100 VUs
    { duration: '10m', target: 100 }, // Stay at 100 VUs
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'entry_success_rate': ['rate>0.995'], // > 99.5% success
    'http_req_duration': ['p(95)<500'],   // 95% under 500ms
    'http_req_failed': ['rate<0.005'],    // < 0.5% failures
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const CONTEXT = 'club'; // Use existing context: 50 cents per scan

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
    context: CONTEXT,
    wallet_binding_id: walletBindingId,
    interaction_method: 'QR',
    gateway_id: gatewayId,
    ghost_pass_token: null, // Mode A doesn't use pass tokens
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/modes/process-scan`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  entryDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
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
    'response time < 500ms': () => duration < 500,
  });

  // Log errors immediately
  if (!success || response.status !== 200) {
    console.error(`❌ Entry scan failed [VU ${vuId}] Status: ${response.status}`);
    console.error(`   URL: ${API_BASE_URL}/api/modes/process-scan`);
    console.error(`   Wallet: ${walletBindingId}`);
    console.error(`   Gateway: ${gatewayId}`);
    console.error(`   Context: ${CONTEXT}`);
    try {
      const body = JSON.parse(response.body);
      console.error(`   Response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body}`);
    }
  }

  entrySuccessRate.add(success);

  // Simulate realistic entry timing (3-6 seconds between scans per user)
  sleep(Math.random() * 3 + 3);
}
