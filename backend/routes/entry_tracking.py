"""
Ghost Pass Entry Tracking API Routes

Handles entry count tracking, re-entry permissions, and fee management
for venues with configurable re-entry policies and dual fee structure.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from database import get_db
from ghost_pass_entry_tracking import GhostPassEntryTracker
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/entry-tracking", tags=["entry-tracking"])


class EntryPermissionRequest(BaseModel):
    """Request to check entry permission"""
    wallet_binding_id: str = Field(..., description="User's wallet binding ID")
    venue_id: str = Field(..., description="Venue identifier")
    event_id: Optional[str] = Field(None, description="Optional event identifier")


class EntryPermissionResponse(BaseModel):
    """Response with entry permission result"""
    allowed: bool
    entry_type: str  # "initial" or "re_entry"
    entry_number: int
    fees: Optional[Dict[str, int]] = None
    message: str
    reason: Optional[str] = None


class RecordEntryRequest(BaseModel):
    """Request to record entry event"""
    wallet_id: str = Field(..., description="Wallet ID")
    wallet_binding_id: str = Field(..., description="Wallet binding ID")
    venue_id: str = Field(..., description="Venue identifier")
    entry_permission: Dict[str, Any] = Field(..., description="Entry permission result")
    gateway_id: Optional[str] = Field(None, description="Gateway ID")
    gateway_name: Optional[str] = Field(None, description="Gateway name")
    device_fingerprint: Optional[str] = Field(None, description="Device fingerprint")
    interaction_method: str = Field("QR", description="Interaction method")
    event_id: Optional[str] = Field(None, description="Event identifier")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class RecordEntryResponse(BaseModel):
    """Response after recording entry event"""
    success: bool
    entry_id: str
    message: str


class VenueConfigRequest(BaseModel):
    """Request to update venue entry configuration"""
    venue_id: str = Field(..., description="Venue identifier")
    event_id: Optional[str] = Field(None, description="Optional event identifier")
    re_entry_allowed: bool = Field(..., description="Whether re-entry is allowed")
    initial_entry_fee_cents: int = Field(..., ge=0, description="Initial entry fee in cents")
    venue_reentry_fee_cents: int = Field(0, ge=0, description="Venue re-entry fee in cents")
    valid_reentry_scan_fee_cents: int = Field(0, ge=0, description="VALID re-entry scan fee in cents")
    max_reentries: Optional[int] = Field(None, ge=0, description="Maximum re-entries allowed")
    reentry_time_limit_hours: Optional[int] = Field(None, ge=0, description="Re-entry time limit in hours")


class VenueConfigResponse(BaseModel):
    """Response with venue configuration"""
    venue_id: str
    event_id: Optional[str]
    re_entry_allowed: bool
    initial_entry_fee_cents: int
    venue_reentry_fee_cents: int
    valid_reentry_scan_fee_cents: int
    max_reentries: Optional[int]
    reentry_time_limit_hours: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]


class EntryStatsResponse(BaseModel):
    """Response with entry statistics"""
    venue_id: str
    event_id: Optional[str]
    period: Dict[str, Optional[str]]
    totals: Dict[str, int]
    fees: Dict[str, Any]
    averages: Dict[str, float]


class EntryHistoryResponse(BaseModel):
    """Response with entry history"""
    entries: List[Dict[str, Any]]
    total_count: int


# Initialize entry tracker
entry_tracker = None

def get_entry_tracker():
    global entry_tracker
    if entry_tracker is None:
        from database import get_db
        entry_tracker = GhostPassEntryTracker(get_db())
    return entry_tracker


@router.post("/check-permission", response_model=EntryPermissionResponse)
async def check_entry_permission(request: EntryPermissionRequest):
    """
    Check if wallet can enter venue (initial or re-entry).
    
    REQUIREMENTS IMPLEMENTED:
    - Re-Entry Permission: Each event must have a configuration setting: Re-Entry Allowed Yes or No
    - If re-entry is not allowed, any subsequent scan must be blocked and return a "See Staff / Manager" state
    - If re-entry is allowed, re-entry logic applies with venue and VALID fees
    """
    try:
        tracker = get_entry_tracker()
        
        permission = tracker.check_entry_permission(
            wallet_binding_id=request.wallet_binding_id,
            venue_id=request.venue_id,
            event_id=request.event_id
        )
        
        return EntryPermissionResponse(
            allowed=permission["allowed"],
            entry_type=permission["entry_type"],
            entry_number=permission["entry_number"],
            fees=permission.get("fees"),
            message=permission["message"],
            reason=permission.get("reason")
        )
        
    except Exception as e:
        logger.error(f"Failed to check entry permission: {e}")
        raise HTTPException(status_code=500, detail="Failed to check entry permission")


@router.post("/record-entry", response_model=RecordEntryResponse)
async def record_entry_event(request: RecordEntryRequest):
    """
    Record entry event in audit trail.
    
    REQUIREMENTS IMPLEMENTED:
    - Entry Count Tracking: The system must track and log every entry event per wallet
    - For each entry, log wallet ID, event ID, entry number, entry type, timestamp, and associated fees
    - Entry count must be visible in admin views and stored in the audit trail
    """
    try:
        tracker = get_entry_tracker()
        
        entry_event = tracker.record_entry_event(
            wallet_id=request.wallet_id,
            wallet_binding_id=request.wallet_binding_id,
            venue_id=request.venue_id,
            entry_permission=request.entry_permission,
            gateway_id=request.gateway_id,
            gateway_name=request.gateway_name,
            device_fingerprint=request.device_fingerprint,
            interaction_method=request.interaction_method,
            event_id=request.event_id,
            metadata=request.metadata
        )
        
        return RecordEntryResponse(
            success=True,
            entry_id=entry_event.id,
            message="Entry event recorded successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to record entry event: {e}")
        raise HTTPException(status_code=500, detail="Failed to record entry event")


@router.get("/venue/{venue_id}/config", response_model=VenueConfigResponse)
async def get_venue_config(venue_id: str, event_id: Optional[str] = None):
    """
    Get venue entry configuration.
    
    REQUIREMENTS IMPLEMENTED:
    - Configuration Source: Venue re-entry price is configured by the venue via intake
    - VALID re-entry scan fee is configured by VALID and agreed via intake
    - All fees and permissions must be configurable and not hard-coded
    """
    try:
        tracker = get_entry_tracker()
        
        config = tracker.get_venue_entry_config(venue_id, event_id)
        
        return VenueConfigResponse(
            venue_id=config.venue_id,
            event_id=config.event_id,
            re_entry_allowed=config.re_entry_allowed,
            initial_entry_fee_cents=config.initial_entry_fee_cents,
            venue_reentry_fee_cents=config.venue_reentry_fee_cents,
            valid_reentry_scan_fee_cents=config.valid_reentry_scan_fee_cents,
            max_reentries=config.max_reentries,
            reentry_time_limit_hours=config.reentry_time_limit_hours,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
        
    except Exception as e:
        logger.error(f"Failed to get venue config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get venue config")


@router.post("/venue/{venue_id}/config", response_model=VenueConfigResponse)
async def update_venue_config(venue_id: str, request: VenueConfigRequest):
    """
    Update venue entry configuration.
    
    REQUIREMENTS IMPLEMENTED:
    - Venue Re-Entry Fee (Venue-Controlled): The venue must be able to set a re-entry price
    - VALID Re-Entry Scan Fee (Platform Fee): VALID charges a re-entry scan platform fee
    - Both fees may apply in the same re-entry transaction
    """
    try:
        tracker = get_entry_tracker()
        
        # Create new config
        from ghost_pass_entry_tracking import VenueEntryConfig
        config = VenueEntryConfig(
            venue_id=request.venue_id,
            event_id=request.event_id,
            re_entry_allowed=request.re_entry_allowed,
            initial_entry_fee_cents=request.initial_entry_fee_cents,
            venue_reentry_fee_cents=request.venue_reentry_fee_cents,
            valid_reentry_scan_fee_cents=request.valid_reentry_scan_fee_cents,
            max_reentries=request.max_reentries,
            reentry_time_limit_hours=request.reentry_time_limit_hours,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save config
        saved_config = tracker.save_venue_entry_config(config)
        
        return VenueConfigResponse(
            venue_id=saved_config.venue_id,
            event_id=saved_config.event_id,
            re_entry_allowed=saved_config.re_entry_allowed,
            initial_entry_fee_cents=saved_config.initial_entry_fee_cents,
            venue_reentry_fee_cents=saved_config.venue_reentry_fee_cents,
            valid_reentry_scan_fee_cents=saved_config.valid_reentry_scan_fee_cents,
            max_reentries=saved_config.max_reentries,
            reentry_time_limit_hours=saved_config.reentry_time_limit_hours,
            created_at=saved_config.created_at,
            updated_at=saved_config.updated_at
        )
        
    except Exception as e:
        logger.error(f"Failed to update venue config: {e}")
        raise HTTPException(status_code=500, detail="Failed to update venue config")


@router.get("/wallet/{wallet_binding_id}/history", response_model=EntryHistoryResponse)
async def get_wallet_entry_history(
    wallet_binding_id: str,
    venue_id: Optional[str] = None,
    event_id: Optional[str] = None,
    limit: int = 50
):
    """Get entry history for wallet"""
    try:
        tracker = get_entry_tracker()
        
        entries = tracker.get_wallet_entry_history(
            wallet_binding_id=wallet_binding_id,
            venue_id=venue_id,
            event_id=event_id,
            limit=limit
        )
        
        entry_data = []
        for entry in entries:
            entry_data.append({
                "id": entry.id,
                "wallet_id": entry.wallet_id,
                "wallet_binding_id": entry.wallet_binding_id,
                "event_id": entry.event_id,
                "venue_id": entry.venue_id,
                "entry_number": entry.entry_number,
                "entry_type": entry.entry_type.value,
                "timestamp": entry.timestamp.isoformat(),
                "gateway_id": entry.gateway_id,
                "gateway_name": entry.gateway_name,
                "initial_entry_fee_cents": entry.initial_entry_fee_cents,
                "venue_reentry_fee_cents": entry.venue_reentry_fee_cents,
                "valid_reentry_scan_fee_cents": entry.valid_reentry_scan_fee_cents,
                "total_fees_cents": entry.total_fees_cents,
                "device_fingerprint": entry.device_fingerprint,
                "interaction_method": entry.interaction_method,
                "metadata": entry.metadata
            })
        
        return EntryHistoryResponse(
            entries=entry_data,
            total_count=len(entry_data)
        )
        
    except Exception as e:
        logger.error(f"Failed to get wallet entry history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wallet entry history")


@router.get("/venue/{venue_id}/stats", response_model=EntryStatsResponse)
async def get_venue_entry_stats(
    venue_id: str,
    event_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """
    Get entry statistics for venue/event.
    
    REQUIREMENTS IMPLEMENTED:
    - Entry count must be visible in admin views and stored in the audit trail
    - This is required for security, dispute resolution, and compliance
    """
    try:
        tracker = get_entry_tracker()
        
        stats = tracker.get_venue_entry_stats(
            venue_id=venue_id,
            event_id=event_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return EntryStatsResponse(
            venue_id=stats["venue_id"],
            event_id=stats["event_id"],
            period=stats["period"],
            totals=stats["totals"],
            fees=stats["fees"],
            averages=stats["averages"]
        )
        
    except Exception as e:
        logger.error(f"Failed to get venue entry stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get venue entry stats")


@router.get("/wallet/{wallet_binding_id}/count")
async def get_wallet_entry_count(
    wallet_binding_id: str,
    venue_id: str,
    event_id: Optional[str] = None
):
    """Get current entry count for wallet at venue/event"""
    try:
        tracker = get_entry_tracker()
        
        count = tracker.get_wallet_entry_count(
            wallet_binding_id=wallet_binding_id,
            venue_id=venue_id,
            event_id=event_id
        )
        
        return {
            "wallet_binding_id": wallet_binding_id,
            "venue_id": venue_id,
            "event_id": event_id,
            "entry_count": count
        }
        
    except Exception as e:
        logger.error(f"Failed to get wallet entry count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wallet entry count")