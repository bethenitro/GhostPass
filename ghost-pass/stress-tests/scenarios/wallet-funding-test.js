/**
 * Wallet Funding Stress Test
 * 
 * Tests wallet funding using actual GhostPass flow:
 * 1. Uses device fingerprint authentication
 * 2. Calls /api/wallet/fund endpoint
 * 3. Simulates 50 concurrent funding requests
 * 
 * Target: 50 concurrent requests, < 0.5% failure rate, < 5s completion
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const fundingSuccessRate = new Rate('funding_success_rate');
const fundingDuration = new Trend('funding_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 25 },   // Ramp up to 25 VUs
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs
    { duration: '10m', target: 50 },  // Stay at 50 VUs
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'funding_success_rate': ['rate>0.995'], // > 99.5% success
    'http_req_duration': ['p(95)<5000'],    // 95% under 5s
    'http_req_failed': ['rate<0.005'],      // < 0.5% failures
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';

export default function () {
  const vuId = __VU;
  
  // Each VU represents a unique wallet
  const walletNum = ((vuId - 1) % 5000) + 1;
  const deviceFingerprint = `device_test_${walletNum}`;
  
  const startTime = Date.now();
  
  // Fund wallet using actual GhostPass endpoint
  // Simulate funding $20-$100
  const fundAmount = Math.floor(Math.random() * 80) + 20;
  
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
    timeout: '15s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/wallet/fund`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  fundingDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('status');
      } catch (e) {
        console.error(`❌ Failed to parse response [VU ${vuId}]`);
        console.error(`   Status: ${r.status}`);
        console.error(`   Body: ${r.body}`);
        return false;
      }
    },
    'funding successful': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'success';
      } catch (e) {
        return false;
      }
    },
    'balance updated': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.new_balance_cents > 0;
      } catch (e) {
        return false;
      }
    },
    'response time < 5s': () => duration < 5000,
  });

  // Log errors immediately
  if (!success || response.status !== 200) {
    console.error(`❌ Wallet funding failed [VU ${vuId}] Status: ${response.status}`);
    console.error(`   URL: ${API_BASE_URL}/api/wallet/fund`);
    console.error(`   Device: ${deviceFingerprint}`);
    console.error(`   Amount: $${fundAmount}`);
    try {
      const body = JSON.parse(response.body);
      console.error(`   Response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body}`);
    }
  }

  fundingSuccessRate.add(success);

  // Simulate realistic funding timing (users don't fund constantly)
  sleep(Math.random() * 10 + 5);
}
