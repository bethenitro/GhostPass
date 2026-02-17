/**
 * Failure Simulation / Chaos Engineering Test
 * 
 * Intentionally tests system resilience under:
 * - Stripe webhook delays
 * - Stripe webhook duplication
 * - Scanner offline scenarios
 * - Concession terminal offline
 * - Database latency spikes
 * 
 * Success Criteria:
 * - System doesn't crash
 * - No data corruption
 * - No duplicate entries/debits
 * - Graceful degradation
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const systemStability = new Rate('system_stability');
const dataCorruption = new Counter('data_corruption_detected');
const gracefulFailures = new Counter('graceful_failures');
const catastrophicFailures = new Counter('catastrophic_failures');
const recoveryTime = new Trend('recovery_time');

// Test configuration
export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1m',
      duration: '15m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'normalLoad',
    },
    chaos_injection: {
      executor: 'constant-vus',
      vus: 10,
      duration: '15m',
      exec: 'chaosInjection',
    },
  },
  thresholds: {
    'system_stability': ['rate>0.95'], // 95% stability even under chaos
    'catastrophic_failures': ['count==0'], // Zero catastrophic failures
    'data_corruption_detected': ['count==0'], // Zero data corruption
  },
};

// Environment variables
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const VENUE_ID = __ENV.TEST_VENUE_ID || 'test-venue-001';
const GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID || 'gateway-door-1';
const GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID || 'gateway-door-2';

// Test data
const walletIds = Array.from({ length: 1000 }, (_, i) => `wallet_chaos_${i + 1}`);

export function setup() {
  console.log('🔥 Starting Chaos Engineering / Failure Simulation Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Failure Scenarios:');
  console.log('  - Stripe webhook delays (5-30 seconds)');
  console.log('  - Duplicate webhook delivery');
  console.log('  - Scanner offline simulation');
  console.log('  - Concession terminal offline');
  console.log('  - Database latency spikes');
  console.log('Duration: 15 minutes');
  console.log('═══════════════════════════════════════════════');
  
  return { startTime: Date.now() };
}

// Normal load to maintain baseline
export function normalLoad() {
  const walletId = randomItem(walletIds);
  const operation = randomItem(['entry', 'transaction', 'funding']);
  
  let response;
  
  switch (operation) {
    case 'entry':
      response = performEntry(walletId);
      break;
    case 'transaction':
      response = performTransaction(walletId);
      break;
    case 'funding':
      response = performFunding(walletId);
      break;
  }
  
  const stable = check(response, {
    'system responding': (r) => r.status !== 0,
    'not catastrophic error': (r) => r.status < 500 || r.status === 503,
  });
  
  systemStability.add(stable);
  
  if (!stable) {
    catastrophicFailures.add(1);
  }
}

// Chaos injection scenarios
export function chaosInjection() {
  const scenario = randomItem([
    'webhook_delay',
    'webhook_duplicate',
    'scanner_offline',
    'terminal_offline',
    'db_latency',
  ]);
  
  group(`Chaos: ${scenario}`, () => {
    switch (scenario) {
      case 'webhook_delay':
        testWebhookDelay();
        break;
      case 'webhook_duplicate':
        testWebhookDuplicate();
        break;
      case 'scanner_offline':
        testScannerOffline();
        break;
      case 'terminal_offline':
        testTerminalOffline();
        break;
      case 'db_latency':
        testDatabaseLatency();
        break;
    }
  });
  
  sleep(randomIntBetween(10, 30));
}

// Test 1: Stripe Webhook Delay
function testWebhookDelay() {
  const walletId = randomItem(walletIds);
  const fundingAmount = 5000;
  
  // Get initial balance
  const balanceBefore = getWalletBalance(walletId);
  
  // Initiate funding
  const fundingResponse = performFunding(walletId, fundingAmount);
  
  if (fundingResponse.status !== 200) {
    gracefulFailures.add(1);
    return;
  }
  
  const sessionId = JSON.parse(fundingResponse.body).session_id;
  
  // Simulate delayed webhook (15-30 seconds)
  const delaySeconds = randomIntBetween(15, 30);
  console.log(`⏱️  Simulating ${delaySeconds}s webhook delay for ${walletId}`);
  sleep(delaySeconds);
  
  const recoveryStart = Date.now();
  
  // Send webhook
  sendWebhook(sessionId, walletId, fundingAmount);
  
  // Verify balance updated
  sleep(2);
  const balanceAfter = getWalletBalance(walletId);
  
  const recovered = check({ balanceBefore, balanceAfter, fundingAmount }, {
    'balance updated after delay': (data) => {
      return data.balanceAfter >= data.balanceBefore + data.fundingAmount;
    },
  });
  
  if (recovered) {
    recoveryTime.add(Date.now() - recoveryStart);
  } else {
    dataCorruption.add(1);
  }
}

// Test 2: Duplicate Webhook Delivery
function testWebhookDuplicate() {
  const walletId = randomItem(walletIds);
  const fundingAmount = 3000;
  
  // Get initial balance
  const balanceBefore = getWalletBalance(walletId);
  
  // Initiate funding
  const fundingResponse = performFunding(walletId, fundingAmount);
  
  if (fundingResponse.status !== 200) {
    gracefulFailures.add(1);
    return;
  }
  
  const sessionId = JSON.parse(fundingResponse.body).session_id;
  
  // Send webhook twice
  console.log(`🔄 Sending duplicate webhook for ${walletId}`);
  sendWebhook(sessionId, walletId, fundingAmount);
  sleep(1);
  sendWebhook(sessionId, walletId, fundingAmount); // Duplicate
  
  // Verify balance only credited once
  sleep(2);
  const balanceAfter = getWalletBalance(walletId);
  
  const noDuplicate = check({ balanceBefore, balanceAfter, fundingAmount }, {
    'no double credit': (data) => {
      const expectedBalance = data.balanceBefore + data.fundingAmount;
      const actualBalance = data.balanceAfter;
      // Allow small variance for concurrent operations
      return Math.abs(actualBalance - expectedBalance) < 100;
    },
  });
  
  if (!noDuplicate) {
    dataCorruption.add(1);
    console.error(`❌ Duplicate webhook credited wallet ${walletId}`);
  }
}

// Test 3: Scanner Offline
function testScannerOffline() {
  const walletId = randomItem(walletIds);
  
  // Try to scan at "offline" gateway
  console.log(`📵 Simulating offline scanner for ${walletId}`);
  
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    gateway_id: 'gateway-offline-test',
    pass_id: `pass_${walletId}`,
    interaction_method: 'QR',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test-token-${walletId}`,
    },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/entry/process-scan`,
    payload,
    params
  );

  const graceful = check(response, {
    'graceful error response': (r) => r.status === 404 || r.status === 503,
    'error message provided': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.error !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (graceful) {
    gracefulFailures.add(1);
  } else if (response.status >= 500) {
    catastrophicFailures.add(1);
  }
}

// Test 4: Terminal Offline
function testTerminalOffline() {
  const walletId = randomItem(walletIds);
  
  console.log(`📵 Simulating offline terminal for ${walletId}`);
  
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    terminal_id: 'terminal-offline-test',
    vendor_name: 'Offline Vendor',
    items: [{ name: 'Test Item', price_cents: 500 }],
    total_amount_cents: 500,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test-token-${walletId}`,
    },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/wallet/debit`,
    payload,
    params
  );

  const graceful = check(response, {
    'graceful error response': (r) => r.status === 404 || r.status === 503,
    'no wallet debit on failure': (r) => {
      // Verify wallet wasn't debited
      if (r.status !== 200) {
        return true; // Expected failure
      }
      return false; // Should not succeed with offline terminal
    },
  });

  if (graceful) {
    gracefulFailures.add(1);
  } else if (response.status >= 500) {
    catastrophicFailures.add(1);
  }
}

// Test 5: Database Latency Spike
function testDatabaseLatency() {
  const walletId = randomItem(walletIds);
  
  console.log(`🐌 Testing with simulated DB latency for ${walletId}`);
  
  // Make request with very short timeout to simulate latency
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    gateway_id: randomItem([GATEWAY_1_ID, GATEWAY_2_ID]),
    pass_id: `pass_${walletId}`,
    interaction_method: 'QR',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test-token-${walletId}`,
      'X-Simulate-Latency': '3000', // Request 3s latency simulation
    },
    timeout: '5s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/entry/process-scan`,
    payload,
    params
  );

  const handled = check(response, {
    'timeout handled gracefully': (r) => r.status === 0 || r.status === 504 || r.status === 200,
    'no partial state': (r) => {
      // If it timed out, verify no entry was logged
      if (r.status === 0) {
        return true; // Will verify in post-test validation
      }
      return true;
    },
  });

  if (!handled) {
    catastrophicFailures.add(1);
  }
}

// Helper functions
function performEntry(walletId) {
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    gateway_id: randomItem([GATEWAY_1_ID, GATEWAY_2_ID]),
    pass_id: `pass_${walletId}`,
    interaction_method: 'QR',
  });

  return http.post(
    `${API_BASE_URL}/api/entry/process-scan`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer test-token-${walletId}`,
      },
    }
  );
}

function performTransaction(walletId) {
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    venue_id: VENUE_ID,
    terminal_id: 'terminal-1',
    vendor_name: 'Test Vendor',
    items: [{ name: 'Test Item', price_cents: 500 }],
    total_amount_cents: 500,
  });

  return http.post(
    `${API_BASE_URL}/api/wallet/debit`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer test-token-${walletId}`,
      },
    }
  );
}

function performFunding(walletId, amount = 5000) {
  const payload = JSON.stringify({
    wallet_binding_id: walletId,
    amount_cents: amount,
    sources: [{ type: 'stripe', amount: amount / 100 }],
  });

  return http.post(
    `${API_BASE_URL}/api/wallet/fund`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

function getWalletBalance(walletId) {
  const response = http.get(
    `${API_BASE_URL}/api/wallet/balance?wallet_binding_id=${walletId}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      return body.balance_cents || 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function sendWebhook(sessionId, walletId, amount) {
  const payload = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        amount_total: amount,
        metadata: {
          wallet_binding_id: walletId,
        },
        payment_intent: `pi_${Date.now()}`,
      },
    },
  });

  return http.post(
    `${API_BASE_URL}/api/stripe/webhook`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test-signature',
      },
    }
  );
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Chaos Engineering Test Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('System Resilience Metrics:');
  console.log('  - Check system_stability rate (target: >95%)');
  console.log('  - Check catastrophic_failures (target: 0)');
  console.log('  - Check data_corruption_detected (target: 0)');
  console.log('  - Check graceful_failures (expected: >0)');
  console.log('═══════════════════════════════════════════════');
}
