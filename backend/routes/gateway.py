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
