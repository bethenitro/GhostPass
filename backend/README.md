# GhostPass Wallet API

A secure, conduit-style wallet API built with FastAPI, Supabase, and Pydantic. This system handles digital wallet operations, GhostPass purchases, QR code validation, and vendor payouts with atomic transactions and comprehensive audit trails.

## 🏗️ Architecture

- **Backend**: Python FastAPI with async/await
- **Database**: Supabase (PostgreSQL + Auth)
- **Validation**: Pydantic models
- **Security**: Bearer token authentication
- **Design**: Vault-less architecture (no credit card storage)

## 📋 Features

### Core Wallet Operations
- ✅ Real-time balance calculation (Source of Truth)
- ✅ Atomic funding via Zelle/Stripe (mock)
- ✅ Transaction history with pagination
- ✅ Comprehensive audit logging

### GhostPass System
- ✅ Pass purchase (1/3/7 day durations)
- ✅ Automatic expiration handling
- ✅ Balance validation before purchase
- ✅ Pass status tracking

### QR Scanning & Fees
- ✅ Pass validation with expiration checks
- ✅ Configurable fee splits per venue
- ✅ Atomic fee distribution logging
- ✅ Venue statistics

### Vendor Payouts
- ✅ Earnings calculation from fee splits
- ✅ Mock FBO (For Benefit Of) transfers
- ✅ Payout request validation
- ✅ Earnings dashboard data

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone and setup
git clone <repository>
cd ghostpass-wallet-api

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Database Setup

**Run this SQL in your Supabase SQL Editor:**

```sql
-- Copy the entire SCHEMA_SQL from database.py
-- This creates all tables, functions, and triggers
```

**Then initialize sample data:**

```bash
python setup_database.py
```

### 3. Run the API

```bash
# Development server
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Test the API

```bash
# Basic health check
python test_api.py

# Or use curl
curl http://localhost:8000/health
```

## 📊 Database Schema

### Tables

- **users** - User accounts (extends Supabase Auth)
- **wallets** - User wallet balances (cents for precision)
- **transactions** - All financial operations (FUND/SPEND/FEE)
- **ghost_passes** - Digital passes with expiration
- **fee_configs** - Venue-specific fee split configurations

### Key Functions

- `fund_wallet()` - Atomic balance increment + transaction log
- `purchase_pass()` - Atomic balance check, deduction, pass creation
- `update_expired_passes()` - Batch expiration status updates

## 🔐 API Endpoints

### Authentication
```http
POST /wallet/auth/session
Authorization: Bearer <supabase-token>
```

### Wallet Operations
```http
GET /wallet/balance
POST /wallet/fund
GET /wallet/transactions
```

### GhostPass Management
```http
POST /ghostpass/purchase
GET /ghostpass/passes
GET /ghostpass/passes/{pass_id}
```

### QR Scanning
```http
POST /scan/validate
GET /scan/venue/{venue_id}/stats
```

### Vendor Payouts
```http
POST /vendor/payout/request
GET /vendor/earnings
```

## 💰 Pricing Structure

| Duration | Price |
|----------|-------|
| 1 Day    | $10.00 |
| 3 Days   | $20.00 |
| 7 Days   | $50.00 |

## 🔒 Security Features

- **Bearer Token Authentication** - All endpoints require valid Supabase tokens
- **Input Validation** - Pydantic models prevent invalid data
- **Atomic Transactions** - Database functions ensure ACID compliance
- **Audit Trail** - Every financial operation logged
- **Balance Validation** - Prevents negative balances and overspending

## 🧪 Testing

### Manual Testing with curl

```bash
# Health check
curl http://localhost:8000/health

# Session verification (requires valid token)
curl -X POST http://localhost:8000/wallet/auth/session \
  -H "Content-Type: application/json" \
  -d '{"token": "your-supabase-jwt-token"}'

# Fund wallet
curl -X POST http://localhost:8000/wallet/fund \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"source": "stripe", "amount": 50.00}'

# Purchase pass
curl -X POST http://localhost:8000/ghostpass/purchase \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"duration": 7}'
```

## 📈 Monitoring

The API includes built-in logging and health check endpoints:

- `GET /health` - System health status
- `GET /scan/venue/{venue_id}/stats` - Venue scanning statistics
- `GET /vendor/earnings` - Vendor earnings dashboard

## 🔧 Configuration

### Environment Variables (.env)
```
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key
```

### Fee Configuration
Fee splits are configurable per venue in the `fee_configs` table:
- **valid_pct** - Percentage to validation service
- **vendor_pct** - Percentage to venue/vendor
- **pool_pct** - Percentage to shared pool
- **promoter_pct** - Percentage to promoter

## 🚨 Production Considerations

1. **Replace Mock Integrations**:
   - Implement real Stripe/Zelle webhooks
   - Add actual banking API for payouts
   - Implement proper scanner authentication

2. **Security Enhancements**:
   - Rate limiting
   - Request validation middleware
   - Encrypted sensitive data storage

3. **Monitoring & Observability**:
   - Structured logging
   - Metrics collection
   - Error tracking
   - Performance monitoring

4. **Scalability**:
   - Database connection pooling
   - Caching layer (Redis)
   - Load balancing
   - Background job processing

## 📝 License

This project is proprietary software for GhostPass systems.