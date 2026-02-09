# Stripe Integration for Ghost Pass

This document explains the Stripe payment integration implemented for Ghost Pass wallet funding.

## Overview

The integration follows Stripe's best practices for 2024-2025:
- Uses **Checkout Sessions API** (recommended over Payment Intents API)
- Implements webhook-based payment confirmation
- Supports secure payment processing with PCI compliance
- Automatic wallet balance updates after successful payments

## Architecture

### Frontend Flow
1. User selects amount to add to wallet
2. User clicks "Add Funds" with Stripe payment method selected
3. Frontend calls `/api/stripe/create-checkout-session`
4. User is redirected to Stripe-hosted checkout page
5. After payment, user is redirected back to success/cancel URL
6. Wallet balance is updated via webhook (not redirect)

### Backend Components

#### 1. Create Checkout Session (`/api/stripe/create-checkout-session.ts`)
- Creates a Stripe Checkout Session
- Includes wallet metadata for tracking
- Returns checkout URL for redirect
- Session expires after 24 hours

#### 2. Webhook Handler (`/api/stripe/webhook.ts`)
- Receives Stripe webhook events
- Verifies webhook signature for security
- Updates wallet balance on successful payment
- Records transactions in database

## Setup Instructions

### 1. Get Stripe API Keys

1. Sign up at [stripe.com](https://stripe.com)
2. Get your API keys from the Dashboard
3. Use test keys for development:
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`

### 2. Environment Variables

Add to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Stripe Webhook Secret (get this after setting up webhook)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Set Up Webhook Endpoint

#### For Development (using Stripe CLI):

```bash
# Install Stripe CLI
# https://docs.stripe.com/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Copy the webhook signing secret and add to .env
```

#### For Production (Vercel):

1. Deploy your app to Vercel
2. Go to Stripe Dashboard → Developers → Webhooks
3. Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret to your Vercel environment variables

### 4. Test the Integration

#### Test Cards (Stripe Test Mode):

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires Authentication: 4000 0025 0000 3155

Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

#### Testing Flow:

1. Start Vercel dev server: `npx vercel dev --listen 3001`
2. Start Vite dev server: `npm run dev`
3. Start Stripe webhook forwarding: `stripe listen --forward-to localhost:3001/api/stripe/webhook`
4. Navigate to wallet and click "Add Funds"
5. Select amount and click "Add Funds" button
6. Complete payment on Stripe Checkout
7. Verify wallet balance updates

## Security Features

### 1. Webhook Signature Verification
All webhook events are verified using Stripe's signature to ensure they come from Stripe and haven't been tampered with.

### 2. PCI Compliance
- No card data touches your servers
- Stripe handles all sensitive payment information
- Checkout is hosted by Stripe (PCI Level 1 certified)

### 3. Metadata Tracking
- Wallet ID and device fingerprint stored in session metadata
- Enables proper attribution and fraud prevention
- Helps with customer support and reconciliation

## Payment Flow Diagram

```
User → Frontend → Create Session API → Stripe
                                         ↓
User ← Redirect ← Session URL ← ← ← ← ← ←
  ↓
Stripe Checkout Page
  ↓
Payment Success
  ↓
Stripe → Webhook → Update Balance → Database
  ↓
User ← Redirect ← Success URL
```

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook secret is correct in `.env`
2. Verify Stripe CLI is running: `stripe listen`
3. Check webhook endpoint is accessible
4. Review Stripe Dashboard → Developers → Webhooks → Logs

### Payment Not Updating Balance

1. Check webhook handler logs
2. Verify wallet_binding_id in session metadata
3. Check database connection
4. Review transaction records in database

### Checkout Session Creation Fails

1. Verify Stripe secret key is correct
2. Check amount is at least $0.50 (50 cents minimum)
3. Verify success_url and cancel_url are valid
4. Check API error response for details

## Best Practices Implemented

✅ **Checkout Sessions API** - Recommended over Payment Intents
✅ **Webhook-based confirmation** - Don't trust client-side redirects
✅ **Signature verification** - Verify all webhook events
✅ **Metadata tracking** - Store wallet ID for proper attribution
✅ **Idempotency** - Handle duplicate webhook events gracefully
✅ **Error handling** - Proper error messages and logging
✅ **Test mode support** - Easy testing with Stripe test cards

## Future Enhancements

- [ ] Add support for Apple Pay / Google Pay
- [ ] Implement subscription billing for Ghost Pass
- [ ] Add payment method saving for faster checkout
- [ ] Support multiple currencies
- [ ] Add Stripe Tax for automatic tax calculation
- [ ] Implement refund functionality
- [ ] Add payment analytics and reporting

## Resources

- [Stripe Checkout Documentation](https://docs.stripe.com/payments/checkout)
- [Stripe Webhooks Guide](https://docs.stripe.com/webhooks)
- [Stripe Testing Guide](https://docs.stripe.com/testing)
- [Stripe API Reference](https://docs.stripe.com/api)
- [Stripe Best Practices](https://docs.stripe.com/security/guide)

## Support

For Stripe-related issues:
- Check [Stripe Status](https://status.stripe.com/)
- Review [Stripe Documentation](https://docs.stripe.com/)
- Contact Stripe Support from your Dashboard

For Ghost Pass integration issues:
- Check application logs
- Review webhook event logs in Stripe Dashboard
- Verify environment variables are set correctly
