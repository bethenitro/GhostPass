#!/usr/bin/env python3
"""
Test wallet funding with different request formats
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_fund_requests():
    """Test different fund request formats to see what works"""
    
    # You'll need to get a valid token first
    print("🔐 First, login to get a token:")
    print("POST /auth/login with your credentials")
    print()
    
    token = input("Enter your access token: ").strip()
    if not token:
        print("❌ No token provided")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test different request formats
    test_cases = [
        {
            "name": "Valid stripe request",
            "data": {"source": "stripe", "amount": 25.0}
        },
        {
            "name": "Valid zelle request", 
            "data": {"source": "zelle", "amount": 10.5}
        },
        {
            "name": "Invalid source",
            "data": {"source": "paypal", "amount": 25.0}
        },
        {
            "name": "Negative amount",
            "data": {"source": "stripe", "amount": -5.0}
        },
        {
            "name": "Zero amount",
            "data": {"source": "stripe", "amount": 0}
        },
        {
            "name": "String amount",
            "data": {"source": "stripe", "amount": "25.00"}
        },
        {
            "name": "Missing source",
            "data": {"amount": 25.0}
        },
        {
            "name": "Missing amount",
            "data": {"source": "stripe"}
        }
    ]
    
    for test_case in test_cases:
        print(f"🧪 Testing: {test_case['name']}")
        print(f"   Data: {test_case['data']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/wallet/fund",
                headers=headers,
                json=test_case['data']
            )
            
            print(f"   Status: {response.status_code}")
            if response.status_code != 200:
                print(f"   Error: {response.text}")
            else:
                result = response.json()
                print(f"   Success: {result}")
            
        except Exception as e:
            print(f"   Exception: {e}")
        
        print()

if __name__ == "__main__":
    test_fund_requests()