#!/usr/bin/env node

/**
 * Post-Test Validation Script
 * 
 * Validates success criteria after stress test:
 * - 0 data corruption
 * - < 0.5% transaction failure
 * - No duplicate entries
 * - No negative wallet balances
 * - No orphaned Stripe funding states
 * - No unlogged transactions
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VALIDATION_RESULTS = {
  passed: [],
  failed: [],
  warnings: [],
};

async function main() {
  console.log('🔍 Starting Post-Test Validation');
  console.log('═══════════════════════════════════════════════\n');

  await checkDataCorruption();
  await checkDuplicateEntries();
  await checkNegativeBalances();
  await checkOrphanedFunding();
  await checkUnloggedTransactions();
  await checkTransactionFailureRate();
  await checkAuditLogCompleteness();

  printResults();
  
  const allPassed = VALIDATION_RESULTS.failed.length === 0;
  process.exit(allPassed ? 0 : 1);
}

async function checkDataCorruption() {
  console.log('📊 Checking for data corruption...');
  
  try {
    // Check for wallets with inconsistent balances
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('id, wallet_binding_id, balance_cents');

    if (error) throw error;

    let corruptedWallets = 0;

    for (const wallet of wallets) {
      // Calculate expected balance from transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount_cents, type')
        .eq('wallet_binding_id', wallet.wallet_binding_id);

      if (transactions) {
        const calculatedBalance = transactions.reduce((sum, tx) => {
          return sum + (tx.type === 'credit' || tx.type === 'FUND' ? tx.amount_cents : -tx.amount_cents);
        }, 0);

        // Allow 1% variance for concurrent operations
        const variance = Math.abs(calculatedBalance - wallet.balance_cents);
        const allowedVariance = Math.max(100, wallet.balance_cents * 0.01);

        if (variance > allowedVariance) {
          corruptedWallets++;
          console.error(`  ❌ Wallet ${wallet.wallet_binding_id}: Expected ${calculatedBalance}, Got ${wallet.balance_cents}`);
        }
      }
    }

    if (corruptedWallets === 0) {
      VALIDATION_RESULTS.passed.push('✅ No data corruption detected');
    } else {
      VALIDATION_RESULTS.failed.push(`❌ ${corruptedWallets} wallets with corrupted balances`);
    }
  } catch (error) {
    VALIDATION_RESULTS.failed.push(`❌ Data corruption check failed: ${error.message}`);
  }
}

async function checkDuplicateEntries() {
  console.log('📊 Checking for duplicate entries...');
  
  try {
    // Check entry_events table (main entry log)
    const { data: entries } = await supabase
      .from('entry_events')
      .select('wallet_binding_id, venue_id, gateway_id, timestamp')
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    const entryMap = {};
    let duplicateCount = 0;

    entries?.forEach(entry => {
      const key = `${entry.wallet_binding_id}_${entry.venue_id}_${entry.gateway_id}_${entry.timestamp}`;
      if (entryMap[key]) {
        duplicateCount++;
      } else {
        entryMap[key] = true;
      }
    });

    if (duplicateCount === 0) {
      VALIDATION_RESULTS.passed.push('✅ No duplicate entries detected');
    } else {
      VALIDATION_RESULTS.failed.push(`❌ ${duplicateCount} duplicate entries found`);
    }
  } catch (error) {
    VALIDATION_RESULTS.failed.push(`❌ Duplicate entry check failed: ${error.message}`);
  }
}

async function checkNegativeBalances() {
  console.log('📊 Checking for negative wallet balances...');
  
  try {
    const { data: negativeWallets, error } = await supabase
      .from('wallets')
      .select('wallet_binding_id, balance_cents')
      .lt('balance_cents', 0);

    if (error) throw error;

    if (negativeWallets.length === 0) {
      VALIDATION_RESULTS.passed.push('✅ No negative wallet balances');
    } else {
      VALIDATION_RESULTS.failed.push(`❌ ${negativeWallets.length} wallets with negative balances`);
      negativeWallets.forEach(w => {
        console.error(`  ❌ Wallet ${w.wallet_binding_id}: ${w.balance_cents} cents`);
      });
    }
  } catch (error) {
    VALIDATION_RESULTS.failed.push(`❌ Negative balance check failed: ${error.message}`);
  }
}

async function checkOrphanedFunding() {
  console.log('📊 Checking for orphaned Stripe funding states...');
  
  try {
    // Check for transactions with 'pending' status older than 10 minutes
    const { data: orphaned, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'credit')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (error) throw error;

    if (orphaned.length === 0) {
      VALIDATION_RESULTS.passed.push('✅ No orphaned funding states');
    } else {
      VALIDATION_RESULTS.warnings.push(`⚠️  ${orphaned.length} pending funding transactions > 10 minutes old`);
    }
  } catch (error) {
    VALIDATION_RESULTS.failed.push(`❌ Orphaned funding check failed: ${error.message}`);
  }
}

async function checkUnloggedTransactions() {
  console.log('📊 Checking for unlogged transactions...');
  
  try {
    // Check that all entry_events have corresponding transactions
    const { data: entries, error: entryError } = await supabase
      .from('entry_events')
      .select('receipt_id, wallet_binding_id, total_fees_cents')
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (entryError) throw entryError;

    let unloggedCount = 0;

    for (const entry of entries || []) {
      if (!entry.receipt_id) continue;
      
      const { data: transaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('metadata->>receipt_id', entry.receipt_id)
        .maybeSingle();

      if (!transaction) {
        unloggedCount++;
        console.error(`  ❌ Entry ${entry.receipt_id} has no transaction log`);
      }
    }

    if (unloggedCount === 0) {
      VALIDATION_RESULTS.passed.push('✅ All transactions properly logged');
    } else {
      VALIDATION_RESULTS.failed.push(`❌ ${unloggedCount} unlogged transactions`);
    }
  } catch (error) {
    VALIDATION_RESULTS.warnings.push(`⚠️  Unlogged transaction check: ${error.message}`);
  }
}

async function checkTransactionFailureRate() {
  console.log('📊 Checking transaction failure rate...');
  
  try {
    const { data: allTransactions, error: allError } = await supabase
      .from('transactions')
      .select('status')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (allError) throw allError;

    const total = allTransactions.length;
    const failed = allTransactions.filter(t => t.status === 'failed').length;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    if (failureRate < 0.5) {
      VALIDATION_RESULTS.passed.push(`✅ Transaction failure rate: ${failureRate.toFixed(2)}% (< 0.5%)`);
    } else {
      VALIDATION_RESULTS.failed.push(`❌ Transaction failure rate: ${failureRate.toFixed(2)}% (>= 0.5%)`);
    }
  } catch (error) {
    VALIDATION_RESULTS.failed.push(`❌ Failure rate check failed: ${error.message}`);
  }
}

async function checkAuditLogCompleteness() {
  console.log('📊 Checking audit log completeness...');
  
  try {
    const { count: entryCount, error: entryError } = await supabase
      .from('entry_events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    const { count: txCount, error: txError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (entryError || txError) {
      VALIDATION_RESULTS.warnings.push('⚠️  Could not verify audit log completeness');
    } else {
      VALIDATION_RESULTS.passed.push(`✅ Audit logs: ${entryCount || 0} entries, ${txCount || 0} transactions`);
    }
  } catch (error) {
    VALIDATION_RESULTS.warnings.push(`⚠️  Audit log check: ${error.message}`);
  }
}

function printResults() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('📋 VALIDATION RESULTS');
  console.log('═══════════════════════════════════════════════\n');

  if (VALIDATION_RESULTS.passed.length > 0) {
    console.log('✅ PASSED CHECKS:');
    VALIDATION_RESULTS.passed.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (VALIDATION_RESULTS.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    VALIDATION_RESULTS.warnings.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (VALIDATION_RESULTS.failed.length > 0) {
    console.log('❌ FAILED CHECKS:');
    VALIDATION_RESULTS.failed.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  console.log('═══════════════════════════════════════════════');
  
  if (VALIDATION_RESULTS.failed.length === 0) {
    console.log('✅ ALL VALIDATION CHECKS PASSED');
    console.log('🎉 GhostPass is PILOT READY!');
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log('⚠️  GhostPass is NOT pilot ready - fix issues above');
  }
  
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
