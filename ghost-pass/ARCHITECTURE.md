# GhostPass System - Complete Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Patterns](#architecture-patterns)
4. [Database Schema](#database-schema)
5. [Backend API Architecture](#backend-api-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Authentication & Security](#authentication--security)
8. [Core Business Flows](#core-business-flows)
9. [Payment Integration](#payment-integration)
10. [Multi-Tenant System](#multi-tenant-system)
11. [Deployment Architecture](#deployment-architecture)

---

## System Overview

GhostPass is a **serverless multi-tenant SaaS platform** for venue access management and digital wallet operations. The system enables:

- **Anonymous wallet creation** with device fingerprinting
- **QR/NFC-based venue entry** with automatic fee calculation
- **Multi-mode access control** (pay-per-scan vs. event passes)
- **Revenue distribution** across multiple stakeholders
- **Real-time transaction processing** with atomic operations
- **Admin dashboards** for venue operators and platform administrators
- **Identity verification** via Footprint integration
- **Payment processing** via Stripe

### Key Characteristics
- **Serverless**: Vercel Functions (Node.js) + Supabase (PostgreSQL)
- **Multi-tenant**: Venue-scoped data with event-level isolation
- **Real-time**: WebSocket updates via Supabase Realtime
- **Mobile-first**: Progressive Web App with offline capabilities
- **Security-focused**: Device binding, biometric verification, audit logging

### Dual Authentication System

**CRITICAL**: GhostPass operates with TWO parallel authentication systems:

1. **Authenticated Flow** (Supabase Auth + JWT)
   - User registers/logs in with email/password
   - JWT token required in Authorization header
   - Wallet linked to user_id
   - Used by: `/api/ghostpass/purchase`, `/api/entry/process-scan`, admin endpoints
   - Tables: users, wallets (with user_id), ghost_passes (with user_id)

2. **Anonymous Flow** (Device Fingerprint)
   - No registration required
   - Device fingerprint in X-Device-Fingerprint header
   - Wallet linked to device_fingerprint only
   - Used by: `/api/wallet/balance`, `/api/wallet/fund`, `/api/modes/*`
   - Tables: wallets (with device_fingerprint), interactions, ghost_passes (with wallet_binding_id)

**Important**: Some endpoints work with EITHER system, others require specific authentication. Check implementation before use.

---

## Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (Abyssal Glass theme)
- **State Management**: 
  - TanStack Query (server state)
  - React Context (auth state)
- **Animation**: Framer Motion
- **HTTP Client**: Axios with interceptors
- **UI Components**: Radix UI primitives
- **QR Codes**: react-qr-code, html5-qrcode
- **i18n**: react-i18next with browser language detection

### Backend
- **Runtime**: Node.js (Vercel Serverless Functions)
- **Language**: TypeScript
- **Framework**: @vercel/node (serverless handlers)
- **Database**: Supabase (PostgreSQL 15+)
- **ORM**: Supabase JS Client
- **Authentication**: Supabase Auth + Custom Device Auth

### Infrastructure
- **Hosting**: Vercel (frontend + API)
- **Database**: Supabase (managed PostgreSQL)
- **CDN**: Vercel Edge Network
- **Storage**: Supabase Storage (future use)

### Third-Party Integrations
- **Payments**: Stripe (Checkout Sessions API)
- **Identity Verification**: Footprint (KYC/AML)
- **Push Notifications**: Web Push API (VAPID)
- **Analytics**: Custom event tracking

---

## Architecture Patterns

### 1. Serverless Architecture
```
Client (React PWA)
    ↓
Vercel Edge Network (CDN)
    ↓
Vercel Functions (API Routes)
    ↓
Supabase (PostgreSQL + Auth + Realtime)
```

### 2. API Structure
```
api/
├── _lib/              # Shared utilities
│   ├── auth.ts        # JWT authentication
│   ├── device-auth.ts # Device fingerprint auth
│   ├── supabase.ts    # DB client
│   ├── handler.ts     # CORS & error handling
│   └── supabase-pool.ts # Connection pooling
├── wallet/            # Wallet operations
├── ghostpass/         # Pass management
├── entry/             # Entry processing
├── stripe/            # Payment webhooks
├── admin/             # Admin operations
├── venue/             # Venue management
└── [domain]/          # Domain-specific endpoints
```

### 3. Database Access Patterns
- **Row Level Security (RLS)**: Supabase policies for multi-tenancy
- **Atomic Transactions**: PostgreSQL functions for consistency
- **Connection Pooling**: Singleton client pattern
- **Optimistic Locking**: FOR UPDATE in critical sections


### 4. Frontend Architecture
```
src/
├── components/        # React components
│   ├── admin/        # Admin-specific UI
│   ├── ui/           # Reusable UI primitives
│   ├── Layout.tsx    # Main layout with navigation
│   ├── AuthProvider.tsx # Auth context
│   └── [feature]/    # Feature components
├── lib/              # Utilities
│   ├── api.ts        # API client
│   └── utils.ts      # Helpers
├── hooks/            # Custom React hooks
├── types/            # TypeScript definitions
└── i18n/             # Internationalization
```

---

## Database Schema

### Core Tables

#### 1. Users & Authentication
```sql
users (7 rows)
├── id (UUID, PK)
├── email (TEXT)
├── role (ENUM: USER, VENDOR, ADMIN, VENUE_ADMIN)
├── venue_id (TEXT, NULLABLE) -- For venue admins
├── event_id (TEXT, NULLABLE) -- For event staff
├── fp_id (TEXT, UNIQUE, NULLABLE) -- Footprint ID
└── created_at (TIMESTAMPTZ)
```

#### 2. Wallets (Anonymous + Authenticated) - 5,156 rows
```sql
wallets
├── id (UUID, PK)
├── wallet_binding_id (TEXT, UNIQUE) -- Public identifier
├── user_id (UUID, FK, NULLABLE) -- NULL for anonymous
├── device_fingerprint (TEXT) -- Device binding
├── balance_cents (BIGINT, CHECK >= 0) -- Current balance
├── device_bound (BOOLEAN) -- Device locked
├── wallet_surfaced (BOOLEAN) -- Converted to user account
├── entry_count (INTEGER) -- Total entries
├── recovery_code_hash (TEXT) -- SHA256 hash for recovery
├── fp_id (TEXT) -- Footprint verification ID
├── ghost_pass_token (TEXT, UNIQUE) -- Legacy field
├── biometric_hash (TEXT)
├── pwa_installed (BOOLEAN)
├── last_entry_at (TIMESTAMPTZ)
├── is_refund_eligible (BOOLEAN)
└── updated_at (TIMESTAMPTZ)
```

#### 3. Ghost Passes (Mode B - Event Passes) - 37 rows
```sql
ghost_passes
├── id (UUID, PK) -- Pass token
├── user_id (UUID, FK) -- User who purchased
├── wallet_binding_id (TEXT) -- Wallet identifier
├── context (TEXT) -- Venue/event context
├── pass_type (TEXT) -- 1day, 3day, weekend, etc.
├── pass_name (TEXT) -- Display name
├── price_cents (INTEGER) -- Purchase price
├── duration_hours (INTEGER) -- Validity period
├── duration_days (INTEGER) -- Alternative duration
├── status (TEXT: ACTIVE, EXPIRED) -- Pass status
├── expires_at (TIMESTAMPTZ) -- Expiration timestamp
├── purchased_at (TIMESTAMPTZ)
├── metadata (JSONB)
└── updated_at (TIMESTAMPTZ)
```

#### 4. Venues - 5 rows
```sql
venues
├── id (TEXT, PK)
├── name (TEXT)
├── address (TEXT)
├── venue_type (ENUM: club, festival, arena, stadium, theater, conference, bar, restaurant, other)
├── capacity (INTEGER)
├── gateway_count (INTEGER) -- Number of entry points
├── default_service_fee (NUMERIC) -- Default VALID fee %
├── default_entry_fee (INTEGER) -- Default entry fee cents
├── metadata (JSONB)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 5. Events (Complete Binding) - 4 rows
```sql
events
├── id (TEXT, PK)
├── name (TEXT)
├── description (TEXT)
├── venue_id (TEXT) -- Venue binding
├── venue_name (TEXT)
├── start_date, end_date (TIMESTAMPTZ)
├── status (TEXT: active, cancelled, completed)
├── service_fee_percent (NUMERIC) -- VALID service fee %
├── requires_pass (BOOLEAN) -- Mode B requirement
├── mode (TEXT: mode_a, mode_b) -- Access mode
├── ticket_pricing_enabled (BOOLEAN)
├── pass_pricing_1day, pass_pricing_3day, pass_pricing_7day (INTEGER) -- Pass prices in cents
├── pass_pricing_custom, pass_pricing_custom_days (INTEGER)
├── reentry_allowed (BOOLEAN)
├── reentry_fee_venue, reentry_fee_valid (INTEGER) -- Re-entry fees
├── entry_fee, entry_fee_cents (INTEGER) -- Entry fees
├── re_entry_fee_cents (INTEGER)
├── ticket_price_cents (INTEGER)
├── platform_fee_cents (INTEGER)
├── metadata (JSONB)
└── created_at, updated_at (TIMESTAMPTZ)
```


#### 6. Revenue Profiles (Asset-Level Splits) - 4 rows
```sql
revenue_profiles
├── id (UUID, PK)
├── profile_name (TEXT, UNIQUE)
├── description (TEXT)
├── valid_percentage (DECIMAL) -- Platform share (0-100)
├── vendor_percentage (DECIMAL) -- Vendor share (0-100)
├── pool_percentage (DECIMAL) -- Pool share (0-100)
├── promoter_percentage (DECIMAL) -- Promoter share (0-100)
├── executive_percentage (DECIMAL) -- Executive share (0-100)
├── is_active (BOOLEAN)
├── created_at, updated_at (TIMESTAMPTZ)
└── CONSTRAINT: All percentages must sum to 100
```

#### 7. Tax Profiles - 0 rows
```sql
tax_profiles
├── id (UUID, PK)
├── profile_name (TEXT, UNIQUE)
├── venue_id (TEXT)
├── state_tax_percentage (DECIMAL)
├── local_tax_percentage (DECIMAL)
├── alcohol_tax_percentage (DECIMAL) -- Additional for alcohol
├── food_tax_percentage (DECIMAL) -- Additional for food
├── is_active (BOOLEAN)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 8. Stations (Entry Points) - 3 rows
```sql
stations
├── id (UUID, PK)
├── station_id (TEXT, UNIQUE)
├── venue_id (TEXT)
├── event_id (TEXT, NULLABLE)
├── station_name (TEXT)
├── station_type (TEXT: DOOR, BAR, CONCESSION, MERCH)
├── revenue_profile_id (UUID, FK)
├── tax_profile_id (UUID, FK)
├── fee_logic (JSONB) -- Custom fee rules
├── re_entry_rules (JSONB)
├── id_verification_level (INTEGER: 1, 2, or 3)
├── employee_id, employee_name (TEXT)
├── status (TEXT: active, inactive)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 9. Gateway Points - 9 rows
```sql
gateway_points
├── id (UUID, PK)
├── venue_id (TEXT)
├── name (TEXT)
├── status (ENUM: ENABLED, DISABLED)
├── type (ENUM: ENTRY_POINT, INTERNAL_AREA, TABLE_SEAT)
├── number (INTEGER) -- Optional area/table number
├── accepts_ghostpass (BOOLEAN)
├── linked_area_id (UUID, FK) -- For TABLE_SEAT type
├── employee_name, employee_id (TEXT)
├── visual_identifier (TEXT) -- Icon/image URL
├── created_by (UUID, FK)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 10. Transactions (Main Transaction Table) - 98,752 rows
```sql
transactions
├── id (UUID, PK)
├── wallet_id (UUID, FK)
├── type (TEXT: FUND, SPEND, FEE, REFUND)
├── amount_cents (BIGINT)
├── gateway_id, venue_id (TEXT)
├── gateway_name (TEXT) -- Human-readable name
├── gateway_type (ENUM: ENTRY_POINT, INTERNAL_AREA, TABLE_SEAT)
├── balance_before_cents, balance_after_cents (INTEGER)
├── vendor_name (TEXT)
├── refund_status (ENUM: NONE, PARTIAL, FULL)
├── refund_reference_id (TEXT)
├── provider_tx_id (TEXT)
├── refund_requested_at, refund_completed_at (TIMESTAMPTZ)
├── interaction_method (ENUM: QR, NFC)
├── platform_fee_cents (INTEGER)
├── vendor_payout_cents (INTEGER)
├── context (TEXT)
├── device_fingerprint (TEXT)
├── vendor_id (TEXT)
├── entry_number (INTEGER)
├── entry_type (TEXT: initial, re_entry)
├── venue_reentry_fee_cents (INTEGER)
├── valid_reentry_scan_fee_cents (INTEGER)
├── metadata (JSONB)
└── timestamp (TIMESTAMPTZ)
```


#### 11. Entry Events (Current Entry Tracking) - 48,518 rows
```sql
entry_events
├── id (TEXT, PK)
├── wallet_id (UUID, FK)
├── wallet_binding_id (TEXT)
├── event_id (TEXT)
├── venue_id (TEXT)
├── entry_number (INTEGER) -- Sequential counter
├── entry_type (TEXT: initial, re_entry)
├── gateway_id (UUID, FK) -- References gateway_points
├── gateway_name (TEXT)
├── initial_entry_fee_cents (INTEGER)
├── venue_reentry_fee_cents (INTEGER)
├── valid_reentry_scan_fee_cents (INTEGER)
├── total_fees_cents (INTEGER)
├── device_fingerprint (TEXT)
├── interaction_method (TEXT: QR, NFC)
├── receipt_id (UUID)
├── status (TEXT)
├── pass_id (TEXT)
├── verification_tier (INTEGER: 1, 2, or 3)
├── metadata (JSONB)
└── timestamp (TIMESTAMPTZ)
```

#### 12. Entry Logs (New Structure, RLS Enabled) - 0 rows
```sql
entry_logs
├── id (UUID, PK)
├── wallet_id (UUID, FK)
├── wallet_binding_id (TEXT)
├── venue_id (TEXT)
├── gateway_id (TEXT)
├── entry_number (INTEGER)
├── entry_type (TEXT: INITIAL, RE_ENTRY)
├── interaction_method (TEXT: QR, NFC)
├── fees_charged (JSONB) -- Fee breakdown
├── total_fee_cents (INTEGER)
├── wallet_balance_before, wallet_balance_after (INTEGER)
├── device_fingerprint (TEXT)
├── ghost_pass_token (TEXT)
├── brightness_level (INTEGER) -- Screen brightness for QR
├── receipt_id (UUID)
├── pass_id (TEXT)
├── status (TEXT)
├── metadata (JSONB)
└── timestamp (TIMESTAMPTZ)
```

#### 13. Entry Tracking (Alternative Structure) - 0 rows
```sql
entry_tracking
├── id (UUID, PK)
├── wallet_binding_id (TEXT)
├── venue_id (TEXT)
├── event_id (TEXT)
├── station_id (TEXT)
├── employee_id (TEXT)
├── entry_number (INTEGER)
├── entry_type (TEXT: INITIAL, RE_ENTRY)
├── entry_fee_cents (INTEGER)
├── re_entry_fee_cents (INTEGER)
├── platform_fee_cents (INTEGER)
├── verification_tier (INTEGER: 1, 2, or 3)
├── age_verified (BOOLEAN)
├── transaction_id (UUID)
└── timestamp (TIMESTAMPTZ)
```

#### 14. Menu Items (Dynamic CRUD) - 4 rows
```sql
menu_items
├── id (UUID, PK)
├── venue_id (TEXT)
├── event_id (TEXT, NULLABLE)
├── station_type (TEXT: BAR, CONCESSION, MERCH)
├── item_name (TEXT)
├── item_category (TEXT)
├── price_cents (INTEGER, CHECK >= 0)
├── is_taxable (BOOLEAN)
├── is_alcohol (BOOLEAN) -- Triggers alcohol tax
├── is_food (BOOLEAN) -- Triggers food tax
├── revenue_profile_id (UUID, FK)
├── available (BOOLEAN)
├── sort_order (INTEGER)
├── metadata (JSONB)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 15. Interactions (Mode A & B Tracking) - 17,692 rows
```sql
interactions
├── id (TEXT, PK)
├── wallet_binding_id (TEXT)
├── context (TEXT) -- Venue/event context
├── interaction_method (TEXT: QR, NFC)
├── gateway_id (TEXT)
├── ghost_pass_token (TEXT, NULLABLE) -- NULL for Mode A
├── mode (TEXT) -- pay_per_scan, event
├── amount_charged_cents (INTEGER) -- 0 for Mode B with valid pass
├── status (TEXT)
├── metadata (JSONB)
└── created_at (TIMESTAMPTZ)
```

#### 16. Context Configs (Mode Configuration) - 6 rows
```sql
context_configs
├── id (SERIAL, PK)
├── context (TEXT, UNIQUE)
├── pass_required (BOOLEAN) -- false=Mode A, true=Mode B
├── per_scan_fee_cents (INTEGER) -- Mode A fee
├── pass_options (JSONB) -- Mode B pass types
├── metadata (JSONB)
└── created_at, updated_at (TIMESTAMPTZ)
```

#### 17. Wallet Sessions - 43 rows
```sql
wallet_sessions
├── id (TEXT, PK)
├── wallet_binding_id (TEXT)
├── device_fingerprint (TEXT)
├── event_id, venue_id (TEXT)
├── event_name, venue_name (TEXT)
├── is_active (BOOLEAN)
├── force_surface (BOOLEAN)
├── is_first_scan (BOOLEAN)
├── boarding_pass_mode (BOOLEAN)
├── session_data (JSONB)
├── expires_at (TIMESTAMPTZ)
├── created_at, last_accessed (TIMESTAMPTZ)
└── updated_at (TIMESTAMP)
```

#### 18. ID Verification Logs (No PII) - 0 rows
```sql
id_verification_logs
├── id (UUID, PK)
├── entry_id (UUID)
├── station_id (TEXT)
├── employee_id (TEXT)
├── verification_tier (INTEGER: 1, 2, or 3)
├── age_flag_verified (BOOLEAN)
├── footprint_verified (BOOLEAN)
├── footprint_onboarding_id (TEXT)
└── timestamp (TIMESTAMPTZ)
-- NOTE: NO raw ID data stored (GDPR/CCPA compliant)
```

#### 16. Audit Logs (Admin Actions)
```sql
audit_logs
├── id (UUID, PK)
├── admin_user_id (UUID, FK)
├── action (TEXT) -- CREATE, UPDATE, DELETE, etc.
├── resource_type (TEXT) -- user, venue, event, etc.
├── resource_id (TEXT)
├── old_value (JSONB)
├── new_value (JSONB)
├── timestamp (TIMESTAMPTZ)
└── metadata (JSONB)
```


#### 17. Payout Requests
```sql
payout_requests
├── id (UUID, PK)
├── vendor_user_id (UUID, FK)
├── amount_cents (INTEGER)
├── status (TEXT) -- PENDING, APPROVED, REJECTED, PAID
├── requested_at (TIMESTAMPTZ)
├── processed_at (TIMESTAMPTZ)
├── processed_by (UUID, FK) -- Admin user
└── notes (TEXT)
```

#### 18. SSO Tokens (Single Sign-On)
```sql
sso_tokens
├── id (UUID, PK)
├── token (TEXT, UNIQUE)
├── user_id (UUID, FK)
├── expires_at (TIMESTAMPTZ)
├── used (BOOLEAN)
└── created_at (TIMESTAMPTZ)
```

### Database Functions (Atomic Operations)

**NOTE**: The database has atomic transaction functions defined in migrations, but the actual API implementation uses direct SQL queries in most cases rather than calling these functions.

#### 1. process_purchase_atomic() - Defined but not actively used
```sql
-- Atomically processes a purchase with:
-- - Wallet balance check and deduction
-- - Tax calculation BEFORE revenue split
-- - Revenue distribution calculation
-- - Transaction ledger insertion
-- - Returns success/failure with new balance
```

#### 2. process_entry_atomic() - Defined but not actively used
```sql
-- Atomically processes venue entry with:
-- - Entry vs re-entry detection
-- - Fee calculation (initial/re-entry)
-- - Wallet balance check and deduction
-- - Entry tracking insertion
-- - ID verification logging
-- - Returns entry details and new balance
```

**Current Implementation**: Most endpoints use direct Supabase queries with manual transaction handling rather than calling these database functions.

### Indexes (Performance Optimization)

**NOTE**: Indexes are defined in migrations. Key indexes on active tables:

```sql
-- Entry Events (48,518 rows)
idx_entry_events_wallet_id
idx_entry_events_gateway_id

-- Transactions (98,752 rows)
idx_transactions_wallet_id
idx_transactions_timestamp

-- Interactions (17,692 rows)
idx_interactions_wallet
idx_interactions_context
idx_interactions_mode

-- Wallets (5,156 rows)
idx_wallets_device_fingerprint
idx_wallets_wallet_binding_id (UNIQUE)
idx_wallets_user_id (UNIQUE)

-- Ghost Passes (37 rows)
idx_ghost_passes_wallet_binding
idx_ghost_passes_context
idx_ghost_passes_status
idx_ghost_passes_expires

-- Gateway Points (9 rows)
idx_gateway_points_venue_id
idx_gateway_points_type
```

**Database State Summary**:
- **Active tables with data**: transactions (98K), entry_events (48K), interactions (17K), wallets (5K)
- **New tables (empty)**: venue_transaction_ledger, entry_logs, entry_tracking - defined but not yet used
- **Dual structures**: System has both old and new table structures, with old tables actively used
- **RLS enabled**: entry_logs, entry_configurations, sensory_signals, senate tables, push_subscriptions, wallet_surface_logs, brightness_logs, wallet_persistence, vendor_items, sso_tokens

---

## Backend API Architecture

### API Route Structure

#### Wallet Operations (`/api/wallet/`)
- `POST /wallet/fund` - Add funds (DEVICE FINGERPRINT - no auth)
- `GET /wallet/balance` - Get balance (DEVICE FINGERPRINT - no auth, auto-creates wallet)
- `GET /wallet/transactions` - Transaction history (DEVICE FINGERPRINT - no auth)
- `POST /wallet/bind-device` - Bind wallet to device
- `POST /wallet/surface-wallet` - Convert anonymous to user wallet (REQUIRES AUTH)
- `POST /wallet/recover` - Recover wallet with recovery code (DEVICE FINGERPRINT)
- `POST /wallet/create-proof` - Generate recovery proof (REQUIRES AUTH)
- `GET /wallet/proofs` - List recovery proofs (REQUIRES AUTH)
- `POST /wallet/biometric-challenge` - Start biometric auth
- `POST /wallet/biometric-verify` - Verify biometric
- `POST /wallet/refund-request` - Request refund
- `GET /wallet/refund-history` - Refund history
- `GET /wallet/refund-eligible` - Check refund eligibility


#### GhostPass Operations (`/api/ghostpass/`)
- `POST /ghostpass/purchase` - Buy a ghost pass (REQUIRES AUTH - user_id based)
- `GET /ghostpass/status` - Check pass status
- `GET /ghostpass/pricing` - Get pricing tiers
- `POST /ghostpass/revoke` - Revoke a pass (admin)

#### Entry Processing (`/api/entry/`)
- `POST /entry/process-scan` - Process QR/NFC scan (REQUIRES AUTH - staff token)
- `POST /entry/process-scan-optimized` - Optimized entry flow
- `POST /entry/process-with-verification` - Entry with ID verification
- `POST /entry/check-permission` - Pre-check entry eligibility
- `GET /entry/tracking-history` - Entry history for wallet
- `POST /entry/scan` - Generic scan endpoint

#### Modes (Anonymous-Friendly) (`/api/modes/`)
- `POST /modes/check-context` - Check access mode (DEVICE FINGERPRINT)
- `POST /modes/process-scan` - Process scan Mode A/B (DEVICE FINGERPRINT)
- `POST /modes/purchase-pass` - Purchase pass Mode B (DEVICE FINGERPRINT)

#### Stripe Integration (`/api/stripe/`)
- `POST /stripe/create-checkout-session` - Create Stripe checkout
- `POST /stripe/webhook` - Handle Stripe webhooks (payment confirmation)

#### Authentication (`/api/auth/`)
- `POST /auth/register` - User registration
- `POST /auth/register-venue-admin` - Venue admin registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/sso-token` - Generate SSO token

#### Venue Management (`/api/venues/`)
- `POST /venues/create` - Create venue
- `GET /venues/list` - List venues
- `GET /venue/config` - Get venue configuration
- `GET /venue/dashboard` - Venue dashboard stats
- `GET /venue/stats` - Venue statistics
- `GET /venue/audit-logs` - Venue audit trail
- `GET /venue/payouts` - Venue payout history
- `GET /venue/items` - Venue menu items

#### Event Management (`/api/events/`)
- `POST /events/create` - Create event
- `GET /events/list` - List events
- `PUT /events/update` - Update event
- `DELETE /events/delete` - Delete event

#### Admin Operations (`/api/admin/`)
- `GET /admin/dashboard` - System-wide dashboard
- `GET /admin/users` - User management
- `PUT /admin/users/[user_id]/role` - Update user role
- `GET /admin/audit-logs` - System audit logs
- `GET /admin/payouts` - Payout management
- `POST /admin/payouts/process` - Process payouts
- `GET /admin/fee-distribution` - Fee distribution report
- `GET /admin/revenue-profiles` - Revenue profile management
- `GET /admin/tax-profiles` - Tax profile management
- `GET /admin/health` - System health check
- `GET /admin/ledger-query` - Query transaction ledger
- `GET /admin/fees/config` - Fee configuration
- `POST /admin/fees/scan` - Update scan fees
- `GET /admin/pricing/ghostpass` - GhostPass pricing
- `POST /admin/retention/override` - Data retention override

#### Gateway Management (`/api/gateway/`)
- `GET /gateway/points` - List gateway points
- `POST /gateway/points` - Create gateway point
- `GET /gateway/points/[id]` - Get gateway details
- `PUT /gateway/points/[id]` - Update gateway
- `DELETE /gateway/points/[id]` - Delete gateway
- `GET /gateway/metrics` - Gateway metrics
- `POST /gateway/metrics/record` - Record metric
- `GET /gateway/metrics/[point_id]` - Point-specific metrics
- `GET /gateway/financial-distribution` - Financial distribution


#### Footprint Integration (`/api/footprint/`)
- `POST /footprint/create-session` - Create KYC session
- `POST /footprint/validate-session` - Validate KYC completion

#### Notifications (`/api/notifications/`)
- `POST /notifications/subscribe` - Subscribe to push notifications
- `POST /notifications/unsubscribe` - Unsubscribe
- `GET /notifications/vapid-public-key` - Get VAPID public key
- `POST /notifications/send-entry-confirmation` - Send entry notification

#### Tickets (`/api/tickets/`)
- `GET /tickets/events` - List ticketed events
- `GET /tickets/types` - Ticket types for event
- `POST /tickets/purchase` - Purchase ticket
- `GET /tickets/list` - User's tickets
- `POST /tickets/validate` - Validate ticket

#### Menu Management (`/api/menu/`)
- `GET /menu/public` - Public menu items
- `POST /menu/manage` - Manage menu items (CRUD)

#### Stations (`/api/stations/`)
- `POST /stations/manage` - Station CRUD operations

#### QR Assets (`/api/qr-assets/`)
- `GET /qr-assets/list` - List QR/NFC assets
- `POST /qr-assets/provision` - Provision new asset

#### Revenue Profiles (`/api/revenue-profiles/`)
- `POST /revenue-profiles/manage` - Revenue profile CRUD

#### Audit (`/api/audit/`)
- `GET /audit/history` - Audit history
- `GET /audit/summary` - Audit summary
- `GET /audit/entry-point` - Entry point audit
- `GET /audit/entry-point-logs` - Entry point logs
- `GET /audit/recent-scans` - Recent scan activity
- `GET /audit/employee-activity` - Employee activity logs

### API Middleware & Utilities

#### CORS Handler (`_lib/cors.ts`)
```typescript
- setCorsHeaders() - Set CORS headers
- handleCors() - Handle OPTIONS preflight
```

#### Authentication (`_lib/auth.ts`)
```typescript
- verifyToken() - Verify JWT token
- getCurrentUser() - Get authenticated user
- requireAuth() - Require authentication
- requireAdmin() - Require admin role
```

#### Device Authentication (`_lib/device-auth.ts`)
```typescript
- getWalletFromDevice() - Get/create wallet from fingerprint
- requireDeviceAuth() - Require device authentication
```

#### Supabase Client (`_lib/supabase.ts`)
```typescript
- supabase - Singleton Supabase client
```

#### Connection Pooling (`_lib/supabase-pool.ts`)
```typescript
- getSupabaseClient() - Get pooled client
- executeTransaction() - Execute multiple queries atomically
- batchRead() - Batch read operations
```

#### Error Handler (`_lib/handler.ts`)
```typescript
- errorHandler() - Standardized error responses
```

---

## Frontend Architecture

### Component Structure

#### Core Components
- `App.tsx` - Root component with routing
- `Layout.tsx` - Main layout with bottom navigation
- `AuthProvider.tsx` - Authentication context provider


#### User-Facing Components
- `WalletDashboard.tsx` - Main wallet view with balance
- `QRCodeView.tsx` - Display QR code for entry
- `TrustCenter.tsx` - Wallet funding interface
- `TransactionHistory.tsx` - Transaction ledger
- `GhostPassWallet.tsx` - Ghost pass management
- `TicketPurchase.tsx` - Event ticket purchasing
- `FootprintVerification.tsx` - KYC verification flow
- `WalletRecovery.tsx` - Wallet recovery interface
- `PushNotificationSettings.tsx` - Notification preferences
- `LanguageSelector.tsx` - i18n language switcher

#### Operator Components
- `OperatorLogin.tsx` - Staff/operator authentication
- `GhostPassScanner.tsx` - QR/NFC scanner for entry
- `GhostPassEntryManager.tsx` - Entry management interface
- `VendorPurchase.tsx` - Point-of-sale for vendors
- `MenuBasedVendorPurchase.tsx` - Menu-driven POS
- `EntryTester.tsx` - Entry flow testing tool

#### Admin Components
- `DashboardSelector.tsx` - Admin dashboard switcher
- `GhostPassAdminPanel.tsx` - System administration
- `EventManager.tsx` - Event CRUD operations
- `GatewayManagerPage.tsx` - Gateway management
- `GatewayMetrics.tsx` - Gateway analytics
- `FinancialDistribution.tsx` - Revenue distribution view
- `AuditTrail.tsx` - Audit log viewer
- `GhostPassRevocationManager.tsx` - Pass revocation
- `AdminSetupCheck.tsx` - System setup verification

#### Venue Admin Components
- `VenueCommandCenter.tsx` - Venue operations dashboard
- `CommandCenterPage.tsx` - Command center router
- `CommandCenterRouter.tsx` - Venue admin routing

#### Testing/Development Components
- `GhostPassModesTester.tsx` - Mode A/B testing
- `GhostPassInteractionSimulator.tsx` - Interaction simulator
- `TestSignalInjector.tsx` - Test data injection
- `SenateEvaluation.tsx` - Senate evaluation tool
- `SensoryCargoMonitor.tsx` - Sensory monitoring

### State Management

#### React Query (Server State)
```typescript
// Example: Wallet balance query
const { data: balance } = useQuery({
  queryKey: ['wallet', 'balance'],
  queryFn: () => api.get('/wallet/balance'),
  refetchInterval: 30000, // 30s polling
});
```

#### Context API (Auth State)
```typescript
// AuthProvider context
interface AuthContext {
  user: User | null;
  login: (email, password) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
```

### Custom Hooks
- `useSession.ts` - Session management
- `useSupabaseRealtime.ts` - Real-time subscriptions

### API Client (`lib/api.ts`)
```typescript
// Axios instance with interceptors
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token)
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle errors)
api.interceptors.response.use(
  (response) => response,
  (error) => handleApiError(error)
);
```


### Styling System (Abyssal Glass Theme)

#### Color Palette
```css
/* Dark backgrounds */
--abyss-950: #020617;
--abyss-900: #0f172a;
--abyss-800: #1e293b;

/* Neon accents */
--neon-cyan: #00ffff;
--neon-green: #00ff41;
--neon-red: #ff073a;

/* Glass morphism */
--glass-bg: rgba(15, 23, 42, 0.7);
--glass-border: rgba(0, 255, 255, 0.2);
```

#### Typography
- **Headers**: Inter (sans-serif)
- **Data/Terminal**: JetBrains Mono (monospace)

#### Key UI Patterns
- **Glass Cards**: Translucent backgrounds with backdrop blur
- **Neon Text**: Glowing text with shadow effects
- **Terminal Inputs**: Monospace inputs with neon borders
- **Bottom Navigation**: Mobile-first tab bar

---

## Authentication & Security

### Authentication Modes

**CRITICAL NOTE**: The system has TWO parallel authentication systems:
1. **Supabase Auth (JWT)** - For authenticated users (requireAuth)
2. **Device Fingerprint** - For anonymous users (device-based)

Some endpoints require Supabase authentication, others work with device fingerprint only. Check each endpoint's implementation.

#### 1. Anonymous (Device-Based)
```
User opens app
    ↓
Generate device fingerprint (browser + hardware)
    ↓
Create anonymous wallet (wallet_binding_id)
    ↓
Bind to device_fingerprint
    ↓
User can fund and use wallet without account
```

**Device Fingerprint Components:**
- User agent
- Screen resolution
- Timezone
- Language
- Canvas fingerprint
- WebGL fingerprint

#### 2. Authenticated (User Account)
```
User registers/logs in
    ↓
Supabase Auth (JWT)
    ↓
Link existing wallet to user_id
    ↓
"Surface" wallet (wallet_surfaced = true)
```

#### 3. Venue Admin
```
Admin creates venue admin account
    ↓
User assigned VENUE_ADMIN role
    ↓
Linked to venue_id
    ↓
Access venue-scoped operations
```

#### 4. Platform Admin
```
User assigned ADMIN role
    ↓
Full system access
    ↓
Audit logging for all actions
```

### Security Features

#### 1. Device Binding
- Wallet locked to device fingerprint
- Prevents unauthorized access from other devices
- Can be unlocked with recovery proof

#### 2. Biometric Verification
- WebAuthn API for biometric authentication
- Challenge-response flow
- Stored in `biometric_challenges` table

#### 3. Identity Verification (Footprint)
- KYC/AML compliance via Footprint
- Age verification for alcohol sales
- No raw ID data stored (GDPR/CCPA compliant)
- Footprint ID linked to wallet

#### 4. Row Level Security (RLS)
```sql
-- Example: Users can only see their own wallets
CREATE POLICY wallet_access ON wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Venue admins can only see their venue data
CREATE POLICY venue_admin_access ON events
  FOR ALL
  USING (
    venue_id IN (
      SELECT venue_id FROM users WHERE id = auth.uid()
    )
  );
```


#### 5. Audit Logging
- All admin actions logged to `audit_logs`
- Immutable transaction ledger
- Entry point audit logs
- Employee activity tracking

#### 6. API Security
- CORS headers for cross-origin requests
- JWT token verification
- Rate limiting (Vercel built-in)
- Webhook signature verification (Stripe)

---

## Core Business Flows

### Flow 1: Anonymous Wallet Creation & Funding (Stripe)

```
1. User opens app (no account)
   ↓
2. Frontend generates device fingerprint
   ↓
3. GET /api/wallet/balance
   - Header: X-Device-Fingerprint: <fingerprint>
   ↓
4. Backend checks for existing wallet by fingerprint
   ↓
5. If not found: Create new wallet automatically
   - wallet_binding_id = "wallet_<random_hex>"
   - device_fingerprint = <fingerprint>
   - balance_cents = 0
   - device_bound = true
   - wallet_surfaced = false
   ↓
6. User clicks "Add Funds" → POST /api/stripe/create-checkout-session
   - Body: { 
       amount: 5000 (cents), 
       wallet_binding_id, 
       device_fingerprint,
       success_url, 
       cancel_url 
     }
   ↓
7. Backend creates Stripe Checkout Session
   - Metadata: { wallet_binding_id, device_fingerprint }
   - Returns: { url: <stripe_checkout_url> }
   ↓
8. User redirected to Stripe Checkout
   ↓
9. User completes payment on Stripe
   ↓
10. Stripe webhook: POST /api/stripe/webhook
    - Event: checkout.session.completed
    - Metadata: { wallet_binding_id, device_fingerprint }
    ↓
11. Webhook handler:
    - Get wallet by wallet_binding_id
    - Update balance: balance_cents += amount_total
### Flow 2: Ghost Pass Purchase (Mode B - Authenticated)

```
1. User has funded wallet and is authenticated
   ↓
2. GET /api/ghostpass/pricing
   - Returns: { '1': 1000, '3': 2000, '5': 3500, '7': 5000, '10': 6500, '14': 8500, '30': 10000 }
   ↓
3. User selects duration (e.g., 3 days)
   ↓
4. POST /api/ghostpass/purchase
   - Body: { duration: 3 }
   - Auth: Bearer <token> (REQUIRED)
   ↓
5. Backend validates:
   - User authenticated (requireAuth)
   - Get wallet by user_id
   - Check wallet balance >= price_cents
   - Duration is valid (1, 3, 5, 7, 10, 14, or 30 days)
   ↓
6. Atomic transaction:
   - pass_id = UUID
   - expires_at = NOW() + duration * 24h
   - Deduct price_cents from wallet
   - Create ghost_pass record:
     * id = pass_id
     * user_id = user.id
     * status = 'ACTIVE'
     * expires_at = <timestamp>
     * duration_days = duration
     * price_cents = <price>
   - Insert transaction record:
     * type = 'SPEND'
     * amount_cents = -price_cents
     * vendor_name = 'GhostPass System'
   ↓
7. Return pass details:
   {
     pass_id: <uuid>,
     expires_at: <timestamp>,
     amount_charged_cents: 2000,
     status: 'success'
   }
   ↓
8. Frontend displays QR code with pass_id
```

**Note**: This flow requires authentication. For anonymous users, use Mode A (pay-per-scan) or the modes API.- Deduct price_cents from wallet
   - Create ghost_pass record
     * id = UUID (pass token)
     * expires_at = NOW() + duration * 24h
     * status = 'ACTIVE'
   - Insert transaction record
   ↓
7. Return pass details:
   {
     pass_id: <uuid>,
     expires_at: <timestamp>,
     amount_charged_cents: 2000,
     status: 'success'
   }
   ↓
8. Frontend displays QR code with pass_id
```

### Flow 3: Venue Entry (QR Scan - Authenticated)

```
1. User arrives at venue
   ↓
2. User opens QR code view
   - Displays pass_id as QR code
   ↓
3. Venue staff scans QR code
   ↓
4. Scanner app: POST /api/entry/process-scan
   - Body: {
       wallet_binding_id: <id>,
       venue_id: <venue>,
       gateway_id: <gateway>,
       pass_id: <scanned_code>,
       interaction_method: 'QR'
     }
   - Auth: Bearer <staff_token> (REQUIRED)
   ↓
5. Backend validates:
   - Staff authenticated (requireAuth)
   - Venue and gateway exist (query venues, gateways tables)
   - Check previous entries: query entry_logs by wallet_binding_id + venue_id
   ↓
6. Determine entry type:
   - No previous entries → INITIAL ENTRY
   - Has previous entries → RE-ENTRY
   ↓
7. Calculate fees:
   - Initial: initial_entry_fee_cents (from venue, default 500¢)
   - Re-entry: reentry_fee_cents (from venue, default 200¢)
   - Platform fee: valid_reentry_scan_fee_cents = 25¢ (for re-entry only)
   - total_fees_cents = sum of applicable fees
   ↓
8. Get wallet by user_id (from authenticated user)
   - Check balance >= total_fees_cents
   - If insufficient → Return 402 Payment Required
   ↓
9. Deduct fees from wallet:
   - Update wallets: balance_cents -= total_fees_cents
   ↓
10. Log entry:
    - Insert into entry_logs:
      * receipt_id = UUID
      * user_id, wallet_binding_id, venue_id, gateway_id, pass_id
      * entry_type = 'initial' or 're_entry'
      * entry_number = count + 1
      * fees breakdown
      * status = 'APPROVED'
   ↓
11. Log transaction:
    - Insert into transactions:
      * amount_cents = -total_fees_cents
      * transaction_type = 'entry_fee' or 'reentry_fee'
      * description = "Entry at <venue> - <gateway>"
   ↓
12. Send push notification (async, non-blocking)
    - POST /api/notifications/send-entry-confirmation
   ↓
13. Return success:
    {
      status: 'APPROVED',
      message: 'Entry approved',
      receipt_id: <uuid>,
      entry_info: {
        entry_type: 'initial',
        entry_number: 1,
        fees: { total_fees_cents: 525 },
        venue_name, gateway_name,
        entry_timestamp,
        new_balance_cents: 4475
      }
    }
   ↓
14. Scanner displays approval
    - Green screen + entry details
```

**Note**: This flow requires authentication. Tables used: venues, gateways, entry_logs, wallets, transactions.


### Flow 4: Mode A/B Interaction (Anonymous Pay-Per-Scan or Event Pass)

```
1. User at venue/event
   ↓
2. Check context mode: POST /api/modes/check-context
   - Body: { context, wallet_binding_id, ghost_pass_token }
   - Returns: { 
       access_granted: boolean,
       mode: 'pay_per_scan' | 'event',
       requires_payment: boolean,
       payment_amount_cents: number,
       requires_pass_purchase: boolean,
       pass_options: []
     }
   ↓
3. If requires_pass_purchase:
   - User must purchase pass first
   - POST /api/modes/purchase-pass
     * Body: { context, pass_id, wallet_binding_id, device_fingerprint }
     * Deducts from wallet
     * Creates ghost_pass record
     * Returns: { ghost_pass_token, pass_info }
   ↓
4. Process scan: POST /api/modes/process-scan
   - Body: {
       context,
       wallet_binding_id,
       interaction_method: 'QR' | 'NFC',
       gateway_id,
       ghost_pass_token (if Mode B)
     }
   - Header: X-Device-Fingerprint
   ↓
5. Backend checks access via /api/modes/check-context
   ↓
6. If Mode A (pay-per-scan):
   - Get wallet by wallet_binding_id + device_fingerprint
   - Check balance >= payment_amount_cents
   - Deduct fee from wallet
   - Insert transaction record
   - amount_charged_cents = per_scan_fee_cents
   ↓
7. If Mode B (event pass):
   - Validate ghost_pass_token
   - Check pass not expired
   - No charge (pass already purchased)
   - amount_charged_cents = 0
   ↓
8. Log interaction:
   - Insert into interactions table:
     * id = interaction_id
     * wallet_binding_id, context, gateway_id
     * ghost_pass_token (NULL for Mode A)
     * mode = 'pay_per_scan' or 'event'
     * amount_charged_cents
     * status = 'success'
   ↓
9. Return success:
   {
     success: true,
     interaction_id,
     mode: 'pay_per_scan' | 'event',
     amount_charged_cents,
     balance_after_cents,
     message: 'Access granted'
   }
```

**Note**: This flow works for anonymous users (device fingerprint only). No authentication required.

### Flow 6: Wallet Recovery

```
1. User loses device or clears browser data
   ↓
2. User opens app on new device
   ↓
3. Click "Recover Wallet"
   ↓
4. Enter wallet credentials:
   - wallet_binding_id (e.g., "wallet_abc123...")
   - recovery_code (previously generated)
   ↓
5. POST /api/wallet/recover
   - Body: { wallet_binding_id, recovery_code }
   - Header: X-Device-Fingerprint: <new_fingerprint>
   ↓
6. Backend validates:
   - Find wallet by wallet_binding_id
   - Hash recovery_code with SHA-256
   - Compare with wallet.recovery_code_hash
   - If mismatch → Return 401 Invalid recovery code
   ↓
7. Update wallet with new device:
   - device_fingerprint = <new_fingerprint>
   - updated_at = NOW()
   ↓
8. Create new wallet session:
   - session_id = "session_<timestamp>_<random>"
   - expires_at = NOW() + 1 year
   - Insert into wallet_sessions table
   ↓
9. Return success:
   {
     success: true,
     message: 'Wallet recovered successfully',
     wallet: {
       id, wallet_binding_id, balance_cents
     },
     session: {
       session_id, expires_at
     }
   }
   ↓
10. User regains access to wallet on new device
```

**Note**: Recovery code is stored as SHA-256 hash. User must have both wallet_binding_id and recovery_code.

### Flow 7: Admin Fee Distribution

```
1. Admin logs in
   ↓
2. Navigate to Admin Dashboard
   ↓
3. GET /api/admin/fee-distribution?start_date=<date>&end_date=<date>
   ↓
4. Backend queries transaction_ledger:
   - Filter by date range
   - Group by revenue_profile_id
   - Sum split_breakdown amounts
   ↓
5. Calculate totals:
   - Total Valid fees
   - Total Vendor fees
   - Total Pool fees
   - Total Promoter fees
   - Total Executive fees
   ↓
6. Return distribution report:
   {
     total_transactions: 1523,
     total_revenue_cents: 45690,
     distribution: {
       valid: 18276,
       vendor: 13707,
       pool: 9138,
       promoter: 4569
     },
     by_venue: [ ... ],
     by_event: [ ... ]
   }
   ↓
7. Admin reviews and exports report
```


---

## Payment Integration

### Stripe Integration Architecture

#### 1. Checkout Session Flow
```
Frontend → Backend → Stripe → User → Stripe → Webhook → Backend → Database
```

#### 2. Create Checkout Session
```typescript
// POST /api/stripe/create-checkout-session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: {
        name: 'Wallet Funding',
      },
      unit_amount: amount_cents,
    },
    quantity: 1,
  }],
  success_url: `${origin}/wallet?success=true`,
  cancel_url: `${origin}/wallet?canceled=true`,
  metadata: {
    wallet_binding_id: wallet_binding_id,
    device_fingerprint: device_fingerprint,
  },
});

return { url: session.url };
```

#### 3. Webhook Handler
```typescript
// POST /api/stripe/webhook
// Verify signature
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret
);

// Handle event
switch (event.type) {
  case 'checkout.session.completed':
    const session = event.data.object;
    const { wallet_binding_id } = session.metadata;
    const amount = session.amount_total;
    
    // Update wallet balance
    await supabase
      .from('wallets')
      .update({ 
        balance_cents: balance + amount 
      })
      .eq('wallet_binding_id', wallet_binding_id);
    
    // Record transaction
    await supabase.from('transactions').insert({
      wallet_binding_id,
      type: 'credit',
      amount_cents: amount,
      status: 'completed',
      stripe_session_id: session.id,
    });
    break;
}
```

#### 4. Security Features
- **Webhook Signature Verification**: Ensures events are from Stripe
- **Idempotency**: Handle duplicate webhook events
- **Metadata Tracking**: wallet_binding_id for attribution
- **PCI Compliance**: No card data touches our servers

#### 5. Test Cards (Stripe Test Mode)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires Auth: 4000 0025 0000 3155


---

## Multi-Tenant System

### Tenant Hierarchy
```
Platform (GhostPass)
    ↓
Venues (venue_id)
    ↓
Events (event_id)
    ↓
Stations (station_id)
    ↓
Assets (QR/NFC codes)
```

### Data Isolation

#### 1. Venue-Level Isolation
- All data scoped to `venue_id`
- Venue admins can only access their venue data
- RLS policies enforce isolation

#### 2. Event-Level Isolation
- Events belong to venues
- Event staff can only access their event data
- Tickets and passes scoped to events

#### 3. Station-Level Isolation
- Stations belong to venues/events
- Employees assigned to specific stations
- Transactions tracked by station

### Configuration Inheritance
```
Platform Defaults
    ↓ (override)
Venue Configuration
    ↓ (override)
Event Configuration
    ↓ (override)
Station Configuration
    ↓ (override)
Asset Configuration
```

### Revenue Profile Assignment
```
Default Profile (Platform)
    ↓
Venue Profile (venue_id)
    ↓
Event Profile (event_id)
    ↓
Station Profile (station_id)
    ↓
Asset Profile (asset_code)
    ↓
Menu Item Profile (item_id)
```

**Priority**: Most specific wins (Asset > Station > Event > Venue > Default)


### Tax Profile Assignment
```
Default Tax Profile (Platform)
    ↓
Venue Tax Profile (venue_id)
    ↓
Event Tax Profile (event_id)
    ↓
Station Tax Profile (station_id)
```

**Tax Calculation Order**:
1. Calculate base amount
2. Apply tax BEFORE revenue split
3. Add platform fee
4. Calculate revenue split on platform fee only
5. Total charge = base + tax + platform_fee

---

## Deployment Architecture

### Infrastructure Overview
```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                   │
│                  (Global CDN + DDoS Protection)          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Vercel Functions                      │
│              (Serverless Node.js Runtime)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  API Routes │  │  Webhooks   │  │  Cron Jobs  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Supabase Platform                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  PostgreSQL │  │  Auth       │  │  Realtime   │    │
│  │  (Database) │  │  (JWT)      │  │  (WebSocket)│    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  External Services                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Stripe    │  │  Footprint  │  │  Web Push   │    │
│  │  (Payments) │  │  (KYC/AML)  │  │  (Notify)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Vercel Configuration

#### Project Structure
```
project/
├── api/              # Serverless functions
│   └── [route].ts    # Auto-deployed as /api/[route]
├── src/              # Frontend source
├── dist/             # Build output
├── public/           # Static assets
└── vercel.json       # Deployment config
```

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ]
}
```

### Environment Variables

#### Required Variables
```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Footprint
FOOTPRINT_SECRET_KEY=fp_xxx
FOOTPRINT_PLAYBOOK_KEY=pb_xxx

# Web Push
VAPID_PUBLIC_KEY=BPxxx...
VAPID_PRIVATE_KEY=xxx...
VAPID_SUBJECT=mailto:admin@ghostpass.com

# Application
API_BASE_URL=https://ghostpass.vercel.app
NODE_ENV=production
```


## Security Best Practices

### 1. Authentication
- ✅ JWT tokens with expiration
- ✅ Device fingerprinting for anonymous users
- ✅ Biometric authentication option
- ✅ SSO token generation for cross-app auth

### 2. Authorization
- ✅ Role-based access control (USER, VENUE_ADMIN, ADMIN)
- ✅ Row Level Security (RLS) policies
- ✅ Venue-scoped data access
- ✅ API endpoint authorization checks

### 3. Data Protection
- ✅ No raw ID data stored (GDPR/CCPA compliant)
- ✅ Encrypted connections (HTTPS/WSS)
- ✅ Sensitive data in environment variables
- ✅ Audit logging for admin actions

### 4. Payment Security
- ✅ PCI compliance (Stripe handles card data)
- ✅ Webhook signature verification
- ✅ Idempotency for duplicate events
- ✅ Secure metadata tracking

### 5. API Security
- ✅ CORS headers
- ✅ Rate limiting (Vercel built-in)
- ✅ Input validation
- ✅ Error handling without leaking details

### 6. Database Security
- ✅ Connection pooling
- ✅ Prepared statements (SQL injection prevention)
- ✅ Row Level Security
- ✅ Atomic transactions

---

## Performance Optimization

### Frontend
- **Code Splitting**: Lazy load routes and components
- **Image Optimization**: SVG icons, optimized assets
- **Caching**: TanStack Query with 30s stale time
- **Debouncing**: User input (search, filters)
- **Virtual Scrolling**: Large lists (transaction history)

### Backend
- **Connection Pooling**: Reuse database connections
- **Batch Operations**: Reduce round trips
- **Atomic Functions**: Database-level transactions
- **Indexes**: All foreign keys and query columns
- **Query Optimization**: Select only needed columns

### Database
- **Indexes**: 20+ indexes on critical tables
- **Partitioning**: Future for transaction_ledger
- **Materialized Views**: Complex analytics
- **Vacuum**: Regular maintenance (Supabase managed)

---


## API Endpoint Reference

### Complete Endpoint List

#### Authentication & Users
```
POST   /api/auth/register
POST   /api/auth/register-venue-admin
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/sso-token
```

#### Wallet Operations
```
POST   /api/wallet/fund
POST   /api/wallet/fund-optimized
GET    /api/wallet/balance
GET    /api/wallet/transactions
POST   /api/wallet/bind-device
POST   /api/wallet/verify-device
POST   /api/wallet/surface-wallet
POST   /api/wallet/surface-wallet-anonymous
POST   /api/wallet/recover
POST   /api/wallet/create-proof
GET    /api/wallet/proofs
POST   /api/wallet/biometric-challenge
POST   /api/wallet/biometric-verify
POST   /api/wallet/refund-request
GET    /api/wallet/refund-history
GET    /api/wallet/refund-eligible
POST   /api/wallet/revoke-ghostpass
POST   /api/wallet/atomic-transaction
GET    /api/wallet/platform-fee-config
POST   /api/wallet/admin-platform-fee
POST   /api/wallet/admin-fee-distribution
POST   /api/wallet/admin-process-payouts
```

#### Ghost Pass
```
POST   /api/ghostpass/purchase
GET    /api/ghostpass/status
GET    /api/ghostpass/pricing
```

#### Entry Processing
```
POST   /api/entry/process-scan
POST   /api/entry/process-scan-optimized
POST   /api/entry/process-with-verification
POST   /api/entry/check-permission
GET    /api/entry/tracking-history
POST   /api/entry/scan
```

#### Stripe
```
POST   /api/stripe/create-checkout-session
POST   /api/stripe/webhook
```

#### Venues
```
POST   /api/venues/create
GET    /api/venues/list
GET    /api/venue/config
GET    /api/venue/dashboard
GET    /api/venue/stats
GET    /api/venue/audit-logs
GET    /api/venue/payouts
GET    /api/venue/items
```

#### Events
```
POST   /api/events/create
GET    /api/events/list
PUT    /api/events/update
DELETE /api/events/delete
```


#### Admin
```
GET    /api/admin/dashboard
GET    /api/admin/users
PUT    /api/admin/users/[user_id]/role
GET    /api/admin/audit-logs
GET    /api/admin/payouts
POST   /api/admin/payouts/process
GET    /api/admin/fee-distribution
GET    /api/admin/revenue-profiles
GET    /api/admin/tax-profiles
GET    /api/admin/health
GET    /api/admin/ledger-query
GET    /api/admin/fees/config
POST   /api/admin/fees/scan
GET    /api/admin/pricing/ghostpass
POST   /api/admin/retention/override
```

#### Gateway
```
GET    /api/gateway/points
POST   /api/gateway/points
GET    /api/gateway/points/[id]
PUT    /api/gateway/points/[id]
DELETE /api/gateway/points/[id]
GET    /api/gateway/metrics
POST   /api/gateway/metrics/record
GET    /api/gateway/metrics/[point_id]
GET    /api/gateway/financial-distribution
```

#### Footprint (KYC)
```
POST   /api/footprint/create-session
POST   /api/footprint/validate-session
```

#### Notifications
```
POST   /api/notifications/subscribe
POST   /api/notifications/unsubscribe
GET    /api/notifications/vapid-public-key
POST   /api/notifications/send-entry-confirmation
```

#### Tickets
```
GET    /api/tickets/events
GET    /api/tickets/types
POST   /api/tickets/purchase
GET    /api/tickets/list
POST   /api/tickets/validate
```

#### Menu
```
GET    /api/menu/public
POST   /api/menu/manage
```

#### Stations
```
POST   /api/stations/manage
```

#### QR Assets
```
GET    /api/qr-assets/list
POST   /api/qr-assets/provision
```

#### Revenue Profiles
```
POST   /api/revenue-profiles/manage
```

#### Audit
```
GET    /api/audit/history
GET    /api/audit/summary
GET    /api/audit/entry-point
GET    /api/audit/entry-point-logs
GET    /api/audit/recent-scans
GET    /api/audit/employee-activity
```

#### Transactions
```
POST   /api/transactions/process-atomic
```

#### Session
```
POST   /api/session/create
GET    /api/session/status
POST   /api/session/vaporize
```

#### Modes (Ghost Pass Modes)
```
POST   /api/modes/check-context
POST   /api/modes/process-scan
POST   /api/modes/purchase-pass
```

#### Scan
```
POST   /api/scan/validate
```

#### Senate (Evaluation System)
```
GET    /api/senate/history
GET    /api/senate/stats
```

#### Sensory (Monitoring)
```
GET    /api/sensory/audit-log
GET    /api/sensory/signals
GET    /api/sensory/stats
```

---

## Database Schema Summary

### Total Tables: 60+ (Verified via Supabase)

**IMPORTANT NOTE - ACTUAL DATABASE TABLES**:
The database contains BOTH old and new table structures:
- `transactions` table (98,752 rows) - Main transaction table
- `venue_transaction_ledger` table (0 rows) - New ledger structure (not yet used)
- `entry_logs` table (0 rows, RLS enabled) - New entry logging
- `entry_events` table (48,518 rows) - Current entry tracking
- `entry_tracking` table (0 rows) - Alternative entry tracking
- `gateway_points` table (9 rows) - Current gateway table
- `wallet_sessions` table (43 rows) - Session management

**Active Tables** (with data):
- users (7 rows)
- wallets (5,156 rows)
- ghost_passes (37 rows)
- transactions (98,752 rows)
- entry_events (48,518 rows)
- interactions (17,692 rows)
- gateway_points (9 rows)
- wallet_sessions (43 rows)
- events (4 rows)
- venues (5 rows)

### Core Tables (10)
1. users
2. wallets
3. ghost_passes
4. venues
5. events
6. transactions (or transaction_ledger)
7. entry_tracking (or entry_logs)
8. revenue_profiles
9. tax_profiles
10. payout_routing

#### Configuration Tables (5)
11. stations
12. qr_nfc_assets
13. menu_items
14. context_configs
15. system_configs

#### Audit & Logging (5)
16. audit_logs
17. id_verification_logs
18. entry_point_audit_logs
19. employee_activity_logs
20. interactions

#### Payment & Payout (3)
21. payout_requests
22. fee_configs
23. wallet_recovery_proofs

#### Tickets & Events (3)
24. event_tickets
25. ticket_types
26. ticket_purchases

#### Gateway & Metrics (3)
27. gateways (or gateway_points)
28. gateway_metrics
29. gateway_events

#### Notifications (2)
30. push_subscriptions
31. notification_logs

#### SSO & Sessions (3)
32. sso_tokens
33. sessions
34. biometric_challenges

---

## Conclusion

GhostPass is a comprehensive, serverless, multi-tenant SaaS platform for venue access management. The architecture prioritizes:

- **Scalability**: Serverless functions + managed database
- **Security**: Device binding, RLS, audit logging, PCI compliance
- **Flexibility**: Multi-mode access, asset-level configuration
- **Performance**: Connection pooling, atomic transactions, indexes
- **Compliance**: GDPR/CCPA (no raw ID storage), tax calculation
- **User Experience**: Anonymous-first, mobile-optimized, real-time updates

The system handles complex business logic including:
- Anonymous wallet creation with device fingerprinting
- Multi-level revenue distribution (5-way splits)
- Tax calculation before revenue split
- Re-entry fee logic
- Identity verification integration
- Payment processing with Stripe
- Real-time push notifications
- Comprehensive audit trails

This architecture supports rapid scaling from single venue to multi-venue network while maintaining data isolation, security, and performance.

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-26  
**Maintained By**: GhostPass Engineering Team
