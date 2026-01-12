#!/usr/bin/env python3
"""
Admin Setup Script for GhostPass Wallet
Initializes admin tables and creates the first admin user.
"""

import os
import sys
from supabase import create_client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
    sys.exit(1)

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def setup_admin_tables():
    """Execute the admin-related SQL schema step by step"""
    print("🔧 Setting up admin tables...")
    
    try:
        # We'll use direct SQL execution through Supabase
        # First, let's check if we can add the role column directly
        print("   Adding role column to users table...")
        
        # Try to add the role column using a simple approach
        # Since we can't execute arbitrary SQL, we'll use the table API to check structure
        
        # Check current users table structure
        users_result = supabase.table("users").select("*").limit(1).execute()
        
        if users_result.data and len(users_result.data) > 0:
            user_sample = users_result.data[0]
            if 'role' not in user_sample:
                print("   ❌ Role column missing. Please add it manually in Supabase dashboard.")
                print("   📋 Manual steps required:")
                print("   1. Go to Supabase Dashboard > Table Editor > users table")
                print("   2. Add a new column:")
                print("      - Name: role")
                print("      - Type: text")
                print("      - Default value: USER")
                print("      - Not null: checked")
                print("   3. Run this script again")
                return False
            else:
                print("   ✓ Role column already exists")
        
        # Try to create other tables using table operations
        print("   Creating admin tables...")
        
        # We can't create tables directly through the Python client
        # Let's provide SQL that the user can run manually
        print("   ❌ Cannot create tables automatically.")
        print("   📋 Please run this SQL in Supabase SQL Editor:")
        
        sql_to_run = """
-- 1. Create user_role enum
CREATE TYPE user_role AS ENUM ('USER', 'VENDOR', 'ADMIN');

-- 2. Add role column to users table (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'USER';

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Create system_configs table
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor_user_id ON payout_requests(vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- 7. Create get_total_balance function
CREATE OR REPLACE FUNCTION get_total_balance() RETURNS INTEGER AS $$
DECLARE
    v_total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_total_balance FROM wallets;
    RETURN v_total_balance;
END;
$$ LANGUAGE plpgsql;

-- 8. Insert default configurations
INSERT INTO system_configs (config_key, config_value) VALUES
('ghostpass_pricing', '{"1": 1000, "3": 2000, "7": 5000}'),
('scan_fees', '{"default": 10}'),
('data_retention', '{"retention_days": 60}')
ON CONFLICT (config_key) DO NOTHING;
"""
        
        print(sql_to_run)
        print("\n   After running the SQL, press Enter to continue...")
        input()
        
        print("✅ Assuming SQL was executed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error in setup: {e}")
        return False

def create_admin_user(email: str):
    """Create the first admin user"""
    print(f"👤 Creating admin user: {email}")
    
    try:
        # Check if user already exists
        existing_user = supabase.table("users").select("*").eq("email", email).execute()
        
        if existing_user.data:
            user_id = existing_user.data[0]["id"]
            current_role = existing_user.data[0].get("role", "USER")
            
            if current_role == "ADMIN":
                print(f"✅ User {email} is already an ADMIN")
                return user_id
            
            print(f"📧 User {email} exists with role '{current_role}', updating to ADMIN")
            
            # Update role to ADMIN
            try:
                result = supabase.table("users").update({"role": "ADMIN"}).eq("id", user_id).execute()
                if result.data:
                    print(f"✅ User {email} is now an ADMIN")
                    return user_id
                else:
                    print(f"❌ Failed to update user role. Result: {result}")
                    return None
            except Exception as e:
                print(f"❌ Error updating user role: {e}")
                print("💡 This might be because the role column doesn't exist yet.")
                print("   Please run the SQL schema first in Supabase dashboard.")
                return None
        else:
            print(f"❌ User {email} not found. Please register this user first through the app, then run this script again.")
            return None
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return None

def main():
    print("🚀 GhostPass Admin Setup")
    print("=" * 40)
    
    print("📋 IMPORTANT: This script requires manual SQL execution.")
    print("Please follow these steps:")
    print()
    print("1. 📄 Copy the SQL from 'admin_schema.sql' file")
    print("2. 🌐 Go to Supabase Dashboard > SQL Editor")
    print("3. 📝 Paste and run the SQL")
    print("4. ✅ Come back here and press Enter")
    print()
    
    input("Press Enter after running the SQL in Supabase Dashboard...")
    
    # Get admin email from user
    admin_email = input("\n📧 Enter admin email address: ").strip()
    
    if not admin_email:
        print("❌ Email address is required")
        sys.exit(1)
    
    # Create admin user
    admin_id = create_admin_user(admin_email)
    
    if admin_id:
        print("\n🎉 Admin setup completed successfully!")
        print(f"👤 Admin user: {admin_email}")
        print("\n📋 Next steps:")
        print("1. Start the backend server: python -m uvicorn main:app --reload")
        print("2. Login with the admin email in the frontend")
        print("3. Look for the 'ADMIN MODE' toggle in the sidebar")
        print("4. Click it to access the Command Center")
    else:
        print("\n❌ Admin setup failed")
        print("💡 Try using setup_admin_simple.py instead")
        sys.exit(1)

if __name__ == "__main__":
    main()