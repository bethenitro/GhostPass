#!/usr/bin/env node

/**
 * VAPID Key Generator
 * 
 * Generates VAPID keys for Web Push notifications.
 * Run with: node scripts/generate-vapid-keys.js
 */

import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

console.log('🔑 Generating VAPID keys for Ghost Pass push notifications...\n');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID keys generated successfully!\n');
console.log('📋 Add these to your .env file:\n');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('VAPID_SUBJECT=mailto:support@ghostpass.app\n');

// Optionally write to .env file
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Please add the keys manually.\n');
} else if (fs.existsSync(envExamplePath)) {
  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Replace placeholder values
  envContent = envContent.replace('your_vapid_public_key', vapidKeys.publicKey);
  envContent = envContent.replace('your_vapid_private_key', vapidKeys.privateKey);
  
  // Write to .env
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with VAPID keys!\n');
  console.log('⚠️  Remember to update other environment variables in .env\n');
} else {
  console.log('⚠️  No .env.example found. Please create .env manually.\n');
}

console.log('🎫 Ghost Pass push notifications are ready to configure!');
console.log('📚 See BACKEND_IMPLEMENTATION.md for setup instructions.\n');
