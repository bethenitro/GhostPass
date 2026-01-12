#!/usr/bin/env python3
"""
Check and setup database functions for GhostPass
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def check_database():
    """Check if required database functions exist"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file")
        return
    
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # Test if purchase_pass function exists by calling it with invalid data
        # This should fail with a specific error if the function exists
        result = client.rpc("purchase_pass", {
            "p_user_id": "00000000-0000-0000-0000-000000000000",
            "p_amount": 1000,
            "p_duration_days": 1
        }).execute()
        
        print("✅ purchase_pass function exists")
        
    except Exception as e:
        error_msg = str(e).lower()
        if "function purchase_pass" in error_msg and "does not exist" in error_msg:
            print("❌ purchase_pass function does not exist")
            print("📋 You need to run the SQL schema from database.py in your Supabase SQL Editor")
            print("\n🔧 Steps to fix:")
            print("1. Go to your Supabase dashboard")
            print("2. Open the SQL Editor")
            print("3. Copy and paste the SCHEMA_SQL from backend/database.py")
            print("4. Run the SQL to create tables and functions")
        elif "wallet not found" in error_msg or "insufficient balance" in error_msg:
            print("✅ purchase_pass function exists (expected error for test data)")
        else:
            print(f"⚠️ Unexpected error: {e}")
    
    # Test basic table access
    try:
        result = client.table("wallets").select("count", count="exact").execute()
        print(f"✅ wallets table exists (count: {result.count})")
    except Exception as e:
        print(f"❌ wallets table issue: {e}")
    
    try:
        result = client.table("ghost_passes").select("count", count="exact").execute()
        print(f"✅ ghost_passes table exists (count: {result.count})")
    except Exception as e:
        print(f"❌ ghost_passes table issue: {e}")

if __name__ == "__main__":
    check_database()