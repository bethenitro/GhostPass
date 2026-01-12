#!/usr/bin/env python3
"""
Test the complete wallet -> ghostpass flow
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_flow():
    """Test the complete flow: login -> fund wallet -> purchase pass -> check status"""
    
    # Step 1: Login (you'll need to replace with real credentials)
    print("🔐 Step 1: Login")
    login_data = {
        "email": "test@example.com",  # Replace with your test user
        "password": "testpassword123"  # Replace with your test password
    }
    
    try:
        login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Step 2: Check wallet balance
    print("\n💰 Step 2: Check wallet balance")
    try:
        balance_response = requests.get(f"{BASE_URL}/wallet/balance", headers=headers)
        if balance_response.status_code == 200:
            balance = balance_response.json()
            print(f"✅ Current balance: ${balance['balance_dollars']:.2f}")
        else:
            print(f"⚠️ Balance check failed: {balance_response.status_code}")
    except Exception as e:
        print(f"❌ Balance check error: {e}")
    
    # Step 3: Fund wallet
    print("\n💳 Step 3: Fund wallet")
    fund_data = {
        "source": "stripe",
        "amount": 25.00  # $25 to cover a 7-day pass ($50)
    }
    
    try:
        fund_response = requests.post(f"{BASE_URL}/wallet/fund", json=fund_data, headers=headers)
        if fund_response.status_code == 200:
            result = fund_response.json()
            print(f"✅ Wallet funded: ${result['amount_dollars']:.2f}")
        else:
            print(f"❌ Funding failed: {fund_response.status_code} - {fund_response.text}")
            return
    except Exception as e:
        print(f"❌ Funding error: {e}")
        return
    
    # Step 4: Purchase pass
    print("\n🎫 Step 4: Purchase GhostPass")
    purchase_data = {
        "duration": 1  # 1 day pass ($10)
    }
    
    try:
        purchase_response = requests.post(f"{BASE_URL}/ghostpass/purchase", json=purchase_data, headers=headers)
        if purchase_response.status_code == 200:
            result = purchase_response.json()
            print(f"✅ Pass purchased: {result['pass_id']}")
            print(f"   Expires: {result['expires_at']}")
            print(f"   Cost: ${result['amount_charged_cents']/100:.2f}")
        else:
            print(f"❌ Purchase failed: {purchase_response.status_code} - {purchase_response.text}")
            return
    except Exception as e:
        print(f"❌ Purchase error: {e}")
        return
    
    # Step 5: Check pass status
    print("\n📋 Step 5: Check pass status")
    try:
        status_response = requests.get(f"{BASE_URL}/ghostpass/status", headers=headers)
        if status_response.status_code == 200:
            pass_info = status_response.json()
            print(f"✅ Active pass found: {pass_info['id']}")
            print(f"   Status: {pass_info['status']}")
            print(f"   Expires: {pass_info['expires_at']}")
        else:
            print(f"❌ Status check failed: {status_response.status_code} - {status_response.text}")
    except Exception as e:
        print(f"❌ Status check error: {e}")
    
    print("\n🎉 Flow test complete!")

if __name__ == "__main__":
    print("🧪 Testing GhostPass wallet flow...")
    print("📝 Make sure you have:")
    print("   1. FastAPI server running on localhost:8000")
    print("   2. Valid test user credentials")
    print("   3. Database schema and functions created")
    print()
    test_flow()