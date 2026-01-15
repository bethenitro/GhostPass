from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from database import get_db
from routes.auth import get_current_user, get_admin_user
from routes.admin import log_admin_action
from models import (
    GatewayPoint, GatewayPointCreate, GatewayPointUpdate, GatewayType,
    GatewayMetricCreate, GatewayRealtimeMetrics, MetricType
)
from typing import List, Optional
import logging

router = APIRouter(prefix="/gateway", tags=["Gateway"])
logger = logging.getLogger(__name__)

@router.get("/points", response_model=List[GatewayPoint])
async def get_gateway_points(
    type: Optional[str] = Query(None, description="Filter by gateway type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get all gateway points for current user's venue"""
    try:
        # TODO: Get actual venue_id from user context
        # For now, using a default venue_id
        venue_id = "venue_001"
        
        # Explicitly select all fields including new employee fields
        query = db.table("gateway_points").select("id, venue_id, name, number, accepts_ghostpass, status, type, employee_name, employee_id, visual_identifier, linked_area_id, created_at, updated_at, created_by").eq("venue_id", venue_id)
        
        if type:
            query = query.eq("type", type.upper())
        
        if status:
            query = query.eq("status", status.upper())
        
        result = query.order("created_at", desc=True).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        logger.error(f"Error fetching gateway points: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch gateway points")

@router.post("/points", response_model=GatewayPoint)
async def create_gateway_point(
    point: GatewayPointCreate,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Create new gateway point"""
    try:
        # TODO: Get actual venue_id from user context
        venue_id = "venue_001"
        
        # Check for duplicate name within same venue and type
        existing = db.table("gateway_points").select("id").eq("venue_id", venue_id).eq("name", point.name).eq("type", point.type.value).execute()
        
        if existing.data:
            raise HTTPException(
                status_code=400, 
                detail=f"A {point.type.value.lower().replace('_', ' ')} with name '{point.name}' already exists"
            )
        
        # Create new gateway point
        new_point = {
            "venue_id": venue_id,
            "name": point.name,
            "status": point.status.value,
            "type": point.type.value,
            "employee_name": point.employee_name,
            "employee_id": point.employee_id,
            "created_by": str(current_user.id)
        }
        
        # Add optional fields if provided
        if point.number is not None:
            new_point["number"] = point.number
        
        if point.visual_identifier:
            new_point["visual_identifier"] = point.visual_identifier
        
        # Always include accepts_ghostpass (defaults to True in model)
        new_point["accepts_ghostpass"] = point.accepts_ghostpass
        
        # Handle linked_area_id for TABLE_SEAT type
        if point.type == GatewayType.TABLE_SEAT:
            if not point.linked_area_id:
                raise HTTPException(
                    status_code=400,
                    detail="linked_area_id is required for TABLE_SEAT type"
                )
            
            # Verify the linked area exists and is an INTERNAL_AREA
            linked_area = db.table("gateway_points").select("id, type").eq("id", str(point.linked_area_id)).execute()
            if not linked_area.data:
                raise HTTPException(status_code=400, detail="Linked area not found")
            
            if linked_area.data[0]["type"] != "INTERNAL_AREA":
                raise HTTPException(
                    status_code=400,
                    detail="linked_area_id must reference an INTERNAL_AREA"
                )
            
            new_point["linked_area_id"] = str(point.linked_area_id)
        elif point.linked_area_id:
            new_point["linked_area_id"] = str(point.linked_area_id)

        
        result = db.table("gateway_points").insert(new_point).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create gateway point")
        
        # Log admin action if user is admin
        try:
            user_data = db.table("users").select("role").eq("id", current_user.id).execute()
            if user_data.data and user_data.data[0].get("role") == "ADMIN":
                await log_admin_action(
                    db, str(current_user.id), "CREATE_GATEWAY_POINT", "gateway_point",
                    result.data[0]["id"], None, result.data[0]
                )
        except Exception as log_error:
            logger.warning(f"Failed to log admin action: {log_error}")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating gateway point: {e}")
        raise HTTPException(status_code=500, detail="Failed to create gateway point")

@router.put("/points/{point_id}", response_model=GatewayPoint)
async def update_gateway_point(
    point_id: str,
    point: GatewayPointUpdate,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Update gateway point"""
    try:
        # Get existing point
        existing = db.table("gateway_points").select("*").eq("id", point_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Gateway point not found")
        
        old_point = existing.data[0]
        
        # Build update data
        update_data = {}
        if point.name is not None:
            # Check for duplicate name if name is being changed
            if point.name != old_point["name"]:
                duplicate = db.table("gateway_points").select("id").eq("venue_id", old_point["venue_id"]).eq("name", point.name).eq("type", old_point["type"]).execute()
                
                if duplicate.data:
                    raise HTTPException(
                        status_code=400,
                        detail=f"A {old_point['type'].lower().replace('_', ' ')} with name '{point.name}' already exists"
                    )
            update_data["name"] = point.name
        
        if point.status is not None:
            update_data["status"] = point.status.value
        
        if point.number is not None:
            update_data["number"] = point.number
        
        if point.accepts_ghostpass is not None:
            update_data["accepts_ghostpass"] = point.accepts_ghostpass
        
        if point.employee_name is not None:
            update_data["employee_name"] = point.employee_name
        
        if point.employee_id is not None:
            update_data["employee_id"] = point.employee_id
        
        if point.visual_identifier is not None:
            update_data["visual_identifier"] = point.visual_identifier
        
        if point.linked_area_id is not None:
            # Verify the linked area exists and is an INTERNAL_AREA
            linked_area = db.table("gateway_points").select("id, type").eq("id", str(point.linked_area_id)).execute()
            if not linked_area.data:
                raise HTTPException(status_code=400, detail="Linked area not found")
            
            if linked_area.data[0]["type"] != "INTERNAL_AREA":
                raise HTTPException(
                    status_code=400,
                    detail="linked_area_id must reference an INTERNAL_AREA"
                )
            
            update_data["linked_area_id"] = str(point.linked_area_id)
        
        if not update_data:
            return old_point
        
        # Update gateway point
        result = db.table("gateway_points").update(update_data).eq("id", point_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update gateway point")
        
        # Log admin action if user is admin
        try:
            user_data = db.table("users").select("role").eq("id", current_user.id).execute()
            if user_data.data and user_data.data[0].get("role") == "ADMIN":
                await log_admin_action(
                    db, str(current_user.id), "UPDATE_GATEWAY_POINT", "gateway_point",
                    point_id, old_point, result.data[0]
                )
                
                # Also log detailed entry point audit for tracking changes
                from models import EntryPointActionType
                
                # Determine action type based on status change
                action_type = EntryPointActionType.EDIT
                if point.status is not None:
                    if old_point["status"] == "ENABLED" and point.status.value == "DISABLED":
                        action_type = EntryPointActionType.DEACTIVATE
                    elif old_point["status"] == "DISABLED" and point.status.value == "ENABLED":
                        action_type = EntryPointActionType.ACTIVATE
                
                # Create detailed change tracking
                changes = {}
                if point.name is not None and point.name != old_point["name"]:
                    changes["name"] = {"old": old_point["name"], "new": point.name}
                if point.employee_name is not None and point.employee_name != old_point["employee_name"]:
                    changes["employee_name"] = {"old": old_point["employee_name"], "new": point.employee_name}
                if point.employee_id is not None and point.employee_id != old_point["employee_id"]:
                    changes["employee_id"] = {"old": old_point["employee_id"], "new": point.employee_id}
                if point.status is not None and point.status.value != old_point["status"]:
                    changes["status"] = {"old": old_point["status"], "new": point.status.value}
                
                # Log the detailed audit entry using direct database insert
                try:
                    # Get admin user info
                    user_data = db.table("users").select("email").eq("id", current_user.id).execute()
                    admin_email = user_data.data[0].get("email") if user_data.data else None
                    
                    audit_log = {
                        "action_type": action_type.value,
                        "entry_point_id": point_id,
                        "entry_point_type": result.data[0]["type"],
                        "entry_point_name": result.data[0]["name"],
                        "employee_name": result.data[0]["employee_name"],
                        "employee_id": result.data[0]["employee_id"],
                        "admin_user_id": str(current_user.id),
                        "admin_email": admin_email,
                        "source_location": "Command Center",
                        "old_values": old_point,
                        "new_values": result.data[0],
                        "metadata": {"changes": changes, "admin_action": True}
                    }
                    
                    db.table("entry_point_audit_logs").insert(audit_log).execute()
                except Exception as audit_error:
                    logger.warning(f"Failed to log detailed entry point audit: {audit_error}")
                    
        except Exception as log_error:
            logger.warning(f"Failed to log admin action: {log_error}")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating gateway point: {e}")
        raise HTTPException(status_code=500, detail="Failed to update gateway point")

@router.delete("/points/{point_id}")
async def delete_gateway_point(
    point_id: str,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Delete gateway point"""
    try:
        # Get existing point for audit log
        existing = db.table("gateway_points").select("*").eq("id", point_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Gateway point not found")
        
        old_point = existing.data[0]
        
        # Delete gateway point
        db.table("gateway_points").delete().eq("id", point_id).execute()
        
        # Log admin action if user is admin
        try:
            user_data = db.table("users").select("role").eq("id", current_user.id).execute()
            if user_data.data and user_data.data[0].get("role") == "ADMIN":
                await log_admin_action(
                    db, str(current_user.id), "DELETE_GATEWAY_POINT", "gateway_point",
                    point_id, old_point, None
                )
        except Exception as log_error:
            logger.warning(f"Failed to log admin action: {log_error}")
        
        return {"status": "success", "message": "Gateway point deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting gateway point: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete gateway point")


# ============================================================================
# METRICS ENDPOINTS
# ============================================================================

@router.post("/metrics/record")
async def record_metric(
    metric: GatewayMetricCreate,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Record a metric event for a gateway point"""
    try:
        # Verify gateway point exists
        gateway = db.table("gateway_points").select("id, type").eq("id", str(metric.gateway_point_id)).execute()
        
        if not gateway.data:
            raise HTTPException(status_code=404, detail="Gateway point not found")
        
        # Call the database function to record metric
        result = db.rpc(
            "record_gateway_metric",
            {
                "p_gateway_point_id": str(metric.gateway_point_id),
                "p_metric_type": metric.metric_type.value,
                "p_amount_cents": metric.amount_cents,
                "p_metadata": metric.metadata or {}
            }
        ).execute()
        
        return {
            "status": "success",
            "metric_id": result.data,
            "message": "Metric recorded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording metric: {e}")
        raise HTTPException(status_code=500, detail="Failed to record metric")

@router.get("/metrics/{point_id}", response_model=GatewayRealtimeMetrics)
async def get_gateway_metrics(
    point_id: str,
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get real-time metrics for a specific gateway point"""
    try:
        # Call the database function to get real-time metrics
        result = db.rpc(
            "get_gateway_realtime_metrics",
            {"p_gateway_point_id": point_id}
        ).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Gateway point not found")
        
        metrics_data = result.data[0]
        
        # Convert to response model
        return GatewayRealtimeMetrics(
            gateway_point_id=metrics_data["gateway_point_id"],
            gateway_name=metrics_data["gateway_name"],
            gateway_type=metrics_data["gateway_type"],
            gateway_status=metrics_data["gateway_status"],
            total_qr_scans=metrics_data.get("total_qr_scans", 0),
            last_qr_scan=metrics_data.get("last_qr_scan"),
            qr_scans_last_hour=metrics_data.get("qr_scans_last_hour", 0),
            qr_scans_today=metrics_data.get("qr_scans_today", 0),
            total_transactions=metrics_data.get("total_transactions", 0),
            last_transaction=metrics_data.get("last_transaction"),
            transactions_last_hour=metrics_data.get("transactions_last_hour", 0),
            transactions_today=metrics_data.get("transactions_today", 0),
            total_sales_cents=metrics_data.get("total_sales_cents", 0),
            sales_last_hour_cents=metrics_data.get("sales_last_hour_cents", 0),
            sales_today_cents=metrics_data.get("sales_today_cents", 0)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching gateway metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch gateway metrics")

@router.get("/metrics", response_model=List[GatewayRealtimeMetrics])
async def get_all_gateway_metrics(
    type: Optional[str] = Query(None, description="Filter by gateway type"),
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get real-time metrics for all gateway points"""
    try:
        # TODO: Get actual venue_id from user context
        venue_id = "venue_001"
        
        # Get all gateway points for the venue
        query = db.table("gateway_points").select("id").eq("venue_id", venue_id)
        
        if type:
            query = query.eq("type", type.upper())
        
        points_result = query.execute()
        
        if not points_result.data:
            return []
        
        # Get metrics for each point
        all_metrics = []
        for point in points_result.data:
            try:
                result = db.rpc(
                    "get_gateway_realtime_metrics",
                    {"p_gateway_point_id": point["id"]}
                ).execute()
                
                if result.data and len(result.data) > 0:
                    metrics_data = result.data[0]
                    all_metrics.append(GatewayRealtimeMetrics(
                        gateway_point_id=metrics_data["gateway_point_id"],
                        gateway_name=metrics_data["gateway_name"],
                        gateway_type=metrics_data["gateway_type"],
                        gateway_status=metrics_data["gateway_status"],
                        total_qr_scans=metrics_data.get("total_qr_scans", 0),
                        last_qr_scan=metrics_data.get("last_qr_scan"),
                        qr_scans_last_hour=metrics_data.get("qr_scans_last_hour", 0),
                        qr_scans_today=metrics_data.get("qr_scans_today", 0),
                        total_transactions=metrics_data.get("total_transactions", 0),
                        last_transaction=metrics_data.get("last_transaction"),
                        transactions_last_hour=metrics_data.get("transactions_last_hour", 0),
                        transactions_today=metrics_data.get("transactions_today", 0),
                        total_sales_cents=metrics_data.get("total_sales_cents", 0),
                        sales_last_hour_cents=metrics_data.get("sales_last_hour_cents", 0),
                        sales_today_cents=metrics_data.get("sales_today_cents", 0)
                    ))
            except Exception as e:
                logger.warning(f"Error fetching metrics for point {point['id']}: {e}")
                continue
        
        return all_metrics
        
    except Exception as e:
        logger.error(f"Error fetching all gateway metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch gateway metrics")


# ============================================================================
# FINANCIAL DISTRIBUTION ENDPOINTS (READ-ONLY)
# ============================================================================

@router.get("/financial-distribution")
async def get_financial_distribution(
    current_user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get financial distribution summary for QR revenue (read-only visibility)"""
    try:
        # TODO: Get actual venue_id from user context
        venue_id = "venue_001"
        
        # Get all FEE transactions for this venue
        transactions = db.table("transactions")\
            .select("*")\
            .eq("type", "FEE")\
            .eq("venue_id", venue_id)\
            .execute()
        
        if not transactions.data:
            return {
                "gross_collected_cents": 0,
                "scan_fee_total_cents": 0,
                "vendor_net_cents": 0,
                "total_scans": 0,
                "status": "NO_ACTIVITY",
                "breakdown": {
                    "valid_pct_cents": 0,
                    "vendor_pct_cents": 0,
                    "pool_pct_cents": 0,
                    "promoter_pct_cents": 0
                }
            }
        
        # Calculate totals
        total_scans = len(set(tx.get("metadata", {}).get("pass_id") for tx in transactions.data if tx.get("metadata")))
        
        # Group by split type
        breakdown = {
            "valid_pct_cents": 0,
            "vendor_pct_cents": 0,
            "pool_pct_cents": 0,
            "promoter_pct_cents": 0
        }
        
        for tx in transactions.data:
            vendor_name = tx.get("vendor_name", "")
            amount = tx.get("amount_cents", 0)
            
            if "valid" in vendor_name.lower():
                breakdown["valid_pct_cents"] += amount
            elif "vendor" in vendor_name.lower():
                breakdown["vendor_pct_cents"] += amount
            elif "pool" in vendor_name.lower():
                breakdown["pool_pct_cents"] += amount
            elif "promoter" in vendor_name.lower():
                breakdown["promoter_pct_cents"] += amount
        
        # Calculate totals
        gross_collected = sum(breakdown.values())
        scan_fee_total = gross_collected  # All fees collected from scans
        vendor_net = breakdown["vendor_pct_cents"]  # Vendor's portion
        
        # Determine status (simplified - in production would check payout records)
        status = "PENDING" if vendor_net > 0 else "NO_ACTIVITY"
        
        return {
            "gross_collected_cents": gross_collected,
            "scan_fee_total_cents": scan_fee_total,
            "vendor_net_cents": vendor_net,
            "total_scans": total_scans,
            "status": status,
            "breakdown": breakdown,
            "gross_collected_dollars": gross_collected / 100.0,
            "scan_fee_total_dollars": scan_fee_total / 100.0,
            "vendor_net_dollars": vendor_net / 100.0
        }
        
    except Exception as e:
        logger.error(f"Error fetching financial distribution: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch financial distribution")
