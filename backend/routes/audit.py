from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from database import get_db
from routes.auth import get_current_user, get_admin_user
from models import (
    EntryPointAuditLog, EntryPointAuditCreate, EntryPointAuditFilter,
    EntryPointActionType, GatewayType
)
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import uuid

router = APIRouter(prefix="/audit", tags=["Audit"])
logger = logging.getLogger(__name__)

@router.post("/entry-point", response_model=dict)
async def log_entry_point_action(
    audit_data: EntryPointAuditCreate,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Manually log an entry point action (for frontend-initiated actions)"""
    try:
        # Get entry point details
        gateway_response = db.table("gateway_points")\
            .select("*")\
            .eq("id", str(audit_data.entry_point_id))\
            .single()\
            .execute()
        
        if not gateway_response.data:
            raise HTTPException(status_code=404, detail="Entry point not found")
        
        gateway = gateway_response.data
        
        # Get admin user info if current user is admin
        admin_email = None
        user_data = db.table("users").select("role, email").eq("id", current_user.id).execute()
        if user_data.data and user_data.data[0].get("role") == "ADMIN":
            admin_email = user_data.data[0].get("email")
        
        # Insert audit log
        audit_log = {
            "action_type": audit_data.action_type.value,
            "entry_point_id": str(audit_data.entry_point_id),
            "entry_point_type": gateway["type"],
            "entry_point_name": gateway["name"],
            "employee_name": gateway["employee_name"],
            "employee_id": gateway["employee_id"],
            "admin_user_id": str(current_user.id) if admin_email else None,
            "admin_email": admin_email,
            "source_location": audit_data.source_location,
            "old_values": audit_data.old_values,
            "new_values": audit_data.new_values,
            "metadata": audit_data.metadata or {}
        }
        
        result = db.table("entry_point_audit_logs").insert(audit_log).execute()
        
        return {
            "status": "success",
            "audit_id": result.data[0]["id"],
            "message": "Audit log created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging entry point action: {e}")
        raise HTTPException(status_code=500, detail="Failed to log audit action")

@router.get("/entry-point", response_model=List[EntryPointAuditLog])
async def get_entry_point_audit_logs(
    entry_point_id: Optional[str] = Query(None, description="Filter by entry point ID"),
    employee_name: Optional[str] = Query(None, description="Filter by employee name"),
    action_type: Optional[EntryPointActionType] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    source_location: Optional[str] = Query(None, description="Filter by source location"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get entry point audit logs with filtering"""
    try:
        # Call the database function to get filtered audit logs
        result = db.rpc(
            "get_entry_point_audit_logs",
            {
                "p_entry_point_id": entry_point_id,
                "p_employee_name": employee_name,
                "p_action_type": action_type.value if action_type else None,
                "p_start_date": start_date.isoformat() if start_date else None,
                "p_end_date": end_date.isoformat() if end_date else None,
                "p_source_location": source_location,
                "p_limit": limit,
                "p_offset": offset
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit logs")

@router.get("/entry-point/summary")
async def get_audit_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days to include in summary"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get audit trail summary statistics"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        end_date = datetime.now()
        
        # Call the database function to get summary stats
        result = db.rpc(
            "get_audit_summary_stats",
            {
                "p_start_date": start_date.isoformat(),
                "p_end_date": end_date.isoformat()
            }
        ).execute()
        
        if not result.data:
            return {
                "period_days": days,
                "total_actions": 0,
                "total_scans": 0,
                "total_edits": 0,
                "total_creates": 0,
                "total_deactivates": 0,
                "unique_entry_points": 0,
                "unique_employees": 0,
                "most_active_entry_point": "None",
                "most_active_employee": "None"
            }
        
        stats = result.data[0]
        stats["period_days"] = days
        
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching audit summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit summary")

@router.get("/entry-point/{entry_point_id}/history", response_model=List[EntryPointAuditLog])
async def get_entry_point_history(
    entry_point_id: str,
    limit: int = Query(50, ge=1, le=500, description="Number of records to return"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get complete history for a specific entry point"""
    try:
        # Verify entry point exists
        gateway_response = db.table("gateway_points")\
            .select("id")\
            .eq("id", entry_point_id)\
            .single()\
            .execute()
        
        if not gateway_response.data:
            raise HTTPException(status_code=404, detail="Entry point not found")
        
        # Get audit history
        result = db.rpc(
            "get_entry_point_audit_logs",
            {
                "p_entry_point_id": entry_point_id,
                "p_employee_name": None,
                "p_action_type": None,
                "p_start_date": None,
                "p_end_date": None,
                "p_source_location": None,
                "p_limit": limit,
                "p_offset": 0
            }
        ).execute()
        
        return result.data if result.data else []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching entry point history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch entry point history")

@router.get("/entry-point/employee/{employee_name}/activity", response_model=List[EntryPointAuditLog])
async def get_employee_activity(
    employee_name: str,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    limit: int = Query(100, ge=1, le=500, description="Number of records to return"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get activity history for a specific employee"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Get employee activity
        result = db.rpc(
            "get_entry_point_audit_logs",
            {
                "p_entry_point_id": None,
                "p_employee_name": employee_name,
                "p_action_type": None,
                "p_start_date": start_date.isoformat(),
                "p_end_date": None,
                "p_source_location": None,
                "p_limit": limit,
                "p_offset": 0
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        logger.error(f"Error fetching employee activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employee activity")

@router.get("/entry-point/recent-scans")
async def get_recent_scans(
    hours: int = Query(24, ge=1, le=168, description="Number of hours to look back"),
    limit: int = Query(50, ge=1, le=200, description="Number of records to return"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get recent scan activity across all entry points"""
    try:
        start_date = datetime.now() - timedelta(hours=hours)
        
        # Get recent scans
        result = db.rpc(
            "get_entry_point_audit_logs",
            {
                "p_entry_point_id": None,
                "p_employee_name": None,
                "p_action_type": "SCAN",
                "p_start_date": start_date.isoformat(),
                "p_end_date": None,
                "p_source_location": None,
                "p_limit": limit,
                "p_offset": 0
            }
        ).execute()
        
        # Format for display
        scans = []
        for log in (result.data or []):
            scans.append({
                "id": log["id"],
                "entry_point_name": log["entry_point_name"],
                "entry_point_type": log["entry_point_type"],
                "employee_name": log["employee_name"],
                "timestamp": log["timestamp"],
                "metadata": log["metadata"]
            })
        
        return {
            "period_hours": hours,
            "total_scans": len(scans),
            "scans": scans
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent scans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent scans")

@router.delete("/entry-point/cleanup")
async def cleanup_old_audit_logs(
    days_to_keep: int = Query(90, ge=30, le=365, description="Number of days of logs to keep"),
    admin_user=Depends(get_admin_user),
    db: Client = Depends(get_db)
):
    """Clean up old audit logs (admin only)"""
    try:
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        
        # Delete old logs
        result = db.table("entry_point_audit_logs")\
            .delete()\
            .lt("timestamp", cutoff_date.isoformat())\
            .execute()
        
        # Log the cleanup action
        from routes.admin import log_admin_action
        await log_admin_action(
            db, str(admin_user.id), "CLEANUP_AUDIT_LOGS", "audit_logs",
            None, None, {"days_to_keep": days_to_keep, "cutoff_date": cutoff_date.isoformat()}
        )
        
        return {
            "status": "success",
            "message": f"Cleaned up audit logs older than {days_to_keep} days",
            "cutoff_date": cutoff_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup audit logs")