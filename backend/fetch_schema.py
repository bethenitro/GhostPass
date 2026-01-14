"""
Fetch current Supabase schema for transactions and wallets tables
"""
import os
from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def fetch_table_schema(table_name: str):
    """Fetch schema information for a table"""
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get a sample row to understand the structure
    try:
        result = client.table(table_name).select("*").limit(1).execute()
        if result.data:
            print(f"\n=== {table_name.upper()} TABLE ===")
            print(f"Current columns: {list(result.data[0].keys())}")
            print(f"Sample data structure:")
            print(json.dumps(result.data[0], indent=2, default=str))
    except Exception as e:
        print(f"Error fetching {table_name}: {e}")

if __name__ == "__main__":
    print("Fetching current Supabase schema...")
    fetch_table_schema("transactions")
    fetch_table_schema("wallets")
