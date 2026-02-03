"""
Ghost Pass Wallet Access API Routes

Handles automatic wallet surfacing, PWA behavior, and persistent session management.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from supabase import Client
from typing import Dict, Any, Optional
import logging

from database import get_db
from routes.auth import get_current_user
from ghost_pass_wallet_access import wallet_access_manager, WalletSession
from ghost_pass_entry_tracking import GhostPassEntryTracker
from models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/wallet", tags=["Ghost Pass Wallet Access"])


@router.post("/first-scan-success")
async def handle_first_scan_success(
    request_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Handle first successful scan - create session and force wallet surface.
    
    REQUIREMENT: Ghost Pass wallet must automatically appear on user's device
    and remain immediately accessible for the duration of the event.
    """
    try:
        wallet_binding_id = request_data.get("wallet_binding_id")
        device_fingerprint = request_data.get("device_fingerprint")
        event_id = request_data.get("event_id")
        venue_id = request_data.get("venue_id")
        
        if not wallet_binding_id or not device_fingerprint:
            raise HTTPException(
                status_code=400, 
                detail="wallet_binding_id and device_fingerprint required"
            )
        
        # Handle first successful scan
        response = wallet_access_manager.handle_first_successful_scan(
            wallet_binding_id=wallet_binding_id,
            device_fingerprint=device_fingerprint,
            event_id=event_id,
            venue_id=venue_id
        )
        
        # Update wallet to mark as surfaced
        db.table("wallets").update({
            "wallet_surfaced": True,
            "last_entry_at": "now()"
        }).eq("wallet_binding_id", wallet_binding_id).execute()
        
        logger.info(f"First scan success handled for wallet {wallet_binding_id}")
        
        return response
        
    except Exception as e:
        logger.error(f"First scan success handling failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to handle first scan")


@router.get("/session/{session_id}")
async def get_wallet_session(
    session_id: str,
    device_fingerprint: str,
    db: Client = Depends(get_db)
):
    """
    Get wallet session for returning access.
    
    REQUIREMENT: Wallet must be reopenable instantly at any time during the event.
    """
    try:
        # Handle returning access
        response = wallet_access_manager.handle_returning_access(
            session_id=session_id,
            device_fingerprint=device_fingerprint
        )
        
        if response["status"] == "RETURNING_ACCESS":
            # Update last accessed time in database
            db.table("wallet_sessions").update({
                "last_accessed": "now()"
            }).eq("id", session_id).execute()
        
        return response
        
    except Exception as e:
        logger.error(f"Wallet session retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve wallet session")


@router.get("/pwa-manifest/{session_id}")
async def get_pwa_manifest(
    session_id: str,
    event_name: str = "Event",
    venue_name: str = "Venue"
):
    """
    Get PWA manifest for add-to-home-screen flow.
    
    REQUIREMENT: Forced PWA add-to-home-screen flow for automatic wallet surfacing.
    """
    try:
        session = wallet_access_manager.get_wallet_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        manifest = wallet_access_manager.generate_pwa_manifest(
            session=session,
            event_name=event_name,
            venue_name=venue_name
        )
        
        return JSONResponse(
            content=manifest,
            headers={"Content-Type": "application/manifest+json"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PWA manifest generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PWA manifest")


@router.post("/install-pwa")
async def mark_pwa_installed(
    request_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Mark PWA as installed for wallet"""
    try:
        wallet_binding_id = request_data.get("wallet_binding_id")
        session_id = request_data.get("session_id")
        
        if not wallet_binding_id:
            raise HTTPException(status_code=400, detail="wallet_binding_id required")
        
        # Update wallet PWA status
        db.table("wallets").update({
            "pwa_installed": True
        }).eq("wallet_binding_id", wallet_binding_id).execute()
        
        # Update session if provided
        if session_id:
            db.table("wallet_sessions").update({
                "session_data": db.table("wallet_sessions").select("session_data").eq("id", session_id).execute().data[0]["session_data"] | {"pwa_installed": True}
            }).eq("id", session_id).execute()
        
        logger.info(f"PWA marked as installed for wallet {wallet_binding_id}")
        
        return {"status": "success", "message": "PWA installation recorded"}
        
    except Exception as e:
        logger.error(f"PWA installation marking failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark PWA as installed")


@router.post("/brightness-takeover")
async def handle_brightness_takeover(
    request_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Handle brightness takeover for QR scanning.
    
    REQUIREMENT: Ghost pass QR code must take over brightness of phone 
    when accessed for proper low light scanning environments.
    """
    try:
        action = request_data.get("action")  # "enable" or "disable"
        brightness_level = request_data.get("brightness_level", 100)  # 0-100
        
        if action not in ["enable", "disable"]:
            raise HTTPException(status_code=400, detail="action must be 'enable' or 'disable'")
        
        response = {
            "status": "success",
            "action": action,
            "brightness_config": {
                "takeover_enabled": action == "enable",
                "brightness_level": brightness_level if action == "enable" else None,
                "auto_restore": True,
                "low_light_optimization": True
            },
            "instructions": {
                "method": "DEVICE_BRIGHTNESS_API",
                "fallback": "CSS_FILTER_BRIGHTNESS",
                "duration_ms": 30000,  # 30 seconds max
                "restore_on_exit": True
            }
        }
        
        logger.info(f"Brightness takeover {action} requested")
        return response
        
    except Exception as e:
        logger.error(f"Brightness takeover handling failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to handle brightness takeover")


@router.get("/access-config/{wallet_binding_id}")
async def get_wallet_access_config(
    wallet_binding_id: str,
    device_fingerprint: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get wallet access configuration for frontend"""
    try:
        # Find active session
        session = wallet_access_manager.find_active_session(
            wallet_binding_id=wallet_binding_id,
            device_fingerprint=device_fingerprint
        )
        
        if not session:
            # Check if wallet exists and is bound
            wallet_result = db.table("wallets").select("*").eq(
                "wallet_binding_id", wallet_binding_id
            ).execute()
            
            if not wallet_result.data:
                raise HTTPException(status_code=404, detail="Wallet not found")
            
            wallet = wallet_result.data[0]
            
            if not wallet.get("device_bound"):
                return {
                    "status": "NOT_BOUND",
                    "message": "Device not bound to wallet",
                    "requires_binding": True
                }
            
            # Create new session for returning user
            session = wallet_access_manager.create_wallet_session(
                wallet_binding_id=wallet_binding_id,
                device_fingerprint=device_fingerprint
            )
            session.force_surface = False  # Don't force surface for returning users
        
        # Generate access config
        access_config = wallet_access_manager.generate_wallet_access_config(session)
        
        return {
            "status": "ACCESS_GRANTED",
            "wallet_access": access_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wallet access config retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wallet access config")


@router.post("/cleanup-sessions")
async def cleanup_expired_sessions(
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Cleanup expired wallet sessions"""
    try:
        # Cleanup in-memory sessions
        memory_cleaned = wallet_access_manager.cleanup_expired_sessions()
        
        # Cleanup database sessions
        db.table("wallet_sessions").update({
            "is_active": False
        }).lt("expires_at", "now()").execute()
        
        # Get count of cleaned database sessions
        db_result = db.table("wallet_sessions").select("id", count="exact").eq(
            "is_active", False
        ).lt("expires_at", "now()").execute()
        
        db_cleaned = db_result.count or 0
        
        logger.info(f"Cleaned up {memory_cleaned} memory sessions and {db_cleaned} database sessions")
        
        return {
            "status": "success",
            "memory_sessions_cleaned": memory_cleaned,
            "database_sessions_cleaned": db_cleaned
        }
        
    except Exception as e:
        logger.error(f"Session cleanup failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup sessions")


@router.get("/session-stats")
async def get_session_statistics(
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get wallet session statistics"""
    try:
        # Memory session stats
        active_memory_sessions = len([
            s for s in wallet_access_manager.active_sessions.values()
            if s.is_active
        ])
        
        # Database session stats
        db_result = db.table("wallet_sessions").select("*", count="exact").eq(
            "is_active", True
        ).execute()
        
        active_db_sessions = db_result.count or 0
        
        # PWA installation stats
        pwa_result = db.table("wallets").select("pwa_installed", count="exact").eq(
            "pwa_installed", True
        ).execute()
        
        pwa_installations = pwa_result.count or 0
        
        # Wallet surfacing stats
        surfaced_result = db.table("wallets").select("wallet_surfaced", count="exact").eq(
            "wallet_surfaced", True
        ).execute()
        
        wallets_surfaced = surfaced_result.count or 0
        
        return {
            "active_memory_sessions": active_memory_sessions,
            "active_database_sessions": active_db_sessions,
            "pwa_installations": pwa_installations,
            "wallets_surfaced": wallets_surfaced,
            "timestamp": "now()"
        }
        
    except Exception as e:
        logger.error(f"Session statistics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get session statistics")


@router.post("/force-surface-test")
async def test_force_surface(
    request_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Test endpoint for force surface functionality"""
    try:
        wallet_binding_id = request_data.get("wallet_binding_id", "test_wallet")
        device_fingerprint = request_data.get("device_fingerprint", "test_device")
        
        # Simulate first scan success
        response = wallet_access_manager.handle_first_successful_scan(
            wallet_binding_id=wallet_binding_id,
            device_fingerprint=device_fingerprint,
            event_id="test_event",
            venue_id="test_venue"
        )
        
        return {
            "test_status": "success",
            "force_surface_response": response,
            "message": "Force surface test completed"
        }
        
    except Exception as e:
        logger.error(f"Force surface test failed: {e}")
        raise HTTPException(status_code=500, detail="Force surface test failed")