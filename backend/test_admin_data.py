#!/usr/bin/env python3
"""
Test script to verify admin data persistence
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("Missing Supabase credentials in .env file")
    
    return create_client(url, key)

def test_admin_data():
    """Test admin data persistence"""
    print("🔍 Testing Admin Data Persistence")
    print("=" * 50)
    
    db = get_supabase_client()
    
    # 1. Check fee_configs table
    print("\n1. Checking fee_configs table...")
    try:
        result = db.table("fee_configs").select("*").execute()
        print(f"   Found {len(result.data)} fee configs:")
        for config in result.data:
            print(f"   - {config['venue_id']}: {config['valid_pct']}%/{config['vendor_pct']}%/{config['pool_pct']}%/{config['promoter_pct']}%")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 2. Check system_configs table
    print("\n2. Checking system_configs table...")
    try:
        result = db.table("system_configs").select("*").execute()
        print(f"   Found {len(result.data)} system configs:")
        for config in result.data:
            print(f"   - {config['config_key']}: {config['config_value']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 3. Insert default fee config if missing
    print("\n3. Ensuring default fee config exists...")
    try:
        # Check if default fee config exists
        result = db.table("fee_configs").select("*").eq("venue_id", "default").execute()
        
        if not result.data:
            print("   📝 Inserting default fee config...")
            db.table("fee_configs").insert({
                "venue_id": "default",
                "valid_pct": 30.0,
                "vendor_pct": 30.0,
                "pool_pct": 30.0,
                "promoter_pct": 10.0
            }).execute()
            print("   ✅ Default fee config inserted")
        else:
            print("   ✅ Default fee config already exists")
    except Exception as e:
        print(f"   ❌ Error inserting default fee config: {e}")
    
    # 4. Insert default system configs if missing
    print("\n4. Ensuring default system configs exist...")
    
    default_configs = [
        ("ghostpass_pricing", {"1": 1000, "3": 2000, "7": 5000}),
        ("scan_fees", {"default": 10}),
        ("data_retention", {"retention_days": 60})
    ]
    
    for config_key, config_value in default_configs:
        try:
            result = db.table("system_configs").select("*").eq("config_key", config_key).execute()
            
            if not result.data:
                print(f"   📝 Inserting {config_key}...")
                db.table("system_configs").insert({
                    "config_key": config_key,
                    "config_value": config_value
                }).execute()
                print(f"   ✅ {config_key} inserted")
            else:
                print(f"   ✅ {config_key} already exists")
        except Exception as e:
            print(f"   ❌ Error with {config_key}: {e}")
    
    # 5. Test updating fee config
    print("\n5. Testing fee config update...")
    try:
        result = db.table("fee_configs").upsert({
            "venue_id": "default",
            "valid_pct": 35.0,
            "vendor_pct": 35.0,
            "pool_pct": 25.0,
            "promoter_pct": 5.0
        }, on_conflict="venue_id").execute()
        print("   ✅ Fee config update successful")
        
        # Verify the update
        result = db.table("fee_configs").select("*").eq("venue_id", "default").execute()
        if result.data:
            config = result.data[0]
            print(f"   📊 Updated config: {config['valid_pct']}%/{config['vendor_pct']}%/{config['pool_pct']}%/{config['promoter_pct']}%")
        
    except Exception as e:
        print(f"   ❌ Error updating fee config: {e}")
    
    # 6. Test updating system config
    print("\n6. Testing system config update...")
    try:
        result = db.table("system_configs").upsert({
            "config_key": "ghostpass_pricing",
            "config_value": {"1": 1200, "3": 2400, "7": 6000}
        }, on_conflict="config_key").execute()
        print("   ✅ System config update successful")
        
        # Verify the update
        result = db.table("system_configs").select("*").eq("config_key", "ghostpass_pricing").execute()
        if result.data:
            config = result.data[0]
            print(f"   📊 Updated pricing: {config['config_value']}")
        
    except Exception as e:
        print(f"   ❌ Error updating system config: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Admin data persistence test complete!")

if __name__ == "__main__":
    test_admin_data()