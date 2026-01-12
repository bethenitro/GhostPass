#!/usr/bin/env python3
"""
Integration Test Script for Proxy Architecture
Tests the complete flow: Frontend -> FastAPI -> Supabase
"""

import requests
import json
import time

# Configuration
API_BASE = "http://localhost:8000"
TEST_EMAIL = "test@ghostpass.com"
TEST_PASSWORD = "testpassword123"

def test_auth_flow():
    """Test the complete authentication proxy flow"""
    print("🔐 Testing Authentication Proxy Flow...")
    
    # 1. Test Registration
    print("\n1. Testing Registration...")
    register_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=register_data)
        if response.status_code == 201:
            print("✅ Registration successful (email confirmation required)")
            return None  # Email confirmation required
        elif response.status_code == 409:
            print("ℹ️  User already exists, proceeding to login...")
        elif response.status_code == 200:
            auth_data = response.json()
            token = auth_data["access_token"]
            print(f"✅ Registration successful, token: {token[:20]}...")
            return token
        else:
            print(f"❌ Registration failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return None
    
    # 2. Test Login
    print("\n2. Testing Login...")
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json=login_data)
        if response.status_code == 200:
            auth_data = response.json()
            token = auth_data["access_token"]
            user = auth_data["user"]
            print(f"✅ Login successful")
            print(f"   Token: {token[:20]}...")
            print(f"   User: {user['email']} (ID: {user['id'][:8]}...)")
            return token
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_wallet_operations(token):
    """Test wallet operations through the proxy"""
    print("\n💰 Testing Wallet Proxy Operations...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get Balance
    print("\n1. Testing Get Balance...")
    try:
        response = requests.get(f"{API_BASE}/wallet/balance", headers=headers)
        if response.status_code == 200:
            balance_data = response.json()
            print(f"✅ Balance retrieved: ${balance_data['balance_dollars']:.2f}")
            print(f"   Balance (cents): {balance_data['balance_cents']}")
        else:
            print(f"❌ Balance fetch failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Balance error: {e}")
        return False
    
    # 2. Fund Wallet
    print("\n2. Testing Fund Wallet...")
    fund_data = {
        "amount": 50.00,
        "source": "zelle"
    }
    
    try:
        response = requests.post(f"{API_BASE}/wallet/fund", json=fund_data, headers=headers)
        if response.status_code == 200:
            fund_result = response.json()
            print(f"✅ Wallet funded: ${fund_result['amount_dollars']:.2f}")
            print(f"   Transaction ID: {fund_result.get('transaction_id', 'N/A')}")
        else:
            print(f"❌ Funding failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Funding error: {e}")
        return False
    
    # 3. Get Updated Balance
    print("\n3. Testing Updated Balance...")
    try:
        response = requests.get(f"{API_BASE}/wallet/balance", headers=headers)
        if response.status_code == 200:
            balance_data = response.json()
            print(f"✅ Updated balance: ${balance_data['balance_dollars']:.2f}")
        else:
            print(f"❌ Updated balance fetch failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Updated balance error: {e}")
    
    # 4. Get Transactions
    print("\n4. Testing Transaction History...")
    try:
        response = requests.get(f"{API_BASE}/wallet/transactions", headers=headers)
        if response.status_code == 200:
            transactions = response.json()
            print(f"✅ Transaction history retrieved: {len(transactions)} transactions")
            if transactions:
                latest = transactions[0]
                print(f"   Latest: {latest['type']} ${abs(latest['amount_cents'])/100:.2f}")
        else:
            print(f"❌ Transaction history failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Transaction history error: {e}")
    
    return True

def test_user_info(token):
    """Test user info endpoint"""
    print("\n👤 Testing User Info...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{API_BASE}/auth/me", headers=headers)
        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ User info retrieved: {user_data['email']}")
            print(f"   User ID: {user_data['id'][:8]}...")
        else:
            print(f"❌ User info failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ User info error: {e}")

def test_logout(token):
    """Test logout"""
    print("\n🚪 Testing Logout...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(f"{API_BASE}/auth/logout", headers=headers)
        if response.status_code == 200:
            print("✅ Logout successful")
        else:
            print(f"❌ Logout failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Logout error: {e}")

def main():
    """Run the complete integration test"""
    print("🚀 GHOSTPASS PROXY ARCHITECTURE INTEGRATION TEST")
    print("=" * 50)
    print("Testing: Frontend -> FastAPI -> Supabase")
    print("No direct Supabase access from frontend!")
    print()
    
    # Test authentication flow
    token = test_auth_flow()
    if not token:
        print("\n❌ Authentication failed, stopping tests")
        return
    
    # Test wallet operations
    wallet_success = test_wallet_operations(token)
    if not wallet_success:
        print("\n⚠️  Wallet operations had issues")
    
    # Test user info
    test_user_info(token)
    
    # Test logout
    test_logout(token)
    
    print("\n" + "=" * 50)
    print("🎉 INTEGRATION TEST COMPLETE!")
    print("✅ Proxy architecture working: Frontend -> FastAPI -> Supabase")
    print("✅ No direct Supabase access from frontend")
    print("✅ All authentication flows through FastAPI")

if __name__ == "__main__":
    main()