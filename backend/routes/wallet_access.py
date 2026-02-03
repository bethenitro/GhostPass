"""
Ghost Pass Wallet Access API Routes

Handles automatic wallet surfacing, PWA behavior, and persistent session management
for zero-friction access in intoxicated, crowded, low-light conditions.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from database import get_db
from ghost_pass_wallet_access import wallet_access_manager
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallet-access", tags=["wallet-access"])


class WalletSurfaceRequest(BaseModel):
    """Request to surface wallet after successful scan"""
    wallet_binding_id: str = Field(..., description="User's wallet binding ID")
    device_fingerprint: str = Field(..., description="Device fingerprint for security")
    event_id: Optional[str] = Field(None, description="Optional event ID")
    venue_id: Optional[str] = Field(None, description="Optional venue ID")
    event_name: Optional[str] = Field("Event", description="Event name for display")
    venue_name: Optional[str] = Field("Venue", description="Venue name for display")


class WalletSurfaceResponse(BaseModel):
    """Response with wallet surface instructions"""
    status: str
    message: str
    wallet_access: Optional[Dict[str, Any]] = None
    force_surface: bool = False
    pwa_manifest_url: Optional[str] = None
    instructions: Optional[Dict[str, Any]] = None


class SessionAccessRequest(BaseModel):
    """Request to access existing wallet session"""
    session_id: str = Field(..., description="Wallet session ID")
    device_fingerprint: str = Field(..., description="Device fingerprint for verification")


class PWAManifestResponse(BaseModel):
    """PWA manifest response"""
    manifest: Dict[str, Any]


class BrightnessControlResponse(BaseModel):
    """Brightness control configuration response"""
    config: Dict[str, Any]


@router.post("/surface-wallet", response_model=WalletSurfaceResponse)
async def surface_wallet_after_scan(request: WalletSurfaceRequest):
    """
    Surface wallet after first successful scan.
    
    REQUIREMENT: After the user's first successful scan and wallet funding/use, 
    the Ghost Pass wallet must automatically appear on the user's device and 
    remain immediately accessible for the duration of the event.
    """
    try:
        # Check if user already has an active session
        existing_session = wallet_access_manager.find_active_session(
            request.wallet_binding_id,
            request.device_fingerprint
        )
        
        if existing_session:
            # Returning user - don't force surface again
            response = wallet_access_manager.handle_returning_access(
                existing_session.session_id,
                request.device_fingerprint
            )
            
            return WalletSurfaceResponse(
                status=response["status"],
                message=response["message"],
                wallet_access=response.get("wallet_access"),
                force_surface=response["force_surface"]
            )
        else:
            # First time - create session and force surface
            response = wallet_access_manager.handle_first_successful_scan(
                wallet_binding_id=request.wallet_binding_id,
                device_fingerprint=request.device_fingerprint,
                event_id=request.event_id,
                venue_id=request.venue_id
            )
            
            return WalletSurfaceResponse(
                status=response["status"],
                message=response["message"],
                wallet_access=response.get("wallet_access"),
                force_surface=response["force_surface"],
                pwa_manifest_url=response.get("pwa_manifest_url"),
                instructions=response.get("instructions")
            )
            
    except Exception as e:
        logger.error(f"Failed to surface wallet: {e}")
        raise HTTPException(status_code=500, detail="Failed to surface wallet")


@router.post("/access-session", response_model=WalletSurfaceResponse)
async def access_wallet_session(request: SessionAccessRequest):
    """
    Access existing wallet session.
    
    REQUIREMENT: The wallet must be reopenable instantly at any time during the event.
    """
    try:
        response = wallet_access_manager.handle_returning_access(
            request.session_id,
            request.device_fingerprint
        )
        
        return WalletSurfaceResponse(
            status=response["status"],
            message=response["message"],
            wallet_access=response.get("wallet_access"),
            force_surface=response["force_surface"]
        )
        
    except Exception as e:
        logger.error(f"Failed to access wallet session: {e}")
        raise HTTPException(status_code=500, detail="Failed to access wallet session")


@router.get("/pwa-manifest/{session_id}", response_model=PWAManifestResponse)
async def get_pwa_manifest(session_id: str):
    """
    Get PWA manifest for wallet session.
    
    REQUIREMENT: This can be implemented via a forced PWA add-to-home-screen flow.
    """
    try:
        session = wallet_access_manager.get_wallet_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        manifest = wallet_access_manager.generate_pwa_manifest(session)
        
        return PWAManifestResponse(manifest=manifest)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get PWA manifest: {e}")
        raise HTTPException(status_code=500, detail="Failed to get PWA manifest")


@router.get("/brightness-control", response_model=BrightnessControlResponse)
async def get_brightness_control_config():
    """
    Get brightness control configuration for QR scanning.
    
    REQUIREMENT: Ghost pass QR code must take over brightness of phone when 
    accessed for proper low light scanning environments.
    """
    try:
        config = wallet_access_manager.create_brightness_control_config()
        
        return BrightnessControlResponse(config=config)
        
    except Exception as e:
        logger.error(f"Failed to get brightness control config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get brightness control config")


@router.post("/cleanup-sessions")
async def cleanup_expired_sessions():
    """Cleanup expired wallet sessions"""
    try:
        cleaned_count = wallet_access_manager.cleanup_expired_sessions()
        
        return {
            "status": "success",
            "message": f"Cleaned up {cleaned_count} expired sessions"
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup sessions")


@router.get("/session/{session_id}/status")
async def get_session_status(session_id: str):
    """Get wallet session status"""
    try:
        session = wallet_access_manager.get_wallet_session(session_id)
        
        if not session:
            return {
                "status": "not_found",
                "message": "Session not found or expired"
            }
        
        return {
            "status": "active",
            "session_id": session.session_id,
            "wallet_binding_id": session.wallet_binding_id,
            "created_at": session.created_at.isoformat(),
            "last_accessed": session.last_accessed.isoformat(),
            "expires_at": session.expires_at.isoformat(),
            "is_active": session.is_active,
            "force_surface": session.force_surface
        }
        
    except Exception as e:
        logger.error(f"Failed to get session status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get session status")


@router.post("/session/{session_id}/deactivate")
async def deactivate_session(session_id: str):
    """Deactivate wallet session"""
    try:
        success = wallet_access_manager.deactivate_session(session_id)
        
        if success:
            return {
                "status": "success",
                "message": "Session deactivated"
            }
        else:
            return {
                "status": "not_found",
                "message": "Session not found"
            }
            
    except Exception as e:
        logger.error(f"Failed to deactivate session: {e}")
        raise HTTPException(status_code=500, detail="Failed to deactivate session")