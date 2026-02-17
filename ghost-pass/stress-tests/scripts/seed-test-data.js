#!/usr/bin/env node

/**
 * Seed Test Data Script
 * 
 * Creates test data for stress testing matching actual GhostPass flow:
 * - 5,000 test wallets with device fingerprints and initial balances
 * - Test venue and gateways
 * - Test vendor items with specific IDs
 * 
 * Uses existing 'club' context (Mode A: pay-per-scan, 50 cents per scan)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const WALLET_COUNT = parseInt(process.env.TEST_WALLET_COUNT || '5000');
const INITIAL_BALANCE_CENTS = 10000; // $100 per wallet

async function main() {
  console.log('🌱 Seeding Test Data for Stress Testing');
  console.log('═══════════════════════════════════════════════\n');

  await createTestVenue();
  await createVenueEntryConfig();
  await createTestGateways();
  await createTestWallets();
  await createTestVendorItems();

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ Test Data Seeding Complete');
  console.log('📝 Using context: "club" (50 cents per scan)');
  console.log('═══════════════════════════════════════════════\n');
}

async function createTestVenue() {
  console.log('📍 Creating test venue...');

  const venueId = process.env.TEST_VENUE_ID || 'test-venue-stress-001';
  
  const venueData = {
    id: venueId,
    name: 'Stress Test Venue',
    venue_type: 'club',
    capacity: 5000,
    gateway_count: 2,
    default_service_fee: 2.5,
    default_entry_fee: 500,
  };

  const { data, error } = await supabase
    .from('venues')
    .upsert(venueData, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('  ❌ Error creating venue:', error.message);
  } else {
    console.log(`  ✅ Venue created: ${venueData.name} (ID: ${venueId})`);
  }
}

async function createVenueEntryConfig() {
  console.log('⚙️  Creating venue entry configuration...');

  const venueId = process.env.TEST_VENUE_ID || 'test-venue-stress-001';
  
  const configData = {
    venue_id: venueId,
    re_entry_allowed: true,
    initial_entry_fee_cents: 2500, // $25.00
    venue_reentry_fee_cents: 1000, // $10.00 (venue re-entry fee)
    valid_reentry_scan_fee_cents: 25, // $0.25 (VALID platform fee)
    max_reentries: null, // Unlimited
    reentry_time_limit_hours: null, // No time limit
  };

  const { data, error } = await supabase
    .from('venue_entry_configs')
    .upsert(configData, { onConflict: 'venue_id' })
    .select();

  if (error) {
    console.error('  ❌ Error creating venue entry config:', error.message);
  } else {
    console.log(`  ✅ Venue entry config created:`);
    console.log(`     - Initial entry: $${(configData.initial_entry_fee_cents / 100).toFixed(2)}`);
    console.log(`     - Re-entry venue fee: $${(configData.venue_reentry_fee_cents / 100).toFixed(2)}`);
    console.log(`     - Re-entry VALID fee: $${(configData.valid_reentry_scan_fee_cents / 100).toFixed(2)}`);
    console.log(`     - Re-entry allowed: ${configData.re_entry_allowed}`);
  }
}

async function createTestGateways() {
  console.log('🚪 Creating test gateways...');

  const gateways = [
    {
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Main Entrance - Door 1',
      type: 'ENTRY_POINT',
      status: 'ENABLED',
      employee_name: 'Test Scanner 1',
      employee_id: 'EMP001',
    },
    {
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Main Entrance - Door 2',
      type: 'ENTRY_POINT',
      status: 'ENABLED',
      employee_name: 'Test Scanner 2',
      employee_id: 'EMP002',
    },
  ];

  let gateway1Id = null;
  let gateway2Id = null;

  for (let i = 0; i < gateways.length; i++) {
    const gateway = gateways[i];
    
    // Check if gateway already exists
    const { data: existing } = await supabase
      .from('gateway_points')
      .select('id')
      .eq('venue_id', gateway.venue_id)
      .eq('name', gateway.name)
      .maybeSingle();

    if (existing) {
      console.log(`  ✅ Gateway already exists: ${gateway.name} (${existing.id})`);
      if (i === 0) gateway1Id = existing.id;
      if (i === 1) gateway2Id = existing.id;
    } else {
      const { data, error } = await supabase
        .from('gateway_points')
        .insert(gateway)
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Error creating gateway ${gateway.name}:`, error.message);
      } else {
        console.log(`  ✅ Gateway created: ${gateway.name} (${data.id})`);
        if (i === 0) gateway1Id = data.id;
        if (i === 1) gateway2Id = data.id;
      }
    }
  }

  // Save gateway IDs to a file for use in tests
  if (gateway1Id && gateway2Id) {
    console.log('\n  📝 Gateway IDs for your .env.test file:');
    console.log(`  TEST_GATEWAY_1_ID=${gateway1Id}`);
    console.log(`  TEST_GATEWAY_2_ID=${gateway2Id}`);
  }
}

async function createTestWallets() {
  console.log(`💰 Creating ${WALLET_COUNT} test wallets...`);
  console.log('   This may take a few minutes...');

  const batchSize = 100;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < WALLET_COUNT; i += batchSize) {
    const wallets = [];
    
    for (let j = 0; j < batchSize && (i + j) < WALLET_COUNT; j++) {
      const walletNum = i + j + 1;
      wallets.push({
        wallet_binding_id: `wallet_test_${walletNum}`,
        device_fingerprint: `device_test_${walletNum}`,
        balance_cents: INITIAL_BALANCE_CENTS,
        device_bound: true,
        wallet_surfaced: false,
        entry_count: 0,
      });
    }

    const { data, error } = await supabase
      .from('wallets')
      .upsert(wallets, { onConflict: 'wallet_binding_id' });

    if (error) {
      console.error(`  ❌ Error creating wallet batch ${i}-${i + batchSize}:`, error.message);
      errors += batchSize;
    } else {
      created += wallets.length;
      if (created % 1000 === 0) {
        console.log(`  ⏳ Created ${created}/${WALLET_COUNT} wallets...`);
      }
    }
  }

  console.log(`  ✅ Created ${created} wallets (${errors} errors)`);
}

async function createTestVendorItems() {
  console.log('🍔 Creating test vendor items...');

  const items = [
    {
      id: 'test-item-beer',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Beer',
      price_cents: 800,
      category: 'BEVERAGE',
      available: true,
    },
    {
      id: 'test-item-cocktail',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Cocktail',
      price_cents: 1200,
      category: 'BEVERAGE',
      available: true,
    },
    {
      id: 'test-item-soda',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Soda',
      price_cents: 400,
      category: 'BEVERAGE',
      available: true,
    },
    {
      id: 'test-item-hotdog',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Hot Dog',
      price_cents: 600,
      category: 'FOOD',
      available: true,
    },
    {
      id: 'test-item-nachos',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Nachos',
      price_cents: 900,
      category: 'FOOD',
      available: true,
    },
    {
      id: 'test-item-burger',
      venue_id: process.env.TEST_VENUE_ID || 'test-venue-stress-001',
      name: 'Burger',
      price_cents: 1100,
      category: 'FOOD',
      available: true,
    },
  ];

  for (const item of items) {
    // Upsert with specific ID
    const { error } = await supabase
      .from('vendor_items')
      .upsert(item, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Error creating/updating item ${item.name}:`, error.message);
    } else {
      console.log(`  ✅ Item ready: ${item.name} - $${(item.price_cents / 100).toFixed(2)} (ID: ${item.id})`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
