from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from database import get_db
from routes.auth import get_current_user, get_admin_user
from routes.admin import log_admin_action
from models import GatewayPoint, GatewayPointCreate, GatewayPointUpdate, GatewayType
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
        
        query = db.table("gateway_points").select("*").eq("venue_id", venue_id)
        
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
            "created_by": str(current_user.id)
        }
        
        # Add optional fields if provided
        if point.number is not None:
            new_point["number"] = point.number
        
        # Always include accepts_ghostpass (defaults to True in model)
        new_point["accepts_ghostpass"] = point.accepts_ghostpass

        
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
