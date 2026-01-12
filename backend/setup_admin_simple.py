#!/usr/bin/env python3
"""
Simple Admin Setup Script for GhostPass Wallet
Just handles promoting a user to admin role.
"""

import os
import sys
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
    sys.exit(1)

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_admin_user(email: str):
    """Promote a user to admin role"""
    print(f"👤 Promoting user to admin: {email}")
    
    try:
        # Check if user exists
        existing_user = supabase.table("users").select("*").eq("email", email).execute()
        
        if not existing_user.data:
            print(f"❌ User {email} not found.")
            print("💡 Please register this user through the app first, then run this script again.")
            return None
        
        user = existing_user.data[0]
        user_id = user["id"]
        current_role = user.get("role", "USER")
        
        if current_role == "ADMIN":
            print(f"✅ User {email} is already an ADMIN")
            return user_id
        
        print(f"📧 User {email} found with role '{current_role}', updating to ADMIN...")
        
        # Update role to ADMIN
        result = supabase.table("users").update({"role": "ADMIN"}).eq("id", user_id).execute()
        
        if result.data:
            print(f"✅ User {email} is now an ADMIN")
            return user_id
        else:
            print(f"❌ Failed to update user role")
            print("💡 Make sure you've run the admin_schema.sql file first")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        if "role" in str(e) and "column" in str(e):
            print("💡 The 'role' column doesn't exist yet.")
            print("   Please run admin_schema.sql in Supabase Dashboard first.")
        return None

def main():
    print("🚀 GhostPass Simple Admin Setup")
    print("=" * 40)
    print("📋 Prerequisites:")
    print("1. Run admin_schema.sql in Supabase Dashboard > SQL Editor")
    print("2. Register the admin user through the app")
    print("3. Run this script to promote them to admin")
    print()
    
    # Get admin email from user
    admin_email = input("📧 Enter admin email address: ").strip()
    
    if not admin_email:
        print("❌ Email address is required")
        sys.exit(1)
    
    # Promote user to admin
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
        print("💡 Make sure you've completed the prerequisites above")
        sys.exit(1)

if __name__ == "__main__":
    main()