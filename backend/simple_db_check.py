#!/usr/bin/env python3
"""
Simple check to see what's in the database
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def main():
    # Get Supabase client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file")
        return
    
    db = create_client(url, key)
    print("✅ Connected to Supabase")
    
    # Test known tables
    tables = ['users', 'wallets', 'transactions', 'ghost_passes', 'sessions']
    
    for table in tables:
        try:
            result = db.table(table).select('*').limit(1).execute()
            if result.data:
                columns = list(result.data[0].keys())
                print(f"✅ {table}: {len(columns)} columns - {columns}")
            else:
                print(f"✅ {table}: exists but empty")
        except Exception as e:
            print(f"❌ {table}: {str(e)}")
    
    # Specifically check transactions table
    print(f"\n🎯 DETAILED TRANSACTIONS TABLE CHECK:")
    try:
        result = db.table('transactions').select('*').limit(1).execute()
        if result.data:
            print(f"Sample record: {result.data[0]}")
        else:
            print("Table exists but is empty")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()