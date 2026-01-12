#!/usr/bin/env python3
"""
Simple test script for GhostPass Wallet API
"""

import httpx
import json
import time

BASE_URL = "http://localhost:8000"

def test_api():
    """Test the main API endpoints"""
    print("🧪 Testing GhostPass Wallet API")
    
    # Wait a moment for server to start
    print("⏳ Waiting for server to start...")
    time.sleep(2)
    
    try:
        with httpx.Client(timeout=10.0) as client:
            # Test health check
            print("\n1. Health Check")
            response = client.get(f"{BASE_URL}/health")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
            
            # Test root endpoint
            print("\n2. Root Endpoint")
            response = client.get(f"{BASE_URL}/")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
            
            # Test API docs
            print("\n3. API Documentation")
            response = client.get(f"{BASE_URL}/docs")
            print(f"Status: {response.status_code}")
            print("API docs available at: http://localhost:8000/docs")
            
    except httpx.ConnectError:
        print("❌ Could not connect to API server")
        print("Make sure the server is running: python main.py")
    except Exception as e:
        print(f"❌ Test error: {e}")
    
    # Note: Authentication tests would require valid Supabase tokens
    print("\n✅ Basic API tests completed")
    print("For full testing, you'll need:")
    print("- Valid Supabase authentication tokens")
    print("- Proper database setup with schema")
    print("- Test user accounts")

if __name__ == "__main__":
    test_api()