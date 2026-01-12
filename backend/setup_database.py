#!/usr/bin/env python3
"""
Database setup script for GhostPass Wallet API
Run this script to initialize sample data (after creating schema manually)
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def setup_database():
    """Initialize sample data using REST API"""
    print("🚀 Setting up GhostPass database...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file")
        return
    
    # Headers for Supabase REST API
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Sample fee configurations
    sample_fee_configs = [
        {
            "venue_id": "venue_001",
            "valid_pct": 70.0,
            "vendor_pct": 15.0,
            "pool_pct": 10.0,
            "promoter_pct": 5.0
        },
        {
            "venue_id": "venue_002", 
            "valid_pct": 65.0,
            "vendor_pct": 20.0,
            "pool_pct": 10.0,
            "promoter_pct": 5.0
        },
        {
            "venue_id": "demo_venue",
            "valid_pct": 75.0,
            "vendor_pct": 12.0,
            "pool_pct": 8.0,
            "promoter_pct": 5.0
        }
    ]
    
    try:
        # Insert fee configs using REST API
        for config in sample_fee_configs:
            url = f"{SUPABASE_URL}/rest/v1/fee_configs"
            
            # Try to insert, ignore if already exists
            response = requests.post(url, headers=headers, json=config)
            
            if response.status_code in [200, 201]:
                print(f"✅ Inserted config for {config['venue_id']}")
            elif response.status_code == 409:
                print(f"ℹ️  Config for {config['venue_id']} already exists")
            else:
                print(f"⚠️  Failed to insert {config['venue_id']}: {response.status_code}")
        
        print("\n✅ Database setup completed!")
        print("\n📋 Next steps:")
        print("1. API is running at: http://localhost:8000")
        print("2. API docs at: http://localhost:8000/docs")
        print("3. Test endpoints with authentication tokens")
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure you've created the database schema in Supabase SQL Editor")
        print("2. Check that SUPABASE_KEY is the service role key (not anon key)")
        print("3. Verify SUPABASE_URL is correct")

if __name__ == "__main__":
    setup_database()