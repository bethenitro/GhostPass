/**
 * Re-Entry Logic Stress Test
 * 
 * Tests venue entry and re-entry flow using actual GhostPass endpoints:
 * 1. User enters (initial entry)
 * 2. User exits (simulated with delay)
 * 3. User re-enters (re-entry)
 * 
 * Verifies:
 * - Entry count increments properly (1, 2, 3, etc.)
 * - Initial entry fee applies on first entry
 * - Re-entry venue fee applies on subsequent entries
 * - Re-entry VALID scan fee (25 cents) applies on re-entries
 * - Entries logged separately with correct entry_type
 * - entry_events table tracks all entries
 * 
 * Success Criteria:
 * - < 500ms response time (p95)
 * - < 0.5% failure rate
 * - Entry numbers increment correctly
 * - Fees calculated correctly for each entry type
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const entrySuccessRate = new Rate('entry_success_rate');
const reentrySuccessRate = new Rate('reentry_success_rate');
const entryDuration = new Trend('entry_duration');
const feeAccuracy = new Rate('fee_accuracy');
const entryNumberAccuracy = new Rate('entry_number_accuracy');
const incorrectFees = new Counter('incorrect_fees');
const incorrectEntryNumbers = new Counter('incorrect_entry_numbers');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 30 },   // Ramp up to 30 VUs
    { duration: '3m', target: 60 },   // Ramp up to 60 VUs
    { duration: '10m', target: 60 },  // Stay at 60 VUs
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'entry_success_rate': ['rate>0.995'],
    'reentry_success_rate': ['rate>0.995'],
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.005'],
    'fee_accuracy': ['rate>0.99'],
    'entry_number_accuracy': ['rate>0.99'],
    'incorrect_fees': ['count==0'],
    'incorrect_entry_numbers': ['count==0'],
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-stress-001';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;

// Expected fees (should match venue_entry_configs in database)
const EXPECTED_INITIAL_ENTRY_FEE = 2500; // $25.00
const EXPECTED_VENUE_REENTRY_FEE = 1000; // $10.00 (venue re-entry fee)
const EXPECTED_VALID_REENTRY_FEE = 25;   // $0.25 (VALID platform fee)

export function setup() {
  console.log('🚪 Starting Re-Entry Logic Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Configuration:');
  console.log(`  API: ${API_BASE_URL}`);
  console.log(`  Venue: ${TEST_VENUE_ID}`);
  console.log('Test Flow:');
  console.log('  1. Initial entry (charge initial fee)');
  console.log('  2. Exit (simulated delay)');
  console.log('  3. Re-entry (charge re-entry fees)');
  console.log('  4. Repeat re-entries');
  console.log('Verification:');
  console.log('  - Entry count increments: 1, 2, 3, ...');
  console.log('  - Initial entry fee: $25.00');
  console.log('  - Re-entry venue fee: $10.00');
  console.log('  - Re-entry VALID fee: $0.25');
  console.log('  - Separate logging per entry');
  console.log('═══════════════════════════════════════════════\n');
  
  return { startTime: Date.now() };
}

export default function (data) {
  const vuId = __VU;
  
  // Each VU represents a unique wallet
  const walletNum = ((vuId - 1) % 5000) + 1;
  const walletBindingId = `wallet_test_${walletNum}`;
  const deviceFingerprint = `device_test_${walletNum}`;
  
  // Alternate between gateways
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  
  // Simulate entry -> exit -> re-entry flow
  group('Initial Entry', () => {
    const result = processEntry(walletBindingId, deviceFingerprint, gatewayId, 1);
    
    if (result.success) {
      entrySuccessRate.add(true);
      
      // Verify it's marked as initial entry
      if (result.entry_type === 'initial' && result.entry_number === 1) {
        entryNumberAccuracy.add(true);
      } else {
        entryNumberAccuracy.add(false);
        incorrectEntryNumbers.add(1);
        console.error(`❌ Incorrect entry type/number [VU ${vuId}]`);
        console.error(`   Expected: initial, entry #1`);
        console.error(`   Got: ${result.entry_type}, entry #${result.entry_number}`);
      }
      
      // Verify initial entry fee
      if (result.fees.initial_entry_fee_cents === EXPECTED_INITIAL_ENTRY_FEE &&
          result.fees.venue_reentry_fee_cents === 0 &&
          result.fees.valid_reentry_scan_fee_cents === 0) {
        feeAccuracy.add(true);
      } else {
        feeAccuracy.add(false);
        incorrectFees.add(1);
        console.error(`❌ Incorrect initial entry fees [VU ${vuId}]`);
        console.error(`   Expected: initial=${EXPECTED_INITIAL_ENTRY_FEE}, venue_reentry=0, valid_reentry=0`);
        console.error(`   Got: initial=${result.fees.initial_entry_fee_cents}, venue_reentry=${result.fees.venue_reentry_fee_cents}, valid_reentry=${result.fees.valid_reentry_scan_fee_cents}`);
      }
    } else {
      entrySuccessRate.add(false);
    }
  });
  
  // Simulate user exiting venue (wait 5-10 seconds)
  sleep(randomIntBetween(5, 10));
  
  // Re-entry #1
  group('Re-Entry #1', () => {
    const result = processEntry(walletBindingId, deviceFingerprint, gatewayId, 2);
    
    if (result.success) {
      reentrySuccessRate.add(true);
      
      // Verify it's marked as re-entry with correct number
      if (result.entry_type === 're_entry' && result.entry_number === 2) {
        entryNumberAccuracy.add(true);
      } else {
        entryNumberAccuracy.add(false);
        incorrectEntryNumbers.add(1);
        console.error(`❌ Incorrect re-entry type/number [VU ${vuId}]`);
        console.error(`   Expected: re_entry, entry #2`);
        console.error(`   Got: ${result.entry_type}, entry #${result.entry_number}`);
      }
      
      // Verify re-entry fees
      if (result.fees.initial_entry_fee_cents === 0 &&
          result.fees.venue_reentry_fee_cents === EXPECTED_VENUE_REENTRY_FEE &&
          result.fees.valid_reentry_scan_fee_cents === EXPECTED_VALID_REENTRY_FEE) {
        feeAccuracy.add(true);
      } else {
        feeAccuracy.add(false);
        incorrectFees.add(1);
        console.error(`❌ Incorrect re-entry fees [VU ${vuId}]`);
        console.error(`   Expected: initial=0, venue_reentry=${EXPECTED_VENUE_REENTRY_FEE}, valid_reentry=${EXPECTED_VALID_REENTRY_FEE}`);
        console.error(`   Got: initial=${result.fees.initial_entry_fee_cents}, venue_reentry=${result.fees.venue_reentry_fee_cents}, valid_reentry=${result.fees.valid_reentry_scan_fee_cents}`);
      }
    } else {
      reentrySuccessRate.add(false);
    }
  });
  
  // Simulate another exit
  sleep(randomIntBetween(5, 10));
  
  // Re-entry #2
  group('Re-Entry #2', () => {
    const result = processEntry(walletBindingId, deviceFingerprint, gatewayId, 3);
    
    if (result.success) {
      reentrySuccessRate.add(true);
      
      // Verify entry number increments
      if (result.entry_type === 're_entry' && result.entry_number === 3) {
        entryNumberAccuracy.add(true);
      } else {
        entryNumberAccuracy.add(false);
        incorrectEntryNumbers.add(1);
        console.error(`❌ Incorrect re-entry type/number [VU ${vuId}]`);
        console.error(`   Expected: re_entry, entry #3`);
        console.error(`   Got: ${result.entry_type}, entry #${result.entry_number}`);
      }
      
      // Verify re-entry fees (same as first re-entry)
      if (result.fees.initial_entry_fee_cents === 0 &&
          result.fees.venue_reentry_fee_cents === EXPECTED_VENUE_REENTRY_FEE &&
          result.fees.valid_reentry_scan_fee_cents === EXPECTED_VALID_REENTRY_FEE) {
        feeAccuracy.add(true);
      } else {
        feeAccuracy.add(false);
        incorrectFees.add(1);
      }
    } else {
      reentrySuccessRate.add(false);
    }
  });
  
  // Wait before next iteration
  sleep(randomIntBetween(10, 20));
}

function processEntry(walletBindingId, deviceFingerprint, gatewayId, expectedEntryNumber) {
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
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/entry/scan`,
    payload,
    params
  );

  const duration = Date.now() - startTime;
  entryDuration.add(duration);

  // Parse response
  let result = {
    success: false,
    entry_type: null,
    entry_number: 0,
    fees: {
      initial_entry_fee_cents: 0,
      venue_reentry_fee_cents: 0,
      valid_reentry_scan_fee_cents: 0,
      total_fees_cents: 0,
    },
  };

  try {
    const body = JSON.parse(response.body);
    
    if (response.status === 200 && body.success) {
      result.success = true;
      result.entry_type = body.entry_type;
      result.entry_number = body.entry_number;
      result.fees = body.fees;
    } else if (response.status !== 402) {
      // Log real errors (not insufficient balance)
      console.error(`❌ Entry failed [VU ${__VU}] Status: ${response.status}`);
      console.error(`   URL: ${API_BASE_URL}/api/entry/scan`);
      console.error(`   Wallet: ${walletBindingId}`);
      console.error(`   Expected entry #${expectedEntryNumber}`);
      console.error(`   Response: ${JSON.stringify(body)}`);
    }
  } catch (e) {
    console.error(`❌ Failed to parse entry response [VU ${__VU}]`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Body: ${response.body}`);
  }

  // Check response
  check(response, {
    'status is 200 or 402': (r) => r.status === 200 || r.status === 402,
    'entry successful': (r) => {
      try {
        const body = JSON.parse(r.body);
        return r.status === 200 && body.success === true;
      } catch (e) {
        return false;
      }
    },
    'response time < 500ms': () => duration < 500,
  });

  return result;
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Re-Entry Logic Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Check metrics above for:');
  console.log('  - Entry/Re-entry success rates');
  console.log('  - Fee calculation accuracy');
  console.log('  - Entry number accuracy');
  console.log('  - Incorrect fees count (should be 0)');
  console.log('  - Incorrect entry numbers count (should be 0)');
  console.log('═══════════════════════════════════════════════');
}
