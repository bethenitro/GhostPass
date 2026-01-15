from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from database import get_db
from routes.auth import get_admin_user
from models import (
    FeeConfigUpdate, ScanFeeUpdate, GhostPassPricingUpdate,
    PayoutRequestAdmin, PayoutAction, RetentionOverride,
    AuditLog, SystemStats, AdminDashboard, UserRole
)
from typing import List, Optional
import logging
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

async def log_admin_action(
    db: Client,
    admin_user_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    metadata: Optional[dict] = None
):
    """Log admin action to audit trail"""
    try:
        db.table("audit_logs").insert({
            "admin_user_id": admin_user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "old_value": old_value,
            "new_value": new_value,
            "metadata": metadata or {}
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")

@router.get("/health")
async def admin_health_check(
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Check if admin system is properly set up"""
    try:
        # Check required tables
        tables_status = {}
        
        required_tables = ["audit_logs", "system_configs", "payout_requests"]
        for table in required_tables:
            try:
                db.table(table).select("id").limit(1).execute()
                tables_status[table] = "✅ Available"
            except Exception as e:
                tables_status[table] = f"❌ Missing: {str(e)}"
        
        # Check if user has role column
        try:
            user_check = db.table("users").select("role").eq("id", admin_user.id).execute()
            if user_check.data and "role" in user_check.data[0]:
                tables_status["users_role_column"] = "✅ Available"
            else:
                tables_status["users_role_column"] = "❌ Missing role column"
        except Exception as e:
            tables_status["users_role_column"] = f"❌ Error: {str(e)}"
        
        # Check database function
        try:
            db.rpc("get_total_balance", {}).execute()
            tables_status["get_total_balance_function"] = "✅ Available"
        except Exception as e:
            tables_status["get_total_balance_function"] = f"❌ Missing: {str(e)}"
        
        all_good = all("✅" in status for status in tables_status.values())
        
        return {
            "status": "healthy" if all_good else "setup_required",
            "admin_user": admin_user.email,
            "admin_role": getattr(admin_user, 'role', 'unknown'),
            "tables": tables_status,
            "message": "All systems operational" if all_good else "Run admin_schema.sql in Supabase Dashboard"
        }
        
    except Exception as e:
        logger.error(f"Admin health check error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/dashboard", response_model=AdminDashboard)
async def get_admin_dashboard(
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Get admin dashboard with system stats and recent activity"""
    try:
        # Check if admin tables exist first
        try:
            db.table("audit_logs").select("id").limit(1).execute()
            admin_tables_exist = True
        except Exception:
            admin_tables_exist = False
        
        if not admin_tables_exist:
            raise HTTPException(
                status_code=503, 
                detail="Admin tables not found. Please run admin_schema.sql in Supabase Dashboard first."
            )
        # Get system statistics
        users_count = db.table("users").select("id", count="exact").execute()
        wallets_count = db.table("wallets").select("id", count="exact").execute()
        
        # Get total balance across all wallets
        try:
            # Use manual calculation instead of RPC function for reliability
            wallets_data = db.table("wallets").select("balance_cents").execute()
            total_balance = sum(w["balance_cents"] for w in wallets_data.data) if wallets_data.data else 0
            logger.info(f"Total balance calculated manually: {total_balance}")
        except Exception as e:
            logger.warning(f"Error calculating total balance: {e}")
            total_balance = 0
        
        # Get pass statistics based on expires_at timestamp (real-time expiration check)
        try:
            now_iso = datetime.utcnow().isoformat()
            
            # Active passes: expires_at is in the future (still valid)
            active_passes = db.table("ghost_passes").select("id", count="exact").gte("expires_at", now_iso).execute()
            
            # Expired passes: expires_at is in the past (no longer valid)
            expired_passes = db.table("ghost_passes").select("id", count="exact").lt("expires_at", now_iso).execute()
            
            logger.info(f"Pass statistics: {active_passes.count or 0} active, {expired_passes.count or 0} expired (based on expires_at timestamp)")
        except Exception as e:
            logger.warning(f"ghost_passes table access error: {e}")
            active_passes = type('obj', (object,), {'count': 0})()
            expired_passes = type('obj', (object,), {'count': 0})()
        
        # Get payout statistics
        try:
            pending_payouts = db.table("payout_requests").select("id", count="exact").eq("status", "PENDING").execute()
        except Exception as e:
            logger.warning(f"payout_requests table access error: {e}")
            pending_payouts = type('obj', (object,), {'count': 0})()
        
        # Get transaction count
        transactions_count = db.table("transactions").select("id", count="exact").execute()
        
        # Get total scans from entry point audit logs
        try:
            total_scans = db.table("entry_point_audit_logs").select("id", count="exact").eq("action_type", "SCAN").execute()
        except Exception as e:
            logger.warning(f"entry_point_audit_logs table access error: {e}")
            total_scans = type('obj', (object,), {'count': 0})()
        
        # Get revenue statistics (last 24h, 7d, 30d)
        now = datetime.utcnow()
        today = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        revenue_today = db.table("transactions").select("amount_cents").eq("type", "SPEND").gte("timestamp", today.isoformat()).execute()
        revenue_week = db.table("transactions").select("amount_cents").eq("type", "SPEND").gte("timestamp", week_ago.isoformat()).execute()
        revenue_month = db.table("transactions").select("amount_cents").eq("type", "SPEND").gte("timestamp", month_ago.isoformat()).execute()
        
        revenue_today_cents = sum(abs(t["amount_cents"]) for t in revenue_today.data) if revenue_today.data else 0
        revenue_week_cents = sum(abs(t["amount_cents"]) for t in revenue_week.data) if revenue_week.data else 0
        revenue_month_cents = sum(abs(t["amount_cents"]) for t in revenue_month.data) if revenue_month.data else 0
        
        stats = SystemStats(
            total_users=users_count.count or 0,
            total_wallets=wallets_count.count or 0,
            total_balance_cents=total_balance,
            active_passes=active_passes.count or 0,
            expired_passes=expired_passes.count or 0,
            pending_payouts=pending_payouts.count or 0,
            total_transactions=transactions_count.count or 0,
            total_scans=total_scans.count or 0,
            revenue_today_cents=revenue_today_cents,
            revenue_week_cents=revenue_week_cents,
            revenue_month_cents=revenue_month_cents
        )
        
        # Get recent transactions (last 10)
        recent_transactions_data = db.table("transactions").select("*").order("timestamp", desc=True).limit(10).execute()
        recent_transactions = recent_transactions_data.data if recent_transactions_data.data else []
        
        # Get pending payouts with vendor info
        try:
            pending_payouts_data = db.table("payout_requests").select("""
                id, vendor_user_id, amount_cents, status, requested_at, processed_at, processed_by, notes
            """).eq("status", "PENDING").order("requested_at", desc=True).limit(10).execute()
            
            pending_payouts_list = []
            for payout in pending_payouts_data.data if pending_payouts_data.data else []:
                # Get vendor email separately
                try:
                    vendor_user_data = db.table("users").select("email").eq("id", payout["vendor_user_id"]).execute()
                    vendor_email = vendor_user_data.data[0]["email"] if vendor_user_data.data else "Unknown"
                except Exception as e:
                    logger.warning(f"Error fetching vendor user email for {payout['vendor_user_id']}: {e}")
                    vendor_email = "Unknown"
                
                pending_payouts_list.append(PayoutRequestAdmin(
                    id=payout["id"],
                    vendor_user_id=payout["vendor_user_id"],
                    vendor_email=vendor_email,
                    amount_cents=payout["amount_cents"],
                    status=payout["status"],
                    requested_at=payout["requested_at"],
                    processed_at=payout.get("processed_at"),
                    processed_by=payout.get("processed_by"),
                    notes=payout.get("notes")
                ))
        except Exception as e:
            logger.warning(f"Error fetching payout requests: {e}")
            pending_payouts_list = []
        
        # Get recent audit logs
        try:
            recent_audit_data = db.table("audit_logs").select("""
                id, admin_user_id, action, resource_type, resource_id, old_value, new_value, timestamp, metadata
            """).order("timestamp", desc=True).limit(10).execute()
            
            recent_audit_logs = []
            for log in recent_audit_data.data if recent_audit_data.data else []:
                # Get admin user email separately
                try:
                    admin_user_data = db.table("users").select("email").eq("id", log["admin_user_id"]).execute()
                    admin_email = admin_user_data.data[0]["email"] if admin_user_data.data else "Unknown"
                except Exception as e:
                    logger.warning(f"Error fetching admin user email for {log['admin_user_id']}: {e}")
                    admin_email = "Unknown"
                
                recent_audit_logs.append(AuditLog(
                    id=log["id"],
                    admin_user_id=log["admin_user_id"],
                    admin_email=admin_email,
                    action=log["action"],
                    resource_type=log["resource_type"],
                    resource_id=log.get("resource_id"),
                    old_value=log.get("old_value"),
                    new_value=log.get("new_value"),
                    timestamp=log["timestamp"],
                    metadata=log.get("metadata")
                ))
        except Exception as e:
            logger.warning(f"Error fetching audit logs: {e}")
            recent_audit_logs = []

        # Get current configurations - ensure defaults exist in database
        try:
            # Get current fee config (default venue)
            fee_config_data = db.table("fee_configs").select("*").eq("venue_id", "default").execute()
            
            if not fee_config_data.data:
                # Insert default fee config if it doesn't exist
                default_fee_config = {
                    "venue_id": "default",
                    "valid_pct": 30.0,
                    "vendor_pct": 30.0,
                    "pool_pct": 30.0,
                    "promoter_pct": 10.0
                }
                db.table("fee_configs").insert(default_fee_config).execute()
                current_fee_config = default_fee_config
            else:
                current_fee_config = fee_config_data.data[0]
                logger.info(f"Loaded fee config from database: {current_fee_config}")
                
        except Exception as e:
            logger.warning(f"Error fetching fee config: {e}")
            current_fee_config = {
                "valid_pct": 30.0,
                "vendor_pct": 30.0,
                "pool_pct": 30.0,
                "promoter_pct": 10.0
            }

        try:
            # Get current scan fees
            scan_fees_data = db.table("system_configs").select("*").eq("config_key", "scan_fees").execute()
            
            if not scan_fees_data.data:
                # Insert default scan fees if they don't exist
                default_scan_fees = {"default": 10}
                db.table("system_configs").insert({
                    "config_key": "scan_fees",
                    "config_value": default_scan_fees
                }).execute()
                current_scan_fees = default_scan_fees
            else:
                current_scan_fees = scan_fees_data.data[0]["config_value"]
                
        except Exception as e:
            logger.warning(f"Error fetching scan fees: {e}")
            current_scan_fees = {"default": 10}

        try:
            # Get current pricing
            pricing_data = db.table("system_configs").select("*").eq("config_key", "ghostpass_pricing").execute()
            
            if not pricing_data.data:
                # Insert default pricing if it doesn't exist
                default_pricing = {"1": 1000, "3": 2000, "7": 5000}
                db.table("system_configs").insert({
                    "config_key": "ghostpass_pricing",
                    "config_value": default_pricing
                }).execute()
                current_pricing = default_pricing
            else:
                current_pricing = pricing_data.data[0]["config_value"]
                
        except Exception as e:
            logger.warning(f"Error fetching pricing: {e}")
            current_pricing = {"1": 1000, "3": 2000, "7": 5000}

        try:
            # Get current retention settings
            retention_data = db.table("system_configs").select("*").eq("config_key", "data_retention").execute()
            
            if not retention_data.data:
                # Insert default retention if it doesn't exist
                default_retention = {"retention_days": 60}
                db.table("system_configs").insert({
                    "config_key": "data_retention",
                    "config_value": default_retention
                }).execute()
                current_retention = default_retention
            else:
                current_retention = retention_data.data[0]["config_value"]
                
        except Exception as e:
            logger.warning(f"Error fetching retention: {e}")
            current_retention = {"retention_days": 60}
        
        logger.info(f"Dashboard response - fee_config: {current_fee_config}, pricing: {current_pricing}, scan_fees: {current_scan_fees}, retention: {current_retention}")
        
        return AdminDashboard(
            stats=stats,
            recent_transactions=recent_transactions,
            pending_payouts=pending_payouts_list,
            recent_audit_logs=recent_audit_logs,
            current_fee_config=current_fee_config,
            current_scan_fees=current_scan_fees,
            current_pricing=current_pricing,
            current_retention=current_retention
        )
        
    except Exception as e:
        logger.error(f"Admin dashboard error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load admin dashboard")

@router.post("/fees/config")
async def update_fee_config(
    config: FeeConfigUpdate,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Update fee split configuration"""
    try:
        venue_id = config.venue_id or "default"
        
        # Get current config for audit log
        current_config = db.table("fee_configs").select("*").eq("venue_id", venue_id).execute()
        old_value = current_config.data[0] if current_config.data else None
        
        # Update or insert fee config
        new_config = {
            "venue_id": venue_id,
            "valid_pct": config.valid_pct,
            "vendor_pct": config.vendor_pct,
            "pool_pct": config.pool_pct,
            "promoter_pct": config.promoter_pct
        }
        
        db.table("fee_configs").upsert(new_config, on_conflict="venue_id").execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "UPDATE_FEE_CONFIG", "fee_config",
            venue_id, old_value, new_config
        )
        
        return {"status": "success", "message": f"Fee configuration updated for {venue_id}"}
        
    except Exception as e:
        logger.error(f"Fee config update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update fee configuration")

@router.post("/fees/scan")
async def update_scan_fee(
    fee_update: ScanFeeUpdate,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Update scan fee for specific venue"""
    try:
        # Get current system config for scan fees
        current_config = db.table("system_configs").select("*").eq("config_key", "scan_fees").execute()
        
        if current_config.data:
            scan_fees = current_config.data[0]["config_value"]
            old_value = scan_fees.copy()
        else:
            scan_fees = {}
            old_value = None
        
        # Update scan fee for venue
        scan_fees[fee_update.venue_id] = fee_update.fee_cents
        
        # Save updated config
        db.table("system_configs").upsert({
            "config_key": "scan_fees",
            "config_value": scan_fees,
            "updated_by": admin_user.id
        }, on_conflict="config_key").execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "UPDATE_SCAN_FEE", "system_config",
            "scan_fees", old_value, scan_fees
        )
        
        return {"status": "success", "message": f"Scan fee updated for {fee_update.venue_id}"}
        
    except Exception as e:
        logger.error(f"Scan fee update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update scan fee")

@router.post("/pricing/ghostpass")
async def update_ghostpass_pricing(
    pricing: GhostPassPricingUpdate,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Update GhostPass pricing"""
    try:
        # Get current pricing config
        current_config = db.table("system_configs").select("*").eq("config_key", "ghostpass_pricing").execute()
        old_value = current_config.data[0]["config_value"] if current_config.data else None
        
        # New pricing configuration
        new_pricing = {
            "1": pricing.one_day_cents,
            "3": pricing.three_day_cents,
            "5": pricing.five_day_cents,
            "7": pricing.seven_day_cents,
            "10": pricing.ten_day_cents,
            "14": pricing.fourteen_day_cents,
            "30": pricing.thirty_day_cents
        }
        
        # Save updated pricing
        db.table("system_configs").upsert({
            "config_key": "ghostpass_pricing",
            "config_value": new_pricing,
            "updated_by": admin_user.id
        }, on_conflict="config_key").execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "UPDATE_GHOSTPASS_PRICING", "system_config",
            "ghostpass_pricing", old_value, new_pricing
        )
        
        return {"status": "success", "message": "GhostPass pricing updated"}
        
    except Exception as e:
        logger.error(f"GhostPass pricing update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update GhostPass pricing")

@router.get("/payouts", response_model=List[PayoutRequestAdmin])
async def get_payout_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Get payout requests with optional status filter"""
    try:
        query = db.table("payout_requests").select("""
            id, vendor_user_id, amount_cents, status, requested_at, processed_at, processed_by, notes
        """)
        
        if status:
            query = query.eq("status", status.upper())
        
        payouts_data = query.order("requested_at", desc=True).execute()
        
        payouts = []
        for payout in payouts_data.data if payouts_data.data else []:
            # Get vendor email separately
            try:
                vendor_user_data = db.table("users").select("email").eq("id", payout["vendor_user_id"]).execute()
                vendor_email = vendor_user_data.data[0]["email"] if vendor_user_data.data else "Unknown"
            except Exception as e:
                logger.warning(f"Error fetching vendor user email for {payout['vendor_user_id']}: {e}")
                vendor_email = "Unknown"
            
            payouts.append(PayoutRequestAdmin(
                id=payout["id"],
                vendor_user_id=payout["vendor_user_id"],
                vendor_email=vendor_email,
                amount_cents=payout["amount_cents"],
                status=payout["status"],
                requested_at=payout["requested_at"],
                processed_at=payout.get("processed_at"),
                processed_by=payout.get("processed_by"),
                notes=payout.get("notes")
            ))
        
        return payouts
        
    except Exception as e:
        logger.error(f"Get payout requests error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payout requests")

@router.post("/payouts/{payout_id}/action")
async def process_payout_action(
    payout_id: str,
    action: PayoutAction,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Process payout action (approve, reject, process)"""
    try:
        # Get current payout
        payout_data = db.table("payout_requests").select("*").eq("id", payout_id).execute()
        if not payout_data.data:
            raise HTTPException(status_code=404, detail="Payout request not found")
        
        current_payout = payout_data.data[0]
        
        # Update payout status
        update_data = {
            "status": action.action.upper(),
            "processed_at": datetime.utcnow().isoformat(),
            "processed_by": admin_user.id,
            "notes": action.notes
        }
        
        db.table("payout_requests").update(update_data).eq("id", payout_id).execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, f"PAYOUT_{action.action.upper()}", "payout_request",
            payout_id, current_payout, {**current_payout, **update_data}
        )
        
        return {"status": "success", "message": f"Payout {action.action}d successfully"}
        
    except Exception as e:
        logger.error(f"Payout action error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process payout action")

@router.post("/payouts/process-all")
async def process_all_pending_payouts(
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Batch approve all pending payouts"""
    try:
        # Get all pending payouts
        pending_payouts = db.table("payout_requests").select("*").eq("status", "PENDING").execute()
        
        if not pending_payouts.data:
            return {"status": "success", "message": "No pending payouts to process", "processed_count": 0}
        
        # Update all to approved
        update_data = {
            "status": "APPROVED",
            "processed_at": datetime.utcnow().isoformat(),
            "processed_by": admin_user.id,
            "notes": "Batch processed by admin"
        }
        
        db.table("payout_requests").update(update_data).eq("status", "PENDING").execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "BATCH_APPROVE_PAYOUTS", "payout_request",
            None, None, {"processed_count": len(pending_payouts.data)}
        )
        
        return {
            "status": "success", 
            "message": f"Processed {len(pending_payouts.data)} payouts",
            "processed_count": len(pending_payouts.data)
        }
        
    except Exception as e:
        logger.error(f"Batch payout processing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process batch payouts")

@router.post("/retention/override")
async def override_retention_period(
    override: RetentionOverride,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Override data retention period"""
    try:
        # Get current retention config
        current_config = db.table("system_configs").select("*").eq("config_key", "data_retention").execute()
        old_value = current_config.data[0]["config_value"] if current_config.data else {"retention_days": 60}
        
        # New retention configuration
        new_retention = {
            "retention_days": override.retention_days,
            "justification": override.justification,
            "overridden_by": admin_user.id,
            "overridden_at": datetime.utcnow().isoformat()
        }
        
        # Save updated retention config
        db.table("system_configs").upsert({
            "config_key": "data_retention",
            "config_value": new_retention,
            "updated_by": admin_user.id
        }, on_conflict="config_key").execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "OVERRIDE_DATA_RETENTION", "system_config",
            "data_retention", old_value, new_retention,
            {"justification": override.justification}
        )
        
        return {"status": "success", "message": f"Data retention period updated to {override.retention_days} days"}
        
    except Exception as e:
        logger.error(f"Retention override error: {e}")
        raise HTTPException(status_code=500, detail="Failed to override retention period")

@router.get("/audit-logs", response_model=List[AuditLog])
async def get_audit_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None, description="Filter by action type"),
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Get audit logs with pagination and filtering"""
    try:
        query = db.table("audit_logs").select("""
            id, admin_user_id, action, resource_type, resource_id, old_value, new_value, timestamp, metadata
        """)
        
        if action:
            query = query.eq("action", action.upper())
        
        audit_data = query.order("timestamp", desc=True).range(offset, offset + limit - 1).execute()
        
        audit_logs = []
        for log in audit_data.data if audit_data.data else []:
            # Get admin user email separately
            try:
                admin_user_data = db.table("users").select("email").eq("id", log["admin_user_id"]).execute()
                admin_email = admin_user_data.data[0]["email"] if admin_user_data.data else "Unknown"
            except Exception as e:
                logger.warning(f"Error fetching admin user email for {log['admin_user_id']}: {e}")
                admin_email = "Unknown"
            
            audit_logs.append(AuditLog(
                id=log["id"],
                admin_user_id=log["admin_user_id"],
                admin_email=admin_email,
                action=log["action"],
                resource_type=log["resource_type"],
                resource_id=log.get("resource_id"),
                old_value=log.get("old_value"),
                new_value=log.get("new_value"),
                timestamp=log["timestamp"],
                metadata=log.get("metadata")
            ))
        
        return audit_logs
        
    except Exception as e:
        logger.error(f"Get audit logs error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get audit logs")

@router.get("/users")
async def get_users(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    role: Optional[str] = Query(None, description="Filter by user role"),
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Get users with pagination and role filtering"""
    try:
        query = db.table("users").select("id, email, role, created_at")
        
        if role:
            query = query.eq("role", role.upper())
        
        users_data = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return users_data.data if users_data.data else []
        
    except Exception as e:
        logger.error(f"Get users error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get users")

@router.post("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: UserRole,
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Update user role"""
    try:
        # Get current user data
        current_user = db.table("users").select("*").eq("id", user_id).execute()
        if not current_user.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        old_value = current_user.data[0]
        
        # Update user role
        db.table("users").update({"role": role.value}).eq("id", user_id).execute()
        
        # Log admin action
        await log_admin_action(
            db, admin_user.id, "UPDATE_USER_ROLE", "user",
            user_id, old_value, {**old_value, "role": role.value}
        )
        
        return {"status": "success", "message": f"User role updated to {role.value}"}
        
    except Exception as e:
        logger.error(f"Update user role error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user role")