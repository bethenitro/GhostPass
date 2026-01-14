# GhostPass Session SQL Setup

Run these SQL commands in your Supabase SQL Editor:

## 1. Create Sessions Table

```sql
-- Create sessions table for GHOSTPASS SESSION feature
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL CHECK (session_type IN ('30_seconds', '3_minutes', '10_minutes')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VAPORIZED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vaporizes_at TIMESTAMP WITH TIME ZONE NOT NULL,
    venue_id TEXT,
    qr_code TEXT UNIQUE
);
```

## 2. Create Indexes

```sql
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_vaporizes_at ON sessions(vaporizes_at);
```

## 3. Create Vaporization Function

```sql
-- Create vaporize_expired_sessions function
CREATE OR REPLACE FUNCTION vaporize_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    v_vaporized_count INTEGER;
BEGIN
    UPDATE sessions 
    SET status = 'VAPORIZED' 
    WHERE status = 'ACTIVE' 
    AND vaporizes_at < NOW();
    
    GET DIAGNOSTICS v_vaporized_count = ROW_COUNT;
    RETURN v_vaporized_count;
END;
$$ LANGUAGE plpgsql;
```

## Testing

After running the SQL, test with:

```sql
-- Check if table exists
SELECT * FROM sessions LIMIT 1;

-- Test vaporization function
SELECT vaporize_expired_sessions();
```

## Notes

- Sessions automatically vaporize when `vaporizes_at` timestamp passes
- `vaporize_expired_sessions()` function is called by backend on each scan and status check
- QR codes are unique per session (format: `ghostsession:{session_id}`)
- No reuse or extension possible - enforced by database constraints
