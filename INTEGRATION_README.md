# 🔐 GHOSTPASS PROXY ARCHITECTURE INTEGRATION

## Overview
This integration implements a **proxy architecture** where the React frontend **never directly accesses Supabase**. FastAPI acts as the sole gatekeeper, providing security and control over all database operations.

## Architecture Flow
```
Frontend (React) → FastAPI (Proxy) → Supabase (Database)
```

### Key Principles
- ✅ Frontend only knows about `http://localhost:8000` (FastAPI)
- ✅ All authentication flows through FastAPI
- ✅ Supabase credentials are **only** in backend `.env`
- ✅ JWT tokens are managed by FastAPI proxy
- ✅ Zero Supabase SDK in frontend

## Environment Configuration

### Frontend (.env)
```bash
# PROXY ARCHITECTURE - Only FastAPI URL needed
VITE_API_URL=http://localhost:8000
```

### Backend (.env)
```bash
# Supabase Configuration (Backend Only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key
```

## Authentication Flow

### 1. Login Process
```
1. User enters email/password in React form
2. React calls POST /auth/login to FastAPI
3. FastAPI calls supabase.auth.sign_in_with_password()
4. FastAPI returns JWT token to React
5. React stores token in localStorage
6. All future requests include Authorization: Bearer <token>
```

### 2. Protected Routes
```
1. React sends request with Authorization header
2. FastAPI middleware validates JWT with Supabase
3. FastAPI extracts user info and proceeds with request
4. FastAPI queries Supabase using service key
5. FastAPI returns data to React
```

## API Endpoints

### Authentication (Proxy)
- `POST /auth/login` - Login through FastAPI proxy
- `POST /auth/register` - Register through FastAPI proxy
- `POST /auth/logout` - Logout through FastAPI proxy
- `GET /auth/me` - Get current user info

### Wallet Operations (Proxy)
- `GET /wallet/balance` - Get wallet balance
- `POST /wallet/fund` - Fund wallet
- `GET /wallet/transactions` - Get transaction history

### GhostPass Operations (Proxy)
- `GET /ghostpass/passes` - Get user passes
- `POST /ghostpass/purchase` - Purchase new pass

## Security Benefits

1. **Zero Exposure**: Frontend never sees Supabase URLs or keys
2. **Centralized Auth**: All authentication logic in one place
3. **Rate Limiting**: Can implement rate limiting at FastAPI level
4. **Audit Trail**: All requests logged through FastAPI
5. **Validation**: Server-side validation of all requests
6. **Secrets Management**: Supabase credentials only in backend

## Testing the Integration

### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Run Integration Test
```bash
python test_integration.py
```

## File Changes Summary

### Backend Changes
- ✅ Added `routes/auth.py` - Authentication proxy
- ✅ Updated `main.py` - Include auth router
- ✅ Updated `routes/wallet.py` - Use new auth dependency
- ✅ Updated `routes/ghostpass.py` - Use new auth dependency
- ✅ Updated `routes/vendor.py` - Use new auth dependency
- ✅ Added JWT dependencies to `requirements.txt`

### Frontend Changes
- ✅ Updated `.env` - Removed Supabase URLs
- ✅ Updated `src/lib/api.ts` - Proxy-only API calls
- ✅ Updated `src/types/index.ts` - Match backend models
- ✅ No Supabase SDK dependencies

## Verification Checklist

- [ ] Frontend `.env` has no Supabase URLs
- [ ] Backend handles all Supabase communication
- [ ] Authentication works through FastAPI proxy
- [ ] Wallet operations work through proxy
- [ ] JWT tokens are properly validated
- [ ] Error handling works correctly
- [ ] Integration test passes

## Production Considerations

1. **JWT Secret**: Use a strong, unique JWT secret
2. **CORS**: Configure CORS properly for production domains
3. **Rate Limiting**: Implement rate limiting on auth endpoints
4. **Logging**: Add comprehensive logging for audit trails
5. **Error Handling**: Implement proper error responses
6. **Health Checks**: Monitor FastAPI health endpoints

## Troubleshooting

### Common Issues
1. **401 Unauthorized**: Check JWT token format and validity
2. **CORS Errors**: Verify CORS configuration in FastAPI
3. **Connection Errors**: Ensure backend is running on port 8000
4. **Supabase Errors**: Check Supabase credentials in backend `.env`

### Debug Steps
1. Check browser network tab for API calls
2. Verify JWT token in localStorage
3. Check FastAPI logs for errors
4. Test endpoints with curl/Postman
5. Run integration test script

## Success Metrics
- ✅ Zero Supabase imports in frontend code
- ✅ All API calls go to `localhost:8000`
- ✅ Authentication works end-to-end
- ✅ Wallet operations function correctly
- ✅ Error handling is graceful
- ✅ Integration test passes completely