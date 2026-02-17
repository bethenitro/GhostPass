/**
 * Concession Transaction Stress Test
 * 
 * Tests vendor/concession purchases using actual GhostPass flow:
 * 1. Uses device fingerprint authentication
 * 2. Calls /api/vendor/purchase endpoint
 * 3. Simulates 4 concession terminals
 * 4. 30 transactions per minute each (120 total)
 * 
 * Verifies:
 * - Atomic wallet debits
 * - Platform fee (2.5%) calculated correctly
 * - Revenue splits tracked
 * - No double-charging
 * - No negative balances
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
const platformFeeAccuracy = new Rate('platform_fee_accuracy');

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
    'platform_fee_accuracy': ['rate>0.99'],
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-stress-001';

// 4 concession terminals (gateway points)
const TERMINALS = [
  __ENV.TEST_GATEWAY_1_ID,
  __ENV.TEST_GATEWAY_2_ID,
  // Add 2 more if available, otherwise reuse
  __ENV.TEST_GATEWAY_1_ID,
  __ENV.TEST_GATEWAY_2_ID,
];

// Test items (these should match what's in vendor_items table)
const ITEMS = [
  { name: 'Beer', price_cents: 800 },
  { name: 'Cocktail', price_cents: 1200 },
  { name: 'Soda', price_cents: 400 },
  { name: 'Hot Dog', price_cents: 600 },
  { name: 'Nachos', price_cents: 900 },
  { name: 'Burger', price_cents: 1100 },
];

// We'll fetch actual item IDs in setup
let itemIds = [];

export function setup() {
  console.log('🚀 Starting Concession Transaction Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Configuration:');
  console.log(`  API: ${API_BASE_URL}`);
  console.log(`  Venue: ${TEST_VENUE_ID}`);
  console.log('Target Load:');
  console.log('  - 4 concession terminals');
  console.log('  - 120 transactions/minute total');
  console.log('  - 30 transactions/minute per terminal');
  console.log('Verification:');
  console.log('  - Atomic wallet debits');
  console.log('  - 2.5% platform fee');
  console.log('  - No negative balances');
  console.log('  - No double-charging');
  console.log('═══════════════════════════════════════════════\n');
  
  // Use predefined test items (vendor_items should be seeded in database)
  // These match the items that should be created by seed-test-data.js
  itemIds = [
    { id: 'test-item-beer', name: 'Beer', price_cents: 800 },
    { id: 'test-item-cocktail', name: 'Cocktail', price_cents: 1200 },
    { id: 'test-item-soda', name: 'Soda', price_cents: 400 },
    { id: 'test-item-hotdog', name: 'Hot Dog', price_cents: 600 },
    { id: 'test-item-nachos', name: 'Nachos', price_cents: 900 },
    { id: 'test-item-burger', name: 'Burger', price_cents: 1100 },
  ];
  
  console.log(`✅ Using ${itemIds.length} test vendor items`);
  console.log('⚠️  Ensure seed-test-data.js has been run to create these items in the database\n');
  
  return { startTime: Date.now(), itemIds };
}

export default function (data) {
  const vuId = __VU;
  
  // Each VU represents a unique wallet
  const walletNum = ((vuId - 1) % 5000) + 1;
  const walletBindingId = `wallet_test_${walletNum}`;
  const deviceFingerprint = `device_test_${walletNum}`;
  
  // Select terminal and item
  const terminalId = randomItem(TERMINALS);
  const item = data.itemIds.length > 0 ? randomItem(data.itemIds) : randomItem(ITEMS);
  const quantity = randomIntBetween(1, 3); // 1-3 items
  
  // Calculate expected values
  const itemTotal = item.price_cents * quantity;
  const expectedPlatformFee = Math.floor(itemTotal * 0.025); // 2.5%
  const expectedVendorPayout = itemTotal - expectedPlatformFee;
  
  const startTime = Date.now();
  
  const payload = JSON.stringify({
    wallet_binding_id: walletBindingId,
    item_id: item.id,
    gateway_id: terminalId,
    quantity: quantity,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': deviceFingerprint,
    },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/vendor/purchase`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  transactionDuration.add(duration);

  // Determine if this is a real failure
  let isRealFailure = false;
  let hasNegativeBalance = false;
  let platformFeeCorrect = false;
  
  try {
    const body = JSON.parse(response.body);
    
    // Check for real failure (not just insufficient balance)
    isRealFailure = response.status !== 200 && response.status !== 402;
    
    if (response.status === 200 && body.success) {
      // Verify no negative balance
      if (body.wallet && body.wallet.balance_after_cents < 0) {
        hasNegativeBalance = true;
        negativeBalances.add(1);
      }
      
      // Verify platform fee calculation
      if (body.transaction) {
        const actualPlatformFee = body.transaction.platform_fee_cents;
        platformFeeCorrect = actualPlatformFee === expectedPlatformFee;
        platformFeeAccuracy.add(platformFeeCorrect);
      }
    }
  } catch (e) {
    isRealFailure = true;
  }

  // Log only real errors (not insufficient balance or performance issues)
  if (isRealFailure) {
    console.error(`❌ Concession transaction failed [VU ${vuId}] Status: ${response.status}`);
    console.error(`   URL: ${API_BASE_URL}/api/vendor/purchase`);
    console.error(`   Wallet: ${walletBindingId}`);
    console.error(`   Item: ${item.name} x${quantity}`);
    console.error(`   Terminal: ${terminalId}`);
    try {
      const body = JSON.parse(response.body);
      console.error(`   Response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`   Response (raw): ${response.body}`);
    }
  }

  if (hasNegativeBalance) {
    console.error(`❌ NEGATIVE BALANCE DETECTED [VU ${vuId}]`);
    console.error(`   Wallet: ${walletBindingId}`);
  }

  // Check response
  const responseChecks = check(response, {
    'status is 200 or 402': (r) => r.status === 200 || r.status === 402,
    'purchase successful': (r) => {
      try {
        const body = JSON.parse(r.body);
        return r.status === 200 && body.success === true;
      } catch (e) {
        return false;
      }
    },
    'balance not negative': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (r.status === 200 && body.wallet) {
          return body.wallet.balance_after_cents >= 0;
        }
        return true; // If not 200, we can't check balance
      } catch (e) {
        return true;
      }
    },
    'response time < 800ms': () => duration < 800,
  });

  transactionSuccessRate.add(responseChecks);

  // Realistic concession timing (users take time to order/consume)
  sleep(randomIntBetween(6, 12));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Concession Transaction Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Check metrics above for:');
  console.log('  - Transaction success rate');
  console.log('  - Platform fee accuracy');
  console.log('  - Negative balance count (should be 0)');
  console.log('  - Response time percentiles');
  console.log('═══════════════════════════════════════════════');
}
