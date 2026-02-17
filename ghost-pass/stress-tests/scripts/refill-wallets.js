#!/usr/bin/env node

/**
 * Refill Wallets Script
 * 
 * Refills test wallet balances to $100 each for continued stress testing.
 * Use this when wallets run out of balance during testing.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const REFILL_AMOUNT_CENTS = 100000; // $100

async function main() {
  console.log('💰 Refilling Test Wallet Balances');
  console.log('═══════════════════════════════════════════════\n');

  // Get all test wallets with low balance
  const { data: wallets, error } = await supabase
    .from('wallets')
    .select('wallet_binding_id, balance_cents')
    .like('wallet_binding_id', 'wallet_test_%')
    .lt('balance_cents', 10000); // Less than $10

  if (error) {
    console.error('❌ Error fetching wallets:', error.message);
    process.exit(1);
  }

  if (!wallets || wallets.length === 0) {
    console.log('✅ All wallets have sufficient balance (>$10)');
    console.log('   No refills needed.\n');
    return;
  }

  console.log(`Found ${wallets.length} wallets with low balance (<$10)`);
  console.log(`Refilling to $${(REFILL_AMOUNT_CENTS / 100).toFixed(2)} each...\n`);

  // Refill in batches
  const batchSize = 100;
  let refilled = 0;

  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    const walletIds = batch.map(w => w.wallet_binding_id);

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_cents: REFILL_AMOUNT_CENTS })
      .in('wallet_binding_id', walletIds);

    if (updateError) {
      console.error(`❌ Error refilling batch ${i}-${i + batchSize}:`, updateError.message);
    } else {
      refilled += batch.length;
      if (refilled % 500 === 0 || refilled === wallets.length) {
        console.log(`  ⏳ Refilled ${refilled}/${wallets.length} wallets...`);
      }
    }
  }

  console.log(`\n✅ Refilled ${refilled} wallets to $${(REFILL_AMOUNT_CENTS / 100).toFixed(2)} each`);
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
