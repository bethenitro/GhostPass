#!/usr/bin/env python3
"""
Test script for GhostPass Admin functionality
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

def test_admin_endpoints():
    """Test admin endpoints with a valid admin token"""
    
    print("🧪 Testing GhostPass Admin API")
    print("=" * 40)
    
    # You'll need to get a valid admin token first
    admin_token = input("Enter admin JWT token (login as admin first): ").strip()
    
    if not admin_token:
        print("❌ Admin token is required")
        return
    
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    # Test 1: Get admin dashboard
    print("\n1. Testing admin dashboard...")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/dashboard", headers=headers)
        if response.status_code == 200:
            print("✅ Dashboard loaded successfully")
            data = response.json()
            print(f"   Total users: {data['stats']['total_users']}")
            print(f"   Total balance: ${data['stats']['total_balance_cents'] / 100:.2f}")
        else:
            print(f"❌ Dashboard failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Dashboard error: {e}")
    
    # Test 2: Update fee configuration
    print("\n2. Testing fee configuration update...")
    try:
        fee_config = {
            "valid_pct": 25.0,
            "vendor_pct": 35.0,
            "pool_pct": 30.0,
            "promoter_pct": 10.0
        }
        response = requests.post(f"{API_BASE_URL}/admin/fees/config", 
                               headers=headers, json=fee_config)
        if response.status_code == 200:
            print("✅ Fee configuration updated successfully")
        else:
            print(f"❌ Fee config failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Fee config error: {e}")
    
    # Test 3: Update GhostPass pricing
    print("\n3. Testing GhostPass pricing update...")
    try:
        pricing = {
            "one_day_cents": 1200,
            "three_day_cents": 2500,
            "seven_day_cents": 5500
        }
        response = requests.post(f"{API_BASE_URL}/admin/pricing/ghostpass", 
                               headers=headers, json=pricing)
        if response.status_code == 200:
            print("✅ GhostPass pricing updated successfully")
        else:
            print(f"❌ Pricing update failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Pricing update error: {e}")
    
    # Test 4: Get audit logs
    print("\n4. Testing audit logs...")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/audit-logs?limit=5", headers=headers)
        if response.status_code == 200:
            print("✅ Audit logs retrieved successfully")
            logs = response.json()
            print(f"   Retrieved {len(logs)} audit log entries")
        else:
            print(f"❌ Audit logs failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Audit logs error: {e}")
    
    # Test 5: Get users
    print("\n5. Testing user management...")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/users?limit=10", headers=headers)
        if response.status_code == 200:
            print("✅ User list retrieved successfully")
            users = response.json()
            print(f"   Retrieved {len(users)} users")
        else:
            print(f"❌ User list failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ User list error: {e}")
    
    print("\n🎉 Admin API testing completed!")

if __name__ == "__main__":
    test_admin_endpoints()