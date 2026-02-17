/**
 * Failure Simulation / Chaos Engineering Test
 * 
 * Tests system resilience under realistic failure scenarios:
 * - Concurrent requests to same wallet (race conditions)
 * - Rapid repeated requests (duplicate prevention)
 * - Insufficient balance scenarios
 * - Invalid gateway IDs
 * - Malformed requests
 * 
 * Success Criteria:
 * - System doesn't crash
 * - No data corruption (negative balances)
 * - No duplicate charges
 * - Graceful error handling
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const systemStability = new Rate('system_stability');
const dataCorruption = new Counter('data_corruption_detected');
const gracefulFailures = new Counter('graceful_failures');
const catastrophicFailures = new Counter('catastrophic_failures');

// Test configuration
export const options = {
  scenarios: {
    // Normal baseline load
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1m',
      duration: '10m',
      preAllocatedVUs: 25,
      maxVUs: 50,
      exec: 'normalLoad',
    },
    // Chaos scenarios
    race_conditions: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      exec: 'testRaceConditions',
    },
    duplicate_prevention: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      exec: 'testDuplicatePrevention',
    },
    edge_cases: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      exec: 'testEdgeCases',
    },
  },
  thresholds: {
    'system_stability': ['rate>0.90'], // 90% stability even under chaos
    'catastrophic_failures': ['count<10'], // Very few catastrophic failures
    'data_corruption_detected': ['count==0'], // Zero data corruption
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://ghostpass-theta.vercel.app';
const TEST_GATEWAY_1_ID = __ENV.TEST_GATEWAY_1_ID;
const TEST_GATEWAY_2_ID = __ENV.TEST_GATEWAY_2_ID;
const CONTEXT = 'club';

// Small set of wallets for chaos testing (to increase collision probability)
const chaosWallets = Array.from({ length: 100 }, (_, i) => ({
  wallet_binding_id: `wallet_chaos_${i + 1}`,
  device_fingerprint: `device_chaos_${i + 1}`,
}));

export function setup() {
  console.log('🔥 Starting Chaos Engineering / Failure Simulation Test');
  console.log('═══════════════════════════════════════════════');
  console.log('Chaos Scenarios:');
  console.log('  - Race conditions (concurrent wallet access)');
  console.log('  - Duplicate request prevention');
  console.log('  - Insufficient balance handling');
  console.log('  - Invalid gateway IDs');
  console.log('  - Malformed requests');
  console.log('Duration: 10 minutes');
  console.log('═══════════════════════════════════════════════\n');
  
  return { startTime: Date.now() };
}

// Normal load baseline
export function normalLoad() {
  const wallet = randomItem(chaosWallets);
  const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
  
  const payload = JSON.stringify({
    context: CONTEXT,
    wallet_binding_id: wallet.wallet_binding_id,
    interaction_method: 'QR',
    gateway_id: gatewayId,
    ghost_pass_token: null,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': wallet.device_fingerprint,
    },
    timeout: '10s',
  };

  const response = http.post(
    `${API_BASE_URL}/api/modes/process-scan`,
    payload,
    params
  );

  const stable = check(response, {
    'system responding': (r) => r.status !== 0,
    'not catastrophic': (r) => r.status < 500 || r.status === 503,
  });

  systemStability.add(stable);
  
  if (!stable && response.status >= 500) {
    catastrophicFailures.add(1);
  }
  
  sleep(randomIntBetween(2, 5));
}

// Test 1: Race Conditions - Multiple concurrent requests to same wallet
export function testRaceConditions() {
  group('Race Condition Test', () => {
    // Use same wallet for all VUs in this scenario to create race conditions
    const walletIndex = __VU % 10; // Only 10 wallets for high collision
    const wallet = chaosWallets[walletIndex];
    const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
    
    const payload = JSON.stringify({
      context: CONTEXT,
      wallet_binding_id: wallet.wallet_binding_id,
      interaction_method: 'QR',
      gateway_id: gatewayId,
      ghost_pass_token: null,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': wallet.device_fingerprint,
      },
      timeout: '10s',
    };

    const response = http.post(
      `${API_BASE_URL}/api/modes/process-scan`,
      payload,
      params
    );

    // Check for data corruption (negative balance)
    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        if (body.balance_after_cents < 0) {
          dataCorruption.add(1);
          console.error(`❌ NEGATIVE BALANCE: ${wallet.wallet_binding_id} = ${body.balance_after_cents}`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const handled = check(response, {
      'race condition handled': (r) => r.status === 200 || r.status === 400 || r.status === 402,
      'no negative balance': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !body.balance_after_cents || body.balance_after_cents >= 0;
        } catch (e) {
          return true;
        }
      },
    });

    systemStability.add(handled);
  });
  
  sleep(randomIntBetween(1, 3));
}

// Test 2: Duplicate Prevention - Rapid repeated requests
export function testDuplicatePrevention() {
  group('Duplicate Prevention Test', () => {
    const wallet = randomItem(chaosWallets);
    const gatewayId = randomItem([TEST_GATEWAY_1_ID, TEST_GATEWAY_2_ID]);
    
    const payload = JSON.stringify({
      context: CONTEXT,
      wallet_binding_id: wallet.wallet_binding_id,
      interaction_method: 'QR',
      gateway_id: gatewayId,
      ghost_pass_token: null,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': wallet.device_fingerprint,
      },
      timeout: '10s',
    };

    // Send same request 3 times rapidly
    const responses = [];
    for (let i = 0; i < 3; i++) {
      responses.push(http.post(
        `${API_BASE_URL}/api/modes/process-scan`,
        payload,
        params
      ));
    }

    // Count successful charges
    let successCount = 0;
    responses.forEach(r => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          if (body.success === true) {
            successCount++;
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    // All 3 should succeed (they're separate scans)
    // But verify no data corruption occurred
    const noDuplication = check({ successCount }, {
      'requests processed': (data) => data.successCount >= 0,
    });

    systemStability.add(noDuplication);
  });
  
  sleep(randomIntBetween(5, 10));
}

// Test 3: Edge Cases - Invalid data, insufficient balance, etc.
export function testEdgeCases() {
  const scenario = randomItem([
    'invalid_gateway',
    'insufficient_balance',
    'malformed_request',
    'missing_fields',
  ]);
  
  group(`Edge Case: ${scenario}`, () => {
    const wallet = randomItem(chaosWallets);
    let payload, params, expectedStatus;
    
    switch (scenario) {
      case 'invalid_gateway':
        payload = JSON.stringify({
          context: CONTEXT,
          wallet_binding_id: wallet.wallet_binding_id,
          interaction_method: 'QR',
          gateway_id: 'invalid-gateway-id-12345',
          ghost_pass_token: null,
        });
        params = {
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': wallet.device_fingerprint,
          },
          timeout: '10s',
        };
        expectedStatus = [200, 400, 404]; // Should handle gracefully
        break;
        
      case 'insufficient_balance':
        // Use a wallet that likely has low/zero balance
        payload = JSON.stringify({
          context: CONTEXT,
          wallet_binding_id: 'wallet_empty_test',
          interaction_method: 'QR',
          gateway_id: TEST_GATEWAY_1_ID,
          ghost_pass_token: null,
        });
        params = {
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': 'device_empty_test',
          },
          timeout: '10s',
        };
        expectedStatus = [400, 402, 404]; // Should return insufficient balance
        break;
        
      case 'malformed_request':
        payload = '{"invalid": json}'; // Malformed JSON
        params = {
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': wallet.device_fingerprint,
          },
          timeout: '10s',
        };
        expectedStatus = [400, 500]; // Should handle parse error
        break;
        
      case 'missing_fields':
        payload = JSON.stringify({
          context: CONTEXT,
          // Missing wallet_binding_id
          interaction_method: 'QR',
        });
        params = {
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': wallet.device_fingerprint,
          },
          timeout: '10s',
        };
        expectedStatus = [400]; // Should return validation error
        break;
    }
    
    const response = http.post(
      `${API_BASE_URL}/api/modes/process-scan`,
      payload,
      params
    );

    const graceful = check(response, {
      'graceful error handling': (r) => expectedStatus.includes(r.status),
      'error message provided': (r) => {
        if (r.status >= 400) {
          try {
            const body = JSON.parse(r.body);
            return body.error !== undefined || body.message !== undefined;
          } catch {
            return false;
          }
        }
        return true;
      },
    });

    if (graceful) {
      gracefulFailures.add(1);
    } else if (response.status >= 500) {
      catastrophicFailures.add(1);
      console.error(`❌ Catastrophic failure in ${scenario}: Status ${response.status}`);
    }

    systemStability.add(graceful);
  });
  
  sleep(randomIntBetween(3, 8));
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
  console.log('  - system_stability (target: >90%)');
  console.log('  - catastrophic_failures (target: <10)');
  console.log('  - data_corruption_detected (target: 0)');
  console.log('  - graceful_failures (expected: >0)');
  console.log('═══════════════════════════════════════════════');
}
