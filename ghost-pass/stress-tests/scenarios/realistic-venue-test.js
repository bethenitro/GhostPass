/**
 * Realistic Venue Stress Test
 * 
 * Simulates a real venue scenario:
 * - 5,000 attendees
 * - 2 entry doors with burst waves (door rush)
 * - 4 concession stands inside
 * - Mixed operations: wallet funding, entry, re-entry, POS purchases
 * - 10-15 minute sustained load
 * - Target: 50-100 requests/sec burst load
 * - Minimum 300 concurrent VUs
 * 
 * Realistic Flow:
 * 1. Attendee arrives, funds wallet if needed
 * 2. Enters through door (initial entry)
 * 3. Makes 1-3 concession purchases inside
 * 4. May exit and re-enter (20% chance)
 * 5. Makes more purchases after re-entry
 * 
 * Burst Patterns:
 * - Door rush at start (0-5 min): Heavy entry traffic
 * - Mid-event (5-10 min): Mixed entry + concessions
 * - Late arrivals (10-15 min): Some entries, mostly concessions
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const entrySuccessRate = new Rate('entry_success_rate');
const reentrySuccessRate = new Rate('reentry_success_rate');
const concessionSuccessRate = new Rate('concession_success_rate');
const fundingSuccessRate = new Rate('funding_success_rate');
const entryDuration = new Trend('entry_duration');
const concessionDuration = new Trend('concession_duration');
const fundingDuration = new Trend('funding_duration');
const totalTransactions = new Counter('total_transactions');
const doorRushRate = new Gauge('door_rush_rate');
const concessionRate = new Gauge('concession_rate');
const walletRefills = new Counter('wallet_refills');

// Test configuration - Realistic venue load pattern
export const options = {
  stages: [
    // Door rush - Heavy entry traffic (0-5 min)
    { duration: '1m', target: 200 },   // Rapid ramp to 200 VUs
    { duration: '2m', target: 400 },   // Peak door rush: 400 VUs
    { duration: '2m', target: 350 },   // Sustained door rush
    
    // Mid-event - Mixed operations (5-10 min)
    { duration: '2m', target: 300 },   // Transition to mixed load
    { duration: '3m', target: 350 },   // Sustained mixed operations
    
    // Late arrivals + concessions (10-15 min)
    { duration: '2m', target: 300 },   // Fewer entries, more concessions
    { duration: '3m', target: 300 },   // Sustained late-event load
    
    // Ramp down
    { duration: '2m', target: 0 },     // Graceful shutdown
  ],
  thresholds: {
    'entry_success_rate': ['rate>0.85'],
    'reentry_success_rate': ['rate>0.85'],
    'concession_success_rate': ['rate>0.85'],
    'funding_success_rate': ['rate>0.90'],
    'http_req_duration': ['p(95)<3000'],
    'http_req_failed': ['rate<0.15'],
    'total_transactions': ['count>5000'], // Minimum 5000 transactions
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-stress-001';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY;
const REFILL_AMOUNT_CENTS = 100000; // $1000

// Vendor items cache (populated in setup)
let vendorItems = [];

export function setup() {
  console.log('🎪 Starting Realistic Venue Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Scenario:');
  console.log('  👥 5,000 attendees');
  console.log('  🚪 2 entry doors');
  console.log('  🍔 4 concession stands');
  console.log('  ⏱️  15 minute sustained load');
  console.log('  📊 Target: 50-100 req/sec burst');
  console.log('  🔥 300+ concurrent VUs');
  console.log('');
  console.log('Load Pattern:');
  console.log('  0-5 min:  Door rush (heavy entry traffic)');
  console.log('  5-10 min: Mixed operations (entry + concessions)');
  console.log('  10-15 min: Late arrivals + concessions');
  console.log('═══════════════════════════════════════════════\n');

  // Validate environment variables
  if (!SUPABASE_URL || SUPABASE_URL === 'undefined') {
    console.error('❌ SUPABASE_URL is not set!');
    console.error('   Please ensure .env.test is loaded correctly');
    return { vendorItems: [], startTime: Date.now() };
  }

  // Fetch vendor items using Supabase REST API
  const itemsUrl = `${SUPABASE_URL}/rest/v1/vendor_items?venue_id=eq.${TEST_VENUE_ID}&select=id,name,price_cents`;
  console.log(`Fetching vendor items from: ${itemsUrl}`);
  
  const itemsResponse = http.get(itemsUrl, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (itemsResponse.status === 200) {
    const items = JSON.parse(itemsResponse.body);
    console.log(`✅ Loaded ${items.length} vendor items:`);
    items.forEach(item => {
      console.log(`   - ${item.name}: $${(item.price_cents / 100).toFixed(2)}`);
    });
    console.log('');
    return { vendorItems: items, startTime: Date.now() };
  } else {
    console.error(`❌ Failed to load vendor items: ${itemsResponse.status}`);
    console.error(`   Response: ${itemsResponse.body}`);
    return { vendorItems: [], startTime: Date.now() };
  }
}

export default function (data) {
  vendorItems = data.vendorItems;
  
  const vuId = __VU;
  const iterationId = __ITER;
  
  // Each VU represents a unique attendee
  const attendeeNum = ((vuId - 1) % 5000) + 1;
  const walletBindingId = `wallet_test_${attendeeNum}`;
  const deviceFingerprint = `device_test_${attendeeNum}`;
  
  // Determine behavior based on test phase
  const elapsedMinutes = (__ENV.K6_ITERATION_DURATION || 0) / 60;
  const isDoorRush = elapsedMinutes < 5;
  const isMidEvent = elapsedMinutes >= 5 && elapsedMinutes < 10;
  const isLateEvent = elapsedMinutes >= 10;
  
  // Update metrics for monitoring
  if (isDoorRush) {
    doorRushRate.add(1);
  } else {
    doorRushRate.add(0);
  }
  
  // Realistic attendee flow
  group('Attendee Journey', () => {
    
    // Phase 1: Door Rush (0-5 min) - Focus on entries
    if (isDoorRush) {
      // 80% entry, 20% entry + quick purchase
      if (Math.random() < 0.8) {
        // Just entry
        const entered = processEntry(walletBindingId, deviceFingerprint);
        if (entered) {
          sleep(randomIntBetween(2, 5)); // Quick entry
        }
      } else {
        // Entry + quick purchase
        const entered = processEntry(walletBindingId, deviceFingerprint);
        if (entered) {
          sleep(randomIntBetween(3, 6));
          makeConcessionPurchase(walletBindingId, deviceFingerprint);
          sleep(randomIntBetween(2, 4));
        }
      }
    }
    
    // Phase 2: Mid-Event (5-10 min) - Mixed operations
    else if (isMidEvent) {
      // 40% entry, 60% concessions
      if (Math.random() < 0.4) {
        // New entry
        const entered = processEntry(walletBindingId, deviceFingerprint);
        if (entered) {
          sleep(randomIntBetween(5, 10));
          // Make 1-2 purchases
          const purchaseCount = randomIntBetween(1, 2);
          for (let i = 0; i < purchaseCount; i++) {
            makeConcessionPurchase(walletBindingId, deviceFingerprint);
            sleep(randomIntBetween(3, 8));
          }
        }
      } else {
        // Just concessions (already inside)
        const purchaseCount = randomIntBetween(1, 3);
        for (let i = 0; i < purchaseCount; i++) {
          makeConcessionPurchase(walletBindingId, deviceFingerprint);
          sleep(randomIntBetween(4, 10));
        }
      }
    }
    
    // Phase 3: Late Event (10-15 min) - Mostly concessions, some re-entries
    else if (isLateEvent) {
      // 20% re-entry, 80% concessions
      if (Math.random() < 0.2) {
        // Re-entry scenario
        const reentered = processEntry(walletBindingId, deviceFingerprint);
        if (reentered) {
          sleep(randomIntBetween(5, 10));
          makeConcessionPurchase(walletBindingId, deviceFingerprint);
          sleep(randomIntBetween(3, 6));
        }
      } else {
        // Heavy concession usage
        const purchaseCount = randomIntBetween(2, 4);
        for (let i = 0; i < purchaseCount; i++) {
          makeConcessionPurchase(walletBindingId, deviceFingerprint);
          sleep(randomIntBetween(5, 12));
        }
      }
    }
  });
  
  // Random wait before next iteration
  sleep(randomIntBetween(5, 15));
}

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

  const refillUrl = `${SUPABASE_URL}/rest/v1/wallets?wallet_binding_id=eq.${walletBindingId}`;
  const refillResponse = http.patch(refillUrl, refillPayload, refillParams);

  if (refillResponse.status === 204 || refillResponse.status === 200) {
    walletRefills.add(1);
    console.log(`💰 Refilled wallet ${walletBindingId} to $${(REFILL_AMOUNT_CENTS / 100).toFixed(2)}`);
    return true;
  } else {
    console.error(`❌ Failed to refill wallet ${walletBindingId}: ${refillResponse.status}`);
    console.error(`   URL: ${refillUrl}`);
    console.error(`   Response: ${refillResponse.body}`);
    return false;
  }
}

function processEntry(walletBindingId, deviceFingerprint) {
  const startTime = Date.now();
  
  // Alternate between 2 doors
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  
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

  const response = http.post(
    `${API_BASE_URL}/api/entry/scan`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  entryDuration.add(duration);
  totalTransactions.add(1);

  let body = null;
  let isInsufficientBalance = false;
  
  try {
    body = JSON.parse(response.body);
    isInsufficientBalance = response.status === 402 && body.error === 'Insufficient balance';
  } catch (e) {
    console.error(`❌ Failed to parse entry response [VU ${__VU}]`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Body: ${response.body}`);
  }

  // Handle insufficient balance with auto-refill
  if (isInsufficientBalance) {
    const refilled = refillWallet(walletBindingId);
    if (refilled) {
      sleep(1);
      const retryResponse = http.post(`${API_BASE_URL}/api/entry/scan`, payload, params);
      
      try {
        body = JSON.parse(retryResponse.body);
      } catch (e) {
        console.error(`❌ Failed to parse retry response [VU ${__VU}]`);
      }
      
      const success = retryResponse.status === 200 && body && body.success;
      
      if (!success) {
        console.error(`❌ Entry failed after refill [VU ${__VU}]`);
        console.error(`   Wallet: ${walletBindingId}`);
        console.error(`   Status: ${retryResponse.status}`);
        console.error(`   Response: ${JSON.stringify(body)}`);
      }
      
      if (body && body.entry_type === 're_entry') {
        reentrySuccessRate.add(success);
      } else {
        entrySuccessRate.add(success);
      }
      
      check(retryResponse, {
        'entry status ok': (r) => r.status === 200 || r.status === 402,
        'entry successful': (r) => r.status === 200,
      });
      
      return success;
    }
  }

  const success = response.status === 200 && body && body.success;
  
  // Log real errors (not insufficient balance)
  if (!success && !isInsufficientBalance) {
    console.error(`❌ Entry failed [VU ${__VU}]`);
    console.error(`   Wallet: ${walletBindingId}`);
    console.error(`   Gateway: ${gatewayId}`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Response: ${JSON.stringify(body)}`);
  }
  
  if (body && body.entry_type === 're_entry') {
    reentrySuccessRate.add(success);
  } else {
    entrySuccessRate.add(success);
  }
  
  check(response, {
    'entry status ok': (r) => r.status === 200 || r.status === 402,
    'entry successful': (r) => r.status === 200,
  });

  return success;
}

function makeConcessionPurchase(walletBindingId, deviceFingerprint) {
  if (!vendorItems || vendorItems.length === 0) {
    console.error(`❌ No vendor items available for purchase`);
    return false;
  }

  const startTime = Date.now();
  
  // Random item and quantity
  const item = randomItem(vendorItems);
  const quantity = randomIntBetween(1, 3);
  
  // Random gateway (concession terminal) - use one of the test gateways
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  
  const payload = JSON.stringify({
    wallet_binding_id: walletBindingId,
    item_id: item.id,  // Changed from vendor_item_id to item_id
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

  const response = http.post(
    `${API_BASE_URL}/api/vendor/purchase`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  concessionDuration.add(duration);
  totalTransactions.add(1);
  concessionRate.add(1);

  let body = null;
  let isInsufficientBalance = false;
  
  try {
    body = JSON.parse(response.body);
    isInsufficientBalance = response.status === 402 && body.error === 'Insufficient balance';
  } catch (e) {
    console.error(`❌ Failed to parse concession response [VU ${__VU}]`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Body: ${response.body}`);
  }

  // Handle insufficient balance with auto-refill
  if (isInsufficientBalance) {
    const refilled = refillWallet(walletBindingId);
    if (refilled) {
      sleep(1);
      const retryResponse = http.post(`${API_BASE_URL}/api/vendor/purchase`, payload, params);
      
      try {
        body = JSON.parse(retryResponse.body);
      } catch (e) {
        console.error(`❌ Failed to parse retry response [VU ${__VU}]`);
      }
      
      const success = retryResponse.status === 200 && body && body.success;
      
      if (!success) {
        console.error(`❌ Concession purchase failed after refill [VU ${__VU}]`);
        console.error(`   Wallet: ${walletBindingId}`);
        console.error(`   Item: ${item.name} x${quantity}`);
        console.error(`   Gateway: ${gatewayId}`);
        console.error(`   Status: ${retryResponse.status}`);
        console.error(`   Response: ${JSON.stringify(body)}`);
      }
      
      concessionSuccessRate.add(success);
      
      check(retryResponse, {
        'concession status ok': (r) => r.status === 200 || r.status === 402,
        'concession successful': (r) => r.status === 200,
      });
      
      return success;
    }
  }

  const success = response.status === 200 && body && body.success;
  
  // Log real errors (not insufficient balance)
  if (!success && !isInsufficientBalance) {
    console.error(`❌ Concession purchase failed [VU ${__VU}]`);
    console.error(`   Wallet: ${walletBindingId}`);
    console.error(`   Item: ${item.name} x${quantity}`);
    console.error(`   Gateway: ${gatewayId}`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Response: ${JSON.stringify(body)}`);
  }
  
  concessionSuccessRate.add(success);
  
  check(response, {
    'concession status ok': (r) => r.status === 200 || r.status === 402,
    'concession successful': (r) => r.status === 200,
  });

  return success;
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Realistic Venue Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Check metrics above for:');
  console.log('  - Entry/Re-entry success rates');
  console.log('  - Concession transaction success rate');
  console.log('  - Total transactions processed');
  console.log('  - Wallet refills performed');
  console.log('  - Request rates during door rush vs late event');
  console.log('═══════════════════════════════════════════════');
}
