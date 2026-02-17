#!/usr/bin/env node

/**
 * Create Test Users Script
 * 
 * Creates test users in Supabase Auth for stress testing
 * Generates auth tokens that can be used in k6 tests
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TEST_USER_COUNT = 100; // Create 100 test users for stress testing
const TEST_PASSWORD = 'TestPassword123!'; // Same password for all test users

async function main() {
  console.log('🔐 Creating Test Users for Stress Testing');
  console.log('═══════════════════════════════════════════════\n');

  const testUsers = [];
  const batchSize = 10;

  for (let i = 0; i < TEST_USER_COUNT; i += batchSize) {
    const batch = [];
    
    for (let j = 0; j < batchSize && (i + j) < TEST_USER_COUNT; j++) {
      const userNum = i + j + 1;
      batch.push(createTestUser(userNum));
    }

    const results = await Promise.all(batch);
    testUsers.push(...results.filter(r => r !== null));

    console.log(`  ⏳ Created ${testUsers.length}/${TEST_USER_COUNT} users...`);
  }

  // Save user tokens to file
  const tokensFile = {
    created_at: new Date().toISOString(),
    user_count: testUsers.length,
    users: testUsers,
  };

  writeFileSync(
    'test-users-tokens.json',
    JSON.stringify(tokensFile, null, 2)
  );

  console.log(`\n✅ Created ${testUsers.length} test users`);
  console.log(`📄 Tokens saved to: test-users-tokens.json`);
  console.log('\n═══════════════════════════════════════════════');
}

async function createTestUser(userNum) {
  const email = `test-user-${userNum}@ghostpass-stress-test.local`;
  
  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      // User might already exist, try to get existing user
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const existing = existingUser?.users.find(u => u.email === email);
      
      if (existing) {
        // Sign in to get token
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password: TEST_PASSWORD,
        });

        if (signInData?.session) {
          return {
            user_id: existing.id,
            email,
            access_token: signInData.session.access_token,
          };
        }
      }
      
      console.error(`  ❌ Error creating user ${email}:`, authError.message);
      return null;
    }

    // Sign in to get access token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });

    if (signInError || !signInData?.session) {
      console.error(`  ❌ Error signing in user ${email}:`, signInError?.message);
      return null;
    }

    // Create user record in public.users table
    await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        role: 'USER',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    return {
      user_id: authData.user.id,
      email,
      access_token: signInData.session.access_token,
    };

  } catch (error) {
    console.error(`  ❌ Error with user ${email}:`, error.message);
    return null;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
