/**
 * Concession Transaction Stress Test
 * 
 * Note: This test simulates vendor transactions using the wallet atomic transaction endpoint
 * 
 * Simulates:
 * - 4 vendor terminals
 * - 30 transactions per minute each (120 total)
 * - Atomic wallet debits
 * - Platform fee calculation
 * 
 * Success Criteria:
 * - < 800ms response time (p95)
 * - < 0.5% failure rate
 * - No negative balances
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const transactionSuccessRate = new Rate('transaction_success_rate');
const transactionDuration = new Trend('transaction_duration');
const negativeBalances = new Counter('negative_balances');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 40 },   // Ramp up to 40 VUs
    { duration: '3m', target: 120 },  // Ramp up to 120 VUs
    { duration: '15m', target: 120 }, // Stay at 120 VUs
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800'],
    'transaction_success_rate': ['rate>0.995'],
    'http_req_failed': ['rate<0.005'],
    'negative_balances': ['count==0'],
  },
};

// Environment variables
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-001';

// 4 vendor terminals (using gateway_points)
const TERMINALS = [
  { id: 'terminal-1', name: 'Bar 1' },
  { id: 'terminal-2', name: 'Bar 2' },
  { id: 'terminal-3', name: 'Food 1' },
  { id: 'terminal-4', name: 'Food 2' },
];

// Test items
const ITEMS = [
  { name: 'Beer', price_cents: 800 },
  { name: 'Cocktail', price_cents: 1200 },
  { name: 'Soda', price_cents: 400 },
  { name: 'Hot Dog', price_cents: 600 },
  { name: 'Nachos', price_cents: 900 },
];

// Test wallets
const walletIds = Array.from({ length: 5000 }, (_, i) => `wallet_test_${i + 1}`);

export function setup() {
  console.log('🚀 Starting Concession Transaction Stress Test');
  console.log(`Target: 120 transactions/minute across 4 terminals`);
  return { startTime: Date.now() };
}

export default function () {
  const vuIndex = __VU - 1;
  const walletId = walletIds[vuIndex % walletIds.length];
  const terminal = randomItem(TERMINALS);
  const item = randomItem(ITEMS);

  // Calculate expected platform fee (2.5%)
  const platformFee = Math.floor(item.price_cents * 0.025);

  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    gateway_id: terminal.id,
    amount_cents: item.price_cents,
    description: `${item.name} at ${terminal.name}`,
    metadata: {
      item_name: item.name,
      terminal: terminal.name,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': `device_${vuIndex}`,
    },
    tags: {
      name: 'ConcessionTransaction',
      terminal: terminal.id,
    },
  };

  const startTime = Date.now();
  const response = http.post(
    `${API_BASE_URL}/api/wallet/atomic-transaction`,
    payload,
    params
  );
  const duration = Date.now() - startTime;

  transactionDuration.add(duration);

  const success = check(response, {
    'status is 200 or 402': (r) => r.status === 200 || r.status === 402,
    'response time < 800ms': (r) => r.timings.duration < 800,
    'balance is not negative': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          if (body.new_balance_cents < 0) {
            negativeBalances.add(1);
            return false;
          }
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
  });

  transactionSuccessRate.add(success);

  // Realistic user behavior
  sleep(randomIntBetween(6, 10));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`✅ Concession Transaction Test Complete`);
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
}
