# 🎯 GHOST PASS + SENATE PILOT-READY ACTION PLAN

**Client:** Your Client  
**Project:** Ghost Pass + Senate Integration  
**Objective:** Take system to PILOT-READY status  
**Approach:** Integration and wiring, not redesign

---

## 📋 EXECUTIVE SUMMARY

### Current State Analysis
- **Backend:** ~70% complete - Core wallet, entry tracking, Senate, payment infrastructure exist
- **Frontend:** ~40% complete - Basic components exist but missing critical flows
- **Integration:** ~50% complete - APIs exist but frontend connections incomplete
- **PWA:** ~30% complete - Manifest exists, service worker needs work

### Critical Gaps
1. Off-site wallet direct access (PRIMARY entry point)
2. PWA "Add to Home Screen" flow
3. Single-event ticket support
4. Event & Venue management system
5. QR code generation
6. Admin panel UI (backend exists, frontend missing)
7. Stripe webhook handlers
8. Load testing and concurrency verification

---

## 🎯 PHASE 1: CRITICAL MUST-HAVES (PILOT BLOCKERS)

### 1.1 WHERE GHOST PASS MUST LIVE

#### A. Off-Site Instant Access (PRIMARY)
**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Ghost Pass launchable directly via QR code or NFC tap
- QR/NFC link opens wallet immediately
- Pre-bound to correct EVENT + VENUE
- Allows instant wallet funding
- Allows immediate use (entry, re-entry, concessions)
- Must NOT require navigating bevalid.app site

**Implementation Needs:**
- Create standalone wallet route: `/wallet/:eventId/:venueId`
- QR code format: `{siteurl}/wallet/{eventId}/{venueId}?binding={walletBindingId}`
- NFC tap opens same URL structure
- Wallet component loads without login wall
- Event/venue context pre-populated
- Instant Stripe Connect funding flow

**Backend Status:** ✅ EXISTS (`/wallet-access/surface-wallet` endpoint)  
**Frontend Status:** ❌ MISSING (route and component needed)

#### B. On BeValid.app (SECONDARY)
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Priority:** HIGH

**Requirements:**
- Ghost Pass accessible inside bevalid.app
- Users can preload funds
- Get familiar with wallet
- Use as optional cold-storage wallet
- Same backend, same wallet, two entry points

**Implementation Needs:**
- Add wallet preload option in main app
- Link to off-site wallet URL
- Optional wallet view in main dashboard
- Ensure backend consistency

---

### 1.2 ENTRY FLOW (MUST WORK FAST) [IMPLEMENTED]

**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Priority:** CRITICAL

**Required Flow:**
1. User scans QR at venue door
2. Wallet opens immediately (no account setup wall)
3. Event + venue already selected
4. User funds wallet (Stripe Connect)
5. Entry fee + VALID fee deducted
6. Entry logged
7. Wallet remains persistently accessible on device

**Post-First-Scan Requirements:**
- Persistent session on device
- "Add to Home Screen" prompt (PWA behavior)
- Ghost icon shortcut (wallet opens in one tap)
- User should NOT return to bevalid.app to re-open wallet

**Implementation Needs:**
- Service worker registration in main.tsx
- PWA install prompt component
- Session persistence in localStorage/IndexedDB
- Wallet session recovery on app reopen
- Brightness control for QR scanning
- Fast scan-to-entry flow optimization

**Backend Status:** ✅ EXISTS (entry tracking, wallet access, scan validation)  
**Frontend Status:** ⚠️ INCOMPLETE (PWA setup, session persistence missing)

---

### 1.3 PURCHASE NOT ALWAYS REQUIRED (MODE A vs MODE B) [IMPLEMENTED]

**Status:** ✅ IMPLEMENTED (backend), ⚠️ NEEDS VERIFICATION  
**Priority:** HIGH

#### Mode A — One-off / Nightlife / Club
**Requirements:**
- No pass required
- User pays per-scan fees:
  - Entry scan fee
  - Re-entry scan fee (if allowed)
  - Concessions
- VALID earns per-scan fees

**Backend Status:** ✅ EXISTS (`ghost_pass_modes.py` - pay-per-scan mode)  
**Frontend Status:** ⚠️ NEEDS TESTING

#### Mode B — Event / Festival / Multi-vendor
**Requirements:**
- Pass purchase required (1-day / 3-day / 7-day / custom)
- Pass pricing configurable per event
- VALID service fee configurable

**Backend Status:** ✅ EXISTS (`ghostpass.py` - pass purchase)  
**Frontend Status:** ✅ EXISTS (pass purchase UI)

**Implementation Needs:**
- Verify Mode A works without pass purchase
- Add per-event configuration flag: `requires_pass` (boolean)
- Test both modes thoroughly
- Ensure fee calculation correct for each mode

---

### 1.4 SINGLE-EVENT TICKET PURCHASE (NEW) [IMPLEMENTED]

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Event can be priced as one-time ticket
- Ticket purchase debits wallet
- Grants entry permission
- VALID service fee applied (adjustable)
- No pass duration logic attached
- Simple implementation: transaction type + permission flag

**Implementation Needs:**
- New backend route: `/tickets/purchase`
- Database table: `event_tickets`
- Transaction type: `TICKET_PURCHASE`
- Entry permission logic tied to ticket
- Frontend ticket purchase UI
- Receipt generation

**Database Schema Needed:**
```
event_tickets table:
- id (UUID)
- wallet_id (UUID)
- event_id (TEXT)
- ticket_price_cents (INT)
- valid_service_fee_cents (INT)
- purchased_at (TIMESTAMPTZ)
- used_at (TIMESTAMPTZ)
- status (TEXT: ACTIVE, USED, REFUNDED)
```

---

### 1.5 RE-ENTRY LOGIC (DUAL FEE STRUCTURE)

**Status:** ✅ IMPLEMENTED (backend), ⚠️ NEEDS UI  
**Priority:** HIGH

**Requirements:**

#### A. Venue Re-entry Fee
- Configurable by event owner
- Optional (event may allow or deny re-entry)
- Charged to wallet if allowed

#### B. VALID Re-entry Scan Fee
- Charged per re-entry scan
- Adjustable by VALID
- Independent of venue fee

**Entry Tracking Requirements:**
- Track entry count per wallet per event
- Entry #1 = initial entry
- Entry #2+ = re-entries
- Log every entry with:
  - Timestamp
  - Access point / gateway
  - Entry type
  - Fees charged
- Required for security, audit, dispute resolution

**Backend Status:** ✅ FULLY IMPLEMENTED (`ghost_pass_entry_tracking.py`)  
**Frontend Status:** ⚠️ MISSING UI for re-entry status/denial

**Implementation Needs:**
- Frontend re-entry status display
- Re-entry denial message UI
- Staff manager interface for manual overrides
- Entry count display for users
- Fee breakdown display (venue fee + VALID fee)

---

### 1.6 BACKEND NON-NEGOTIABLES (ATOMIC OPERATIONS)

**Status:** ✅ IMPLEMENTED  
**Priority:** VERIFICATION NEEDED

**Requirements:**
Every scan/tap must atomically:
1. Resolve wallet
2. Apply correct fees
3. Debit wallet
4. Log entry
5. Write audit trail
6. Generate receipt

**No partial states allowed.**

**Backend Status:** ✅ EXISTS (RPC function: `process_atomic_ghost_pass_transaction_with_distribution`)  
**Verification Needed:** Load testing to confirm atomicity under concurrency

---

## 🎯 PHASE 2: EVENT & VENUE MANAGEMENT [IMPLEMENTED]

### 2.1 Event Management System

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Event creation interface
- Event configuration:
  - Name, description
  - Venue association
  - Requires pass (boolean) - Mode A vs Mode B
  - Ticket pricing (if applicable)
  - Pass pricing options (1/3/7 day, custom)
  - Re-entry allowed (boolean)
  - Re-entry fees (venue + VALID)
  - VALID service fee percentage
  - Entry fee
  - Start/end dates
- Event editing and deletion
- Event status (active, inactive, archived)

**Implementation Needs:**
- Backend routes: `/admin/events/*` (CRUD operations)
- Database table: `events`
- Frontend component: `EventManager.tsx`
- Event configuration form
- Event list/grid view
- Event status management

**Database Schema Needed:**
```
events table:
- id (UUID)
- name (TEXT)
- description (TEXT)
- venue_id (TEXT)
- requires_pass (BOOLEAN)
- ticket_price_cents (INT, nullable)
- pass_pricing (JSONB)
- re_entry_allowed (BOOLEAN)
- venue_reentry_fee_cents (INT)
- valid_reentry_scan_fee_cents (INT)
- entry_fee_cents (INT)
- valid_service_fee_cents (INT)
- start_date (TIMESTAMPTZ)
- end_date (TIMESTAMPTZ)
- status (TEXT)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

---

### 2.2 Venue Management System

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Venue creation interface
- Venue configuration:
  - Name, address
  - Venue type (club, festival, arena, etc.)
  - Capacity
  - Gateway/entry points
  - Default fee structure
- Venue editing and deletion
- QR code generation per venue
- NFC tag ID assignment

**Implementation Needs:**
- Backend routes: `/admin/venues/*` (CRUD operations)
- Database table: `venues`
- Frontend component: `VenueManager.tsx`
- Venue configuration form
- Venue list/grid view
- Gateway point management per venue

**Database Schema Needed:**
```
venues table:
- id (TEXT, primary key)
- name (TEXT)
- address (TEXT)
- venue_type (TEXT)
- capacity (INT)
- qr_code_url (TEXT)
- nfc_tag_id (TEXT)
- default_entry_fee_cents (INT)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

---

### 2.3 QR Code Generation

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Generate QR codes for events
- QR code types:
  - Entry (general admission)
  - VIP entry
  - Staff entry
  - Vendor access
- QR code format: `https://bevalid.app/wallet/{eventId}/{venueId}`
- Downloadable QR code images (PNG, SVG)
- Printable QR code sheets
- QR code tracking (scans per code)

**Implementation Needs:**
- Backend route: `/admin/generate-qr`
- QR code library: `qrcode` (Python) or `qrcode.react` (frontend)
- QR code storage in database
- Frontend component: QR code generator in admin panel
- Download functionality (PNG, SVG, PDF)
- Print-ready templates

---

## 🎯 PHASE 3: ADMIN PANEL UI

### 3.1 Admin Dashboard

**Status:** ❌ FRONTEND NOT IMPLEMENTED (backend exists)  
**Priority:** HIGH

**Requirements:**
- System statistics overview:
  - Total users
  - Active wallets
  - Total balance in system
  - Active passes
  - Total scans today/week/month
  - Total revenue
- Recent transactions list
- Pending payouts
- Recent audit logs
- Quick actions (create event, generate QR, etc.)

**Backend Status:** ✅ EXISTS (`/admin/dashboard` endpoint)  
**Frontend Status:** ❌ MISSING

**Implementation Needs:**
- Frontend component: `AdminDashboard.tsx`
- Stat cards with real-time data
- Transaction history table
- Payout management interface
- Audit log viewer
- Quick action buttons

---

### 3.2 Fee Configuration Interface

**Status:** ❌ FRONTEND NOT IMPLEMENTED (backend exists)  
**Priority:** HIGH

**Requirements:**
- Platform fee configuration:
  - Entry fee
  - Bar/concession fee
  - Merchandise fee
  - General fee
- Fee distribution percentages:
  - VALID platform percentage
  - Vendor percentage
  - Pool percentage
  - Promoter percentage
- Per-event fee overrides
- Scan fee configuration (per venue/event)

**Backend Status:** ✅ EXISTS (`PlatformFeeEngine` class, `/admin/fee-config` endpoints)  
**Frontend Status:** ❌ MISSING

**Implementation Needs:**
- Frontend component: `FeeConfiguration.tsx`
- Fee input forms with validation
- Distribution percentage sliders
- Preview of fee calculations
- Save/update functionality

---

### 3.3 Staff Management

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** MEDIUM

**Requirements:**
- Staff user creation
- Role assignment (staff, manager, admin)
- Permission management
- Staff access to specific events/venues
- Staff QR code generation
- Staff activity logs

**Implementation Needs:**
- Backend routes: `/admin/staff/*`
- Database table: `staff_users` or extend `users` table with roles
- Frontend component: `StaffManager.tsx`
- Staff creation form
- Role/permission assignment UI
- Staff list with filters

---

### 3.4 Live Counts & Real-Time Monitoring

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** MEDIUM

**Requirements:**
- Real-time entry counts per event
- People in venue (current capacity)
- People exited (re-entry tracking)
- Entry rate (entries per minute/hour)
- Gateway-specific counts (which door is busiest)
- Alerts for capacity limits

**Implementation Needs:**
- Backend: WebSocket or Server-Sent Events for real-time updates
- Frontend component: `LiveCounts.tsx`
- Real-time data subscription
- Visual capacity indicators
- Alert system for thresholds

---

### 3.5 Transaction Summaries & Export

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** MEDIUM

**Requirements:**
- Transaction filtering:
  - By date range
  - By event
  - By venue
  - By transaction type
  - By user/wallet
- Transaction export:
  - CSV format
  - Excel format
  - PDF reports
- Revenue summaries
- Fee breakdowns
- Refund reports

**Implementation Needs:**
- Backend route: `/admin/transactions/export`
- Frontend component: `TransactionExport.tsx`
- Filter UI
- Export button with format selection
- Report generation logic

---

## 🎯 PHASE 4: STRIPE INTEGRATION & PAYMENTS

### 4.1 Stripe Connect Setup

**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Wallet funding works in test + prod
- Stripe Connect account linking
- Platform fees configurable (not hard-coded)
- Payment method support:
  - Credit/debit cards
  - Apple Pay
  - Google Pay
  - (Future: PayPal, Venmo)

**Backend Status:** ⚠️ PARTIAL (`payment_processors.py` has abstraction)  
**Frontend Status:** ⚠️ NEEDS STRIPE ELEMENTS

**Implementation Needs:**
- Stripe Elements integration in frontend
- Payment intent creation endpoint
- Payment confirmation flow
- Error handling for failed payments
- Receipt generation after successful payment

---

### 4.2 Stripe Webhook Handlers

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Webhook endpoint: `/webhooks/stripe`
- Handle events:
  - `payment_intent.succeeded` - Update wallet balance
  - `charge.succeeded` - Log successful charge
  - `payout.paid` - Update payout status
  - `payment_intent.payment_failed` - Handle failures
- Webhook signature verification
- Idempotency handling (prevent duplicate processing)
- Error logging and retry logic

**Implementation Needs:**
- Backend file: `routes/webhooks.py` (NEW)
- Webhook signature verification
- Event type routing
- Database updates for each event type
- Audit logging for all webhook events
- Stripe dashboard webhook configuration

**Stripe Dashboard Setup:**
1. Add webhook endpoint URL
2. Subscribe to required events
3. Copy webhook signing secret to environment variables
4. Test with Stripe CLI

---

### 4.3 Wallet Funding UI

**Status:** ⚠️ BACKEND EXISTS, FRONTEND INCOMPLETE  
**Priority:** CRITICAL

**Requirements:**
- Stripe Elements card input
- Quick amount buttons ($20, $50, $100)
- Custom amount input
- Payment processing indicator
- Success/error messages
- Balance update after funding
- Receipt display

**Backend Status:** ✅ EXISTS (`/wallet/fund` endpoint)  
**Frontend Status:** ⚠️ NEEDS STRIPE ELEMENTS INTEGRATION

**Implementation Needs:**
- Install `@stripe/stripe-js` and `@stripe/react-stripe-js`
- Create `WalletFunding.tsx` component
- Integrate Stripe Elements
- Payment intent creation flow
- Payment confirmation handling
- Balance refresh after successful payment

---

### 4.4 Environment Separation & Security

**Status:** ⚠️ NEEDS VERIFICATION  
**Priority:** CRITICAL

**Requirements:**
- Test keys vs prod keys clearly separated
- No secrets in frontend code
- All keys stored in environment variables
- Separate environments:
  - Development (local)
  - Staging (test)
  - Production (live)
- Environment-specific Stripe keys
- Environment-specific Supabase keys

**Verification Checklist:**
- [ ] `.env` files not committed to git
- [ ] Frontend uses `VITE_` prefixed env vars only
- [ ] Backend uses secure env vars (not exposed to frontend)
- [ ] Stripe publishable keys in frontend (safe)
- [ ] Stripe secret keys in backend only (secure)
- [ ] Supabase anon key in frontend (safe with RLS)
- [ ] Supabase service key in backend only (secure)

---

## 🎯 PHASE 5: PWA & SESSION MANAGEMENT

### 5.1 PWA "Add to Home Screen" Flow

**Status:** ⚠️ MANIFEST EXISTS, FLOW INCOMPLETE  
**Priority:** CRITICAL

**Requirements:**
- Service worker registration
- Install prompt after first successful scan
- "Add to Home Screen" button
- Install success confirmation
- App icon on home screen
- Standalone app experience (no browser chrome)
- Splash screen

**Implementation Needs:**
- Service worker registration in `main.tsx`
- Frontend component: `PWAInstallPrompt.tsx`
- Listen for `beforeinstallprompt` event
- Show install prompt after first scan/funding
- Handle install acceptance/rejection
- Update manifest.json with proper icons
- Test on iOS (Safari) and Android (Chrome)

**Current Status:**
- ✅ `manifest.json` exists
- ✅ `sw.js` exists (basic implementation)
- ❌ Service worker not registered
- ❌ Install prompt not implemented
- ❌ Proper app icons missing

---

### 5.2 Session Persistence

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** CRITICAL

**Requirements:**
- Wallet session stored locally
- Session survives:
  - Browser close
  - App close
  - Device restart (if PWA installed)
- Session data includes:
  - `wallet_binding_id`
  - `session_token`
  - `event_id`
  - `venue_id`
  - `expires_at`
  - `device_fingerprint`
- Session restoration on app reopen
- Session expiration handling
- Re-authentication if session expired

**Implementation Needs:**
- Use `localStorage` or `IndexedDB` for session storage
- Session save on first scan
- Session load on app startup
- Session validation with backend
- Session refresh mechanism
- Logout/clear session functionality

---

### 5.3 Offline Support

**Status:** ⚠️ BASIC SERVICE WORKER EXISTS  
**Priority:** MEDIUM

**Requirements:**
- Offline wallet balance display (cached)
- Offline transaction history (cached)
- Queue transactions when offline
- Sync when back online
- Offline indicator in UI
- Background sync for pending operations

**Implementation Needs:**
- Enhance service worker caching strategy
- Implement background sync
- Add offline indicator component
- Queue management for offline transactions
- Sync logic when connection restored

---

## 🎯 PHASE 6: SESSION-BOUND WALLET ID (IDENTITY MODEL)

### 6.1 Session-Bound Wallet ID Implementation

**Status:** ✅ IMPLEMENTED (backend)  
**Priority:** VERIFICATION NEEDED

**Requirements:**
- No traditional account creation
- No usernames, passwords, signup wall
- Cryptographic session identity
- Every interaction tied to unique wallet session

**How It Works:**
1. **First Interaction (QR or Tap):**
   - Backend generates: `wallet_id` (UUID), `device_binding_hash`, `session_token`
   - Wallet opens immediately, no login screen

2. **Persistence Without Login:**
   - Stored via secure browser storage (PWA)
   - Device fingerprint + cryptographic token
   - Re-scanning QR restores same wallet

3. **Tracking:**
   - Every event logs: `wallet_id`, `event_id`, `entry_type`, `timestamp`, `location`, `transaction_id`, `fee_type`

4. **Optional Upgrade (NOT REQUIRED):**
   - Later: link phone number, email, Apple/Google
   - Never required for entry

**Backend Status:** ✅ FULLY IMPLEMENTED (`ghost_pass.py`, `device_wallet.py`)  
**Frontend Status:** ⚠️ NEEDS SESSION PERSISTENCE

**What We Are NOT Doing:**
- ❌ No forced signup
- ❌ No passwords
- ❌ No username flows
- ❌ No friction screens at entry
- ❌ No blocking the door

**Speed is sacred.**

---

### 6.2 Auditability Without Accounts

**Status:** ✅ IMPLEMENTED  
**Priority:** VERIFICATION NEEDED

**Requirements:**
- Auditability tied to Wallet ID + Transaction Ledger
- System logs:
  - Deterministic IDs
  - Immutable timestamps
  - Signed receipts
  - Hash-linked audit records
- Stronger than email-based accounts

**Backend Status:** ✅ EXISTS (audit logging, entry tracking, transaction ledger)  
**Verification Needed:** Audit trail completeness testing

---

## 🎯 PHASE 7: SENATE & SCU SEPARATION

### 7.1 Senate Status

**Status:** ✅ IMPLEMENTED, NO CHANGES NEEDED  
**Priority:** MAINTENANCE ONLY

**Requirements:**
- Senate mock testing passed ✔️
- Keep current architecture
- Senate callable as a service
- Do NOT hard-wire LLMs - seats remain pluggable
- Human remains on the rail, not in the loop

**Backend Status:** ✅ COMPLETE (`senate/` directory)  
**No changes needed unless integration breaks.**

---

### 7.2 SCU Monitor (Internal Only)

**Status:** ✅ IMPLEMENTED, NEEDS ACCESS CONTROL  
**Priority:** HIGH

**Requirements:**
- Location: `BeValid.app/internal/scu` (or `/governance`)
- Access: VALID only (possibly auditors, enterprise clients read-only)
- What it shows:
  - Sensory channel status
  - SCU events
  - Senate decisions (hashed/abstracted)
  - Entry anomalies
  - Risk flags
  - Performance metrics
  - Load behavior
  - System health

**What SCU is NOT:**
- ❌ Not user-facing
- ❌ Not venue-facing by default
- ❌ Not real-time decision UI
- ❌ Not part of Ghost Pass

**Frontend Status:** ✅ EXISTS (`SensoryCargoMonitor.tsx`)  
**Implementation Needs:**
- Move to `/internal/scu` route
- Add VALID-only authentication check
- Hide from venue operators
- Add read-only mode for auditors

---

### 7.3 Senate Never Visible as "The Senate"

**Status:** ✅ CORRECT ARCHITECTURE  
**Priority:** MAINTAIN

**Requirements:**
- Senate lives in backend only
- Appears externally as:
  - Decisions
  - Outcomes
  - Logs
- Never appears as:
  - Votes
  - Models
  - Debates
  - Reasoning chains

**Why:**
- Protects IP
- Avoids regulation triggers
- Prevents user confusion
- Keeps latency out of door flow

**Backend Status:** ✅ CORRECT (Senate in backend, abstracted in frontend)

---

## 🎯 PHASE 8: ARCHITECTURE SEPARATION (FINAL MAP)

### 8.1 User Layer

**Ghost Pass (Off-Site PWA) - PRIMARY**
- Location: `https://bevalid.app/wallet/{eventId}/{venueId}`
- User sees ONLY:
  - Wallet balance
  - Fund wallet button
  - Entry success/denied messages
  - Ticket (if applicable)
  - Receipts
  - Re-entry status
- ✅ No SCU
- ✅ No Senate
- ✅ No sensory data

**Status:** ⚠️ PARTIALLY IMPLEMENTED

---

### 8.2 Operator Layer

**Admin Panel - BeValid.app/admin**
- Who uses: Venue owners, event operators, managers, trusted staff
- What lives here:
  - Event creation
  - Venue setup
  - Entry rules (allow re-entry / pricing)
  - Fee configuration (vendor + VALID)
  - QR code generation (entry / VIP / staff)
  - Wallet rules
  - Ticket pricing
  - Staff roles
  - Live counts (people in / out)
  - Transaction summaries

**Think:** "Can I run my event without calling anyone?" → If yes, it belongs in Admin.

**Status:** ❌ FRONTEND NOT IMPLEMENTED (backend exists)

---

### 8.3 VALID Layer

**SCU Monitor - BeValid.app/internal/scu**
- Who can access: VALID, possibly auditors, possibly enterprise clients (read-only)
- What lives here:
  - Sensory channel status
  - SCU events
  - Senate decisions (hashed/abstracted)
  - Entry anomalies
  - Risk flags
  - Performance metrics
  - Load behavior
  - System health

**Status:** ✅ IMPLEMENTED, NEEDS ACCESS CONTROL

---

### 8.4 Backend Layer (Hidden)

**Senate Engine - Backend Only**
- Components:
  - Models (pluggable)
  - Judge
  - Policy
- Never exposed to frontend
- Callable as service
- Abstracted in all external interfaces

**Status:** ✅ IMPLEMENTED

---

## 🎯 PHASE 9: STRESS TESTING & PILOT READINESS

### 9.1 Load Testing Requirements

**Status:** ❌ NOT TESTED  
**Priority:** CRITICAL

**Requirements:**
- 2,000 users scanning within short time window
- Multiple access points (2 doors + 4 concessions)
- Wallet balance updates correctly
- No race conditions
- No crashes on concurrent scans
- Stripe webhooks process correctly under load

**Implementation Needs:**
- Load testing script (Python with `aiohttp` or `locust`)
- Simulate 2,000 concurrent users
- Test scenarios:
  - Concurrent wallet funding
  - Concurrent entry scans
  - Concurrent re-entry scans
  - Concurrent concession purchases
- Monitor:
  - Response times
  - Error rates
  - Database connection pool
  - Memory usage
  - CPU usage
- Identify bottlenecks
- Optimize as needed

---

### 9.2 Concurrency Safety

**Status:** ⚠️ NEEDS VERIFICATION  
**Priority:** CRITICAL

**Requirements:**
- Atomic database transactions
- No partial states
- Race condition prevention
- Proper transaction isolation levels
- Database connection pooling
- Retry logic for transient failures

**Verification Checklist:**
- [ ] Wallet debit operations are atomic
- [ ] Entry logging is atomic
- [ ] Fee distribution is atomic
- [ ] No duplicate transactions possible
- [ ] Concurrent scans don't corrupt data
- [ ] Database indexes optimized
- [ ] Connection pool sized appropriately

---

### 9.3 Database Optimization

**Status:** ⚠️ NEEDS OPTIMIZATION  
**Priority:** HIGH

**Requirements:**
- Proper indexes on frequently queried columns
- Connection pooling configured
- Query optimization
- Caching strategy for read-heavy operations

**Implementation Needs:**
- Add database indexes:
  - `wallets(user_id)`
  - `transactions(wallet_id)`
  - `entry_events(wallet_binding_id)`
  - `entry_events(venue_id)`
  - `gateway_points(status)`
- Configure connection pool size
- Implement Redis caching for:
  - Wallet balances (with TTL)
  - Event configurations
  - Fee configurations
- Optimize slow queries

---

## 🎯 PHASE 10: SECURITY & COMPLIANCE

### 10.1 No Custody Risk

**Status:** ✅ IMPLEMENTED  
**Priority:** VERIFICATION NEEDED

**Requirements:**
- No ID documents stored
- No card numbers stored
- Proofs only, not source data
- Cryptographic proofs for:
  - Age verification (boolean only)
  - Medical credentials (presence only)
  - Access class (GA/VIP/STAFF)

**Backend Status:** ✅ IMPLEMENTED (`CryptographicProofEngine`)  
**Verification Needed:** Security audit

---

### 10.2 Data Privacy

**Status:** ⚠️ NEEDS VERIFICATION  
**Priority:** HIGH

**Requirements:**
- GDPR compliance (if applicable)
- Data retention policies
- User data deletion capability
- Privacy policy
- Terms of service
- Cookie consent (if applicable)

**Implementation Needs:**
- Privacy policy document
- Terms of service document
- Data deletion endpoint
- Data export endpoint (GDPR right to data portability)
- Cookie consent banner (if using cookies)

---

## 📊 IMPLEMENTATION CHECKLIST

### ✅ ALREADY IMPLEMENTED (NO CHANGES NEEDED)
- [x] Session-bound wallet ID system
- [x] Device fingerprinting & cryptographic proofs
- [x] Entry/re-entry tracking with dual fee structure
- [x] Platform fee engine with distribution
- [x] Ghost Pass modes (pay-per-scan vs event)
- [x] Wallet balance & transaction history
- [x] Refund system
- [x] Admin backend routes
- [x] Senate evaluation system
- [x] SCU validation layer
- [x] Gateway management
- [x] Audit logging
- [x] Atomic transaction processing (RPC functions)

### ❌ MUST IMPLEMENT (PILOT BLOCKERS)
- [ ] Off-site wallet direct access URL
- [ ] PWA service worker registration
- [ ] "Add to Home Screen" prompt
- [ ] Session persistence (localStorage/IndexedDB)
- [ ] Single-event ticket support
- [ ] Event management (CRUD)
- [ ] Venue management (CRUD)
- [ ] QR code generation
- [ ] Admin dashboard UI
- [ ] Event manager UI
- [ ] Venue manager UI
- [ ] Fee configuration UI
- [ ] Wallet funding UI (Stripe Elements)
- [ ] Stripe webhook handlers
- [ ] Load testing (2,000 users)
- [ ] Database optimization (indexes, pooling)

### ⚠️ SHOULD IMPLEMENT (PILOT NICE-TO-HAVES)
- [ ] Staff management interface
- [ ] Real-time entry counts
- [ ] Transaction export functionality
- [ ] Optional identity linking (email/phone)
- [ ] Multi-device wallet recovery
- [ ] Offline transaction queueing
- [ ] Background sync
- [ ] Push notifications

### 🔍 VERIFICATION NEEDED
- [ ] Mode A (pay-per-scan) works without pass purchase
- [ ] Atomic operations under load
- [ ] Stripe Connect test + prod environments
- [ ] Environment variable separation
- [ ] No secrets in frontend code
- [ ] Audit trail completeness
- [ ] Security audit for cryptographic proofs
- [ ] GDPR compliance (if applicable)

---


## 🎯 PRIORITY ORDER

### 1. CRITICAL (Do First)
1. Off-site wallet direct access
2. PWA setup (service worker, install prompt, session persistence)
3. Event & Venue management
4. QR code generation
5. Single-event ticket support
6. Stripe webhook handlers

### 2. HIGH (Do Second)
1. Admin dashboard UI
2. Event manager UI
3. Venue manager UI
4. Fee configuration UI
5. Wallet funding UI
6. Load testing

### 3. MEDIUM (Do Third)
1. Staff management
2. Real-time entry counts
3. Transaction export
4. Database optimization
5. SCU monitor access control

### 4. LOW (Do Last)
1. Optional identity linking
2. Multi-device recovery
3. Offline transaction queueing
4. Push notifications
5. Advanced analytics

---

## 🚀 SUCCESS CRITERIA

### Pilot is "READY" when:
- [ ] User can scan QR code and wallet opens instantly
- [ ] User can fund wallet via Stripe
- [ ] User can enter venue (entry fee deducted)
- [ ] User can re-enter venue (re-entry fees deducted)
- [ ] User can purchase single-event ticket
- [ ] Wallet persists on device (PWA installed)
- [ ] Admin can create events
- [ ] Admin can create venues
- [ ] Admin can generate QR codes
- [ ] Admin can configure fees
- [ ] Admin can view live counts
- [ ] System handles 2,000 concurrent users
- [ ] No race conditions or data corruption
- [ ] Stripe webhooks process correctly
- [ ] All transactions are atomic
- [ ] Audit trail is complete
- [ ] Senate remains abstracted
- [ ] SCU monitor is VALID-only

---

## 📝 NOTES

### What NOT to Change
- Do NOT redesign existing backend architecture
- Do NOT change Senate implementation
- Do NOT modify cryptographic proof system
- Do NOT alter atomic transaction logic
- Do NOT change session-bound wallet ID model

### What TO Focus On
- Frontend implementation (most gaps are here)
- Event/Venue management (new feature)
- Single-event tickets (new feature)
- QR code generation (new feature)
- Admin UI (backend exists, frontend missing)
- PWA setup (manifest exists, needs wiring)
- Stripe webhooks (critical for production)
- Load testing (verify pilot readiness)

### Integration, Not Redesign
This is about **wiring existing pieces together** and **filling specific gaps**, not rebuilding the system. The core architecture is solid.

---

## 🎯 FINAL ARCHITECTURE MAP

```
USER LAYER
└─ Ghost Pass (off-site PWA)
   ├─ Wallet Balance
   ├─ Fund Wallet
   ├─ Entry / Re-entry Status
   ├─ Tickets (optional)
   └─ Receipts

OPERATOR LAYER
└─ BeValid.app/admin
   ├─ Event Management
   ├─ Venue Management
   ├─ QR Code Generation
   ├─ Fee Configuration
   ├─ Staff Management
   ├─ Live Counts
   └─ Transaction Summaries

VALID LAYER
└─ BeValid.app/internal/scu
   ├─ SCU Monitor
   ├─ Senate Logs (abstracted)
   ├─ Risk Flags
   ├─ Audit Trails
   └─ System Health

BACKEND (HIDDEN)
└─ Senate Engine
   ├─ Models (pluggable)
   ├─ Judge
   └─ Policy
```

---

**END OF PLAN**