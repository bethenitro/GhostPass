#!/usr/bin/env python3
"""
Fetch Current Database Schema Structure
Uses the existing backend database connection to get the current structure.
"""

from database import get_db
import json
import sys
from typing import Dict, List, Any

def fetch_table_info(db, table_name: str) -> Dict[str, Any]:
    """Fetch information about a specific table"""
    try:
        # Try to get a sample record to see the structure
        result = db.table(table_name).select('*').limit(1).execute()
        
        table_info = {
            'exists': True,
            'columns': [],
            'sample_count': len(result.data) if result.data else 0,
            'sample_record': result.data[0] if result.data else None
        }
        
        # Get column names from sample data
        if result.data:
            table_info['columns'] = list(result.data[0].keys())
        else:
            # Table exists but is empty - try to get structure another way
            try:
                # Try inserting invalid data to get column info from error
                db.table(table_name).select('*').eq('nonexistent_column', 'test').execute()
            except Exception as e:
                # Parse error message for column hints if possible
                pass
            table_info['columns'] = []
        
        return table_info
        
    except Exception as e:
        return {
            'exists': False,
            'error': str(e),
            'columns': [],
            'sample_count': 0,
            'sample_record': None
        }

def get_database_structure() -> Dict[str, Any]:
    """Get the complete database structure"""
    
    print("🔍 Fetching database structure...")
    
    # Get database connection using existing logic
    try:
        db = get_db()
        print("✅ Connected to Supabase using existing connection logic")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return {}
    
    # Tables to check (based on the schema.sql and existing code)
    tables_to_check = [
        'users',
        'wallets', 
        'transactions',
        'ghost_passes',
        'fee_configs',
        'audit_logs',
        'system_configs',
        'payout_requests',
        # Additional tables that might exist
        'sessions',
        'gateway_points',
        'ghost_pass_revocations',
        'cryptographic_proofs',
        'ghost_pass_interactions',
        'entry_point_audit_logs'
    ]
    
    database_structure = {
        'timestamp': '2024-01-28',
        'connection_method': 'existing_backend_logic',
        'tables': {}
    }
    
    existing_tables = []
    missing_tables = []
    
    for table_name in tables_to_check:
        print(f"\n📋 Checking table: {table_name}")
        
        table_info = fetch_table_info(db, table_name)
        database_structure['tables'][table_name] = table_info
        
        if table_info['exists']:
            existing_tables.append(table_name)
            columns = table_info['columns']
            sample_count = table_info['sample_count']
            
            print(f"  ✅ EXISTS - {len(columns)} columns, {sample_count} records")
            
            if columns:
                print(f"  📊 Columns: {', '.join(columns)}")
            
            # Show sample data structure (without sensitive data)
            if table_info['sample_record']:
                sample = table_info['sample_record'].copy()
                # Mask sensitive fields
                for key in sample:
                    if any(sensitive in key.lower() for sensitive in ['password', 'key', 'secret', 'token']):
                        sample[key] = '[MASKED]'
                    elif isinstance(sample[key], str) and len(sample[key]) > 50:
                        sample[key] = sample[key][:50] + '...'
                
                print(f"  📝 Sample: {sample}")
        else:
            missing_tables.append(table_name)
            print(f"  ❌ MISSING - {table_info['error']}")
    
    return database_structure, existing_tables, missing_tables

def analyze_transactions_table(structure: Dict[str, Any]) -> None:
    """Analyze the transactions table specifically for Ghost Pass requirements"""
    
    print(f"\n" + "="*60)
    print("🎯 TRANSACTIONS TABLE ANALYSIS")
    print("="*60)
    
    if 'transactions' not in structure['tables']:
        print("❌ Transactions table not found!")
        return
    
    table_info = structure['tables']['transactions']
    
    if not table_info['exists']:
        print("❌ Transactions table does not exist!")
        return
    
    current_columns = table_info['columns']
    print(f"📊 Current columns ({len(current_columns)}):")
    for col in current_columns:
        print(f"  - {col}")
    
    # Required columns for Ghost Pass functionality
    required_columns = [
        'id', 'wallet_id', 'type', 'amount_cents',  # Basic columns
        'vendor_id', 'vendor_name',  # Vendor tracking
        'gateway_id', 'gateway_name', 'gateway_type',  # Gateway info
        'venue_id',  # Venue tracking
        'balance_before_cents', 'balance_after_cents',  # Balance tracking
        'interaction_method',  # QR/NFC
        'platform_fee_cents', 'vendor_payout_cents',  # Fee tracking
        'context', 'device_fingerprint',  # Context and device
        'created_at', 'timestamp', 'metadata'  # Timestamps and metadata
    ]
    
    missing_columns = [col for col in required_columns if col not in current_columns]
    extra_columns = [col for col in current_columns if col not in required_columns]
    
    if missing_columns:
        print(f"\n❌ Missing columns ({len(missing_columns)}):")
        for col in missing_columns:
            print(f"  - {col}")
    else:
        print(f"\n✅ All required columns present!")
    
    if extra_columns:
        print(f"\n📋 Extra columns ({len(extra_columns)}):")
        for col in extra_columns:
            print(f"  - {col}")
    
    # Show sample transaction if available
    if table_info['sample_record']:
        print(f"\n📝 Sample transaction structure:")
        sample = table_info['sample_record']
        for key, value in sample.items():
            print(f"  {key}: {type(value).__name__} = {value}")

def generate_migration_sql(structure: Dict[str, Any], existing_tables: List[str], missing_tables: List[str]) -> str:
    """Generate SQL migration based on current structure"""
    
    print(f"\n" + "="*60)
    print("🔧 GENERATING MIGRATION SQL")
    print("="*60)
    
    migration_sql = []
    migration_sql.append("-- Ghost Pass Migration SQL")
    migration_sql.append("-- Generated based on current database structure")
    migration_sql.append("-- Run this in Supabase SQL Editor")
    migration_sql.append("")
    
    # Check transactions table and add missing columns
    if 'transactions' in existing_tables:
        table_info = structure['tables']['transactions']
        current_columns = table_info['columns']
        
        required_columns = {
            'vendor_id': 'TEXT',
            'vendor_name': 'TEXT',
            'gateway_name': 'TEXT', 
            'gateway_type': 'TEXT',
            'venue_id': 'TEXT',
            'balance_before_cents': 'INTEGER',
            'balance_after_cents': 'INTEGER',
            'interaction_method': 'TEXT DEFAULT \'QR\'',
            'platform_fee_cents': 'INTEGER DEFAULT 0',
            'vendor_payout_cents': 'INTEGER DEFAULT 0',
            'context': 'TEXT DEFAULT \'general\'',
            'device_fingerprint': 'TEXT'
        }
        
        missing_columns = [col for col in required_columns.keys() if col not in current_columns]
        
        if missing_columns:
            migration_sql.append("-- Add missing columns to transactions table")
            migration_sql.append("ALTER TABLE transactions")
            
            alter_statements = []
            for col in missing_columns:
                col_def = required_columns[col]
                alter_statements.append(f"ADD COLUMN IF NOT EXISTS {col} {col_def}")
            
            migration_sql.append(",\n".join(alter_statements) + ";")
            migration_sql.append("")
    
    # Add missing tables
    missing_table_definitions = {
        'cryptographic_proofs': """
CREATE TABLE IF NOT EXISTS cryptographic_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proof_id UUID UNIQUE NOT NULL,
    wallet_binding_id TEXT NOT NULL,
    proof_type TEXT NOT NULL CHECK (proof_type IN ('age_verified', 'medical_credential', 'access_class')),
    proof_value JSONB NOT NULL,
    signature TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    verified BOOLEAN DEFAULT FALSE
);""",
        'ghost_pass_interactions': """
CREATE TABLE IF NOT EXISTS ghost_pass_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID UNIQUE NOT NULL,
    wallet_binding_id TEXT NOT NULL,
    ghost_pass_token TEXT NOT NULL,
    interaction_method TEXT NOT NULL CHECK (interaction_method IN ('QR', 'NFC')),
    gateway_id TEXT NOT NULL,
    item_amount_cents INTEGER NOT NULL DEFAULT 0,
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    vendor_payout_cents INTEGER NOT NULL DEFAULT 0,
    total_charged_cents INTEGER NOT NULL DEFAULT 0,
    context TEXT NOT NULL DEFAULT 'general',
    device_fingerprint TEXT NOT NULL,
    proofs_verified INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('APPROVED', 'DENIED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);""",
        'ghost_pass_revocations': """
CREATE TABLE IF NOT EXISTS ghost_pass_revocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revocation_id UUID UNIQUE NOT NULL,
    ghost_pass_token TEXT NOT NULL,
    revocation_type TEXT NOT NULL DEFAULT 'TOKEN',
    reason TEXT NOT NULL,
    revoked_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);"""
    }
    
    for table in missing_tables:
        if table in missing_table_definitions:
            migration_sql.append(f"-- Create {table} table")
            migration_sql.append(missing_table_definitions[table])
            migration_sql.append("")
    
    return "\n".join(migration_sql)

def main():
    """Main function"""
    
    print("="*60)
    print("🔍 GHOST PASS DATABASE STRUCTURE ANALYSIS")
    print("="*60)
    
    try:
        # Get database structure
        structure, existing_tables, missing_tables = get_database_structure()
        
        if not structure:
            print("❌ Failed to fetch database structure")
            return
        
        # Save structure to file
        with open('current_database_structure.json', 'w') as f:
            json.dump(structure, f, indent=2, default=str)
        
        print(f"\n💾 Database structure saved to: current_database_structure.json")
        
        # Summary
        print(f"\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        
        print(f"✅ Existing tables ({len(existing_tables)}):")
        for table in existing_tables:
            columns = structure['tables'][table]['columns']
            records = structure['tables'][table]['sample_count']
            print(f"  - {table}: {len(columns)} columns, {records} records")
        
        if missing_tables:
            print(f"\n❌ Missing tables ({len(missing_tables)}):")
            for table in missing_tables:
                print(f"  - {table}")
        
        # Analyze transactions table specifically
        analyze_transactions_table(structure)
        
        # Generate migration SQL
        migration_sql = generate_migration_sql(structure, existing_tables, missing_tables)
        
        with open('ghost_pass_migration.sql', 'w') as f:
            f.write(migration_sql)
        
        print(f"\n💾 Migration SQL saved to: ghost_pass_migration.sql")
        
        print(f"\n" + "="*60)
        print("✅ ANALYSIS COMPLETE")
        print("="*60)
        print("Files generated:")
        print("  - current_database_structure.json (detailed analysis)")
        print("  - ghost_pass_migration.sql (migration script)")
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()