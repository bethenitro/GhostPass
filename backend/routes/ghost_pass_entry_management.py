"""
Ghost Pass Entry Management System

Handles all entry-related functionality including:
- Initial entry fees
- Re-entry permissions and fees
- Entry count tracking
- Venue and platform fee configuration
- PWA wallet persistence
- QR brightness control
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from supabase import Client
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel, Field

from database import get_db
from routes.auth import get_current_user
from models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ghost-pass/entry", tags=["ghost-pass-entry"])


class EntryConfiguration(BaseModel):
    """Entry configuration for a venue/event"""
    venue_id: str
    initial_entry_fee_cents: int = Field(..., ge=0, description="Initial entry scan fee")
    re_entry_allowed: bool = Field(default=True, description="Whether re-entry is permitted")
    venue_re_entry_fee_cents: int = Field(default=0, ge=0, description="Venue re-entry price")
    valid_re_entry_fee_cents: int = Field(default=25, ge=0, description="VALID platform re-entry fee")
    pass_purchase_required: bool = Field(default=False, description="Whether pass purchase is mandatory")
    max_entries_per_day: Optional[int] = Field(default=None, ge=1, description="Max entries per day (optional)")


class EntryAttempt(BaseModel):
    """Entry attempt data"""
    wallet_binding_id: str
    venue_id: str
    gateway_id: str
    interaction_method: str = Field(..., regex="^(QR|NFC)$")
    ghost_pass_token: Optional[str] = None
    device_fingerprint: str
    brightness_level: Optional[int] = Field(default=None, ge=0, le=100, description="Screen brightness for QR")


class EntryResult(BaseModel):
    """Entry processing result"""
    status: str  # APPROVED, DENIED, SEE_STAFF
    entry_type: str  # INITIAL, RE_ENTRY
    entry_number: int
    fees_charged: Dict[str, int]  # {"venue_fee": 0, "platform_fee": 25}
    total_fee_cents: int
    message: str
    wallet_balance_after: int
    entry_id: str
    requires_staff: bool = False


class WalletPersistence(BaseModel):
    """Wallet persistence configuration"""
    wallet_binding_id: str
    force_pwa_install: bool = True
    session_duration_hours: int = Field(default=24, ge=1, le=168)  # 1 hour to 1 week
    auto_brightness_control: bool = True
    brightness_override_level: int = Field(default=100, ge=50, le=100)


@router.post("/configure")
async def configure_entry_settings(
    config: EntryConfiguration,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Configure entry settings for a venue/event.
    
    This sets up all entry-related parameters including fees,
    re-entry permissions, and pass requirements.
    """
    try:
        # Verify user has admin permissions for this venue
        if current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Store configuration in database
        config_data = {
            "venue_id": config.venue_id,
            "initial_entry_fee_cents": config.initial_entry_fee_cents,
            "re_entry_allowed": config.re_entry_allowed,
            "venue_re_entry_fee_cents": config.venue_re_entry_fee_cents,
            "valid_re_entry_fee_cents": config.valid_re_entry_fee_cents,
            "pass_purchase_required": config.pass_purchase_required,
            "max_entries_per_day": config.max_entries_per_day,
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": current_user.id
        }
        
        # Upsert entry configuration
        result = db.table("entry_configurations").upsert(
            config_data,
            on_conflict="venue_id"
        ).execute()
        
        # Log configuration change
        await log_entry_config_change(db, current_user.id, config.venue_id, config_data)
        
        logger.info(f"Entry configuration updated for venue {config.venue_id}")
        
        return {
            "status": "success",
            "message": f"Entry configuration updated for venue {config.venue_id}",
            "configuration": config_data
        }
        
    except Exception as e:
        logger.error(f"Entry configuration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to configure entry settings")


@router.post("/attempt")
async def process_entry_attempt(
    entry: EntryAttempt,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Process an entry attempt (initial or re-entry).
    
    This is the main entry point for all Ghost Pass scans.
    Handles both initial entry and re-entry with proper fee calculation.
    """
    try:
        # 1. Get venue entry configuration
        config_result = db.table("entry_configurations").select("*").eq("venue_id", entry.venue_id).execute()
        
        if not config_result.data:
            raise HTTPException(status_code=404, detail="Venue entry configuration not found")
        
        config = config_result.data[0]
        
        # 2. Get user's wallet
        wallet_result = db.table("wallets").select("*").eq("wallet_binding_id", entry.wallet_binding_id).execute()
        
        if not wallet_result.data:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        wallet = wallet_result.data[0]
        
        # 3. Check if pass purchase is required
        if config["pass_purchase_required"] and not entry.ghost_pass_token:
            return EntryResult(
                status="DENIED",
                entry_type="INITIAL",
                entry_number=0,
                fees_charged={},
                total_fee_cents=0,
                message="Ghost Pass purchase required for this venue",
                wallet_balance_after=wallet["balance_cents"],
                entry_id="",
                requires_staff=True
            )
        
        # 4. Get entry history for this wallet at this venue
        entry_history = db.table("entry_logs").select("*").eq("wallet_id", wallet["id"]).eq("venue_id", entry.venue_id).order("timestamp", desc=True).execute()
        
        entry_count = len(entry_history.data) if entry_history.data else 0
        is_initial_entry = entry_count == 0
        
        # 5. Check re-entry permissions
        if not is_initial_entry and not config["re_entry_allowed"]:
            return EntryResult(
                status="DENIED",
                entry_type="RE_ENTRY",
                entry_number=entry_count + 1,
                fees_charged={},
                total_fee_cents=0,
                message="Re-entry not allowed for this venue",
                wallet_balance_after=wallet["balance_cents"],
                entry_id="",
                requires_staff=True
            )
        
        # 6. Check daily entry limits
        if config["max_entries_per_day"]:
            today_entries = [
                entry for entry in entry_history.data 
                if datetime.fromisoformat(entry["timestamp"]).date() == datetime.utcnow().date()
            ]
            
            if len(today_entries) >= config["max_entries_per_day"]:
                return EntryResult(
                    status="DENIED",
                    entry_type="RE_ENTRY" if not is_initial_entry else "INITIAL",
                    entry_number=entry_count + 1,
                    fees_charged={},
                    total_fee_cents=0,
                    message=f"Daily entry limit reached ({config['max_entries_per_day']})",
                    wallet_balance_after=wallet["balance_cents"],
                    entry_id="",
                    requires_staff=True
                )
        
        # 7. Calculate fees
        fees_charged = {}
        total_fee_cents = 0
        
        if is_initial_entry:
            # Initial entry fee
            if config["initial_entry_fee_cents"] > 0:
                fees_charged["initial_entry_fee"] = config["initial_entry_fee_cents"]
                total_fee_cents += config["initial_entry_fee_cents"]
        else:
            # Re-entry fees
            if config["venue_re_entry_fee_cents"] > 0:
                fees_charged["venue_re_entry_fee"] = config["venue_re_entry_fee_cents"]
                total_fee_cents += config["venue_re_entry_fee_cents"]
            
            if config["valid_re_entry_fee_cents"] > 0:
                fees_charged["platform_re_entry_fee"] = config["valid_re_entry_fee_cents"]
                total_fee_cents += config["valid_re_entry_fee_cents"]
        
        # 8. Check wallet balance
        if wallet["balance_cents"] < total_fee_cents:
            return EntryResult(
                status="DENIED",
                entry_type="RE_ENTRY" if not is_initial_entry else "INITIAL",
                entry_number=entry_count + 1,
                fees_charged=fees_charged,
                total_fee_cents=total_fee_cents,
                message=f"Insufficient balance. Required: ${total_fee_cents/100:.2f}, Available: ${wallet['balance_cents']/100:.2f}",
                wallet_balance_after=wallet["balance_cents"],
                entry_id="",
                requires_staff=False
            )
        
        # 9. Process payment and create entry log
        new_balance = wallet["balance_cents"] - total_fee_cents
        
        # Update wallet balance
        db.table("wallets").update({
            "balance_cents": new_balance,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", wallet["id"]).execute()
        
        # Create entry log
        entry_log_data = {
            "wallet_id": wallet["id"],
            "venue_id": entry.venue_id,
            "gateway_id": entry.gateway_id,
            "entry_number": entry_count + 1,
            "entry_type": "INITIAL" if is_initial_entry else "RE_ENTRY",
            "interaction_method": entry.interaction_method,
            "fees_charged": fees_charged,
            "total_fee_cents": total_fee_cents,
            "wallet_balance_before": wallet["balance_cents"],
            "wallet_balance_after": new_balance,
            "device_fingerprint": entry.device_fingerprint,
            "ghost_pass_token": entry.ghost_pass_token,
            "brightness_level": entry.brightness_level,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "APPROVED"
        }
        
        entry_log_result = db.table("entry_logs").insert(entry_log_data).execute()
        entry_id = entry_log_result.data[0]["id"]
        
        # Create transaction record
        if total_fee_cents > 0:
            transaction_data = {
                "wallet_id": wallet["id"],
                "type": "ENTRY_FEE",
                "amount_cents": -total_fee_cents,
                "venue_id": entry.venue_id,
                "gateway_id": entry.gateway_id,
                "metadata": {
                    "entry_id": entry_id,
                    "entry_type": "INITIAL" if is_initial_entry else "RE_ENTRY",
                    "entry_number": entry_count + 1,
                    "fees_breakdown": fees_charged
                },
                "timestamp": datetime.utcnow().isoformat(),
                "balance_before_cents": wallet["balance_cents"],
                "balance_after_cents": new_balance,
                "interaction_method": entry.interaction_method,
                "context": "entry",
                "device_fingerprint": entry.device_fingerprint
            }
            
            db.table("transactions").insert(transaction_data).execute()
        
        # 10. Set up wallet persistence if this is first successful scan
        if is_initial_entry:
            await setup_wallet_persistence(db, entry.wallet_binding_id, entry.venue_id)
        
        logger.info(f"Entry approved: {entry.wallet_binding_id} at {entry.venue_id}, entry #{entry_count + 1}")
        
        return EntryResult(
            status="APPROVED",
            entry_type="INITIAL" if is_initial_entry else "RE_ENTRY",
            entry_number=entry_count + 1,
            fees_charged=fees_charged,
            total_fee_cents=total_fee_cents,
            message=f"Entry approved. Welcome{'back' if not is_initial_entry else ''}!",
            wallet_balance_after=new_balance,
            entry_id=entry_id,
            requires_staff=False
        )
        
    except Exception as e:
        logger.error(f"Entry processing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process entry attempt")


@router.get("/history/{wallet_binding_id}")
async def get_entry_history(
    wallet_binding_id: str,
    venue_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Get entry history for a wallet.
    
    Returns all entry events with timestamps, fees, and entry numbers.
    """
    try:
        # Get wallet
        wallet_result = db.table("wallets").select("*").eq("wallet_binding_id", wallet_binding_id).execute()
        
        if not wallet_result.data:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        wallet = wallet_result.data[0]
        
        # Build query
        query = db.table("entry_logs").select("*").eq("wallet_id", wallet["id"])
        
        if venue_id:
            query = query.eq("venue_id", venue_id)
        
        result = query.order("timestamp", desc=True).limit(limit).execute()
        
        return {
            "wallet_binding_id": wallet_binding_id,
            "total_entries": len(result.data),
            "entries": result.data
        }
        
    except Exception as e:
        logger.error(f"Entry history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get entry history")


@router.post("/wallet/persist")
async def setup_wallet_persistence(
    db: Client,
    wallet_binding_id: str,
    venue_id: str
):
    """
    Set up wallet persistence after first successful scan.
    
    This ensures the Ghost Pass wallet appears on the user's device
    and remains accessible for the duration of the event.
    """
    try:
        persistence_data = {
            "wallet_binding_id": wallet_binding_id,
            "venue_id": venue_id,
            "force_pwa_install": True,
            "session_duration_hours": 24,  # Default 24 hours
            "auto_brightness_control": True,
            "brightness_override_level": 100,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            "status": "ACTIVE"
        }
        
        # Store persistence configuration
        db.table("wallet_persistence").upsert(
            persistence_data,
            on_conflict="wallet_binding_id,venue_id"
        ).execute()
        
        logger.info(f"Wallet persistence configured for {wallet_binding_id}")
        
        return {
            "status": "success",
            "message": "Wallet persistence configured",
            "configuration": persistence_data
        }
        
    except Exception as e:
        logger.error(f"Wallet persistence setup error: {e}")
        raise HTTPException(status_code=500, detail="Failed to setup wallet persistence")


@router.get("/wallet/persistence/{wallet_binding_id}")
async def get_wallet_persistence(
    wallet_binding_id: str,
    venue_id: Optional[str] = None,
    db: Client = Depends(get_db)
):
    """
    Get wallet persistence configuration.
    
    Used by frontend to determine if wallet should be forced
    to appear and remain accessible.
    """
    try:
        query = db.table("wallet_persistence").select("*").eq("wallet_binding_id", wallet_binding_id)
        
        if venue_id:
            query = query.eq("venue_id", venue_id)
        
        result = query.execute()
        
        if not result.data:
            return {
                "wallet_binding_id": wallet_binding_id,
                "persistence_active": False,
                "message": "No active persistence configuration"
            }
        
        persistence = result.data[0]
        
        # Check if still active
        expires_at = datetime.fromisoformat(persistence["expires_at"])
        is_active = datetime.utcnow() < expires_at and persistence["status"] == "ACTIVE"
        
        return {
            "wallet_binding_id": wallet_binding_id,
            "persistence_active": is_active,
            "configuration": persistence,
            "expires_at": persistence["expires_at"],
            "force_pwa_install": persistence["force_pwa_install"],
            "auto_brightness_control": persistence["auto_brightness_control"],
            "brightness_override_level": persistence["brightness_override_level"]
        }
        
    except Exception as e:
        logger.error(f"Get wallet persistence error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wallet persistence")


@router.post("/qr/brightness")
async def control_qr_brightness(
    wallet_binding_id: str,
    brightness_level: int = Field(..., ge=50, le=100),
    db: Client = Depends(get_db)
):
    """
    Control QR code brightness for low-light scanning.
    
    Ghost Pass QR codes must take over phone brightness
    when accessed for proper scanning in dark venues.
    """
    try:
        # Get persistence configuration
        persistence_result = db.table("wallet_persistence").select("*").eq("wallet_binding_id", wallet_binding_id).execute()
        
        if not persistence_result.data:
            raise HTTPException(status_code=404, detail="Wallet persistence not found")
        
        persistence = persistence_result.data[0]
        
        if not persistence["auto_brightness_control"]:
            return {
                "status": "disabled",
                "message": "Auto brightness control is disabled for this wallet"
            }
        
        # Update brightness override
        db.table("wallet_persistence").update({
            "brightness_override_level": brightness_level,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("wallet_binding_id", wallet_binding_id).execute()
        
        # Log brightness change
        db.table("brightness_logs").insert({
            "wallet_binding_id": wallet_binding_id,
            "brightness_level": brightness_level,
            "timestamp": datetime.utcnow().isoformat(),
            "trigger": "manual_override"
        }).execute()
        
        return {
            "status": "success",
            "brightness_level": brightness_level,
            "message": f"QR brightness set to {brightness_level}%"
        }
        
    except Exception as e:
        logger.error(f"QR brightness control error: {e}")
        raise HTTPException(status_code=500, detail="Failed to control QR brightness")


@router.get("/venue/{venue_id}/stats")
async def get_venue_entry_stats(
    venue_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Get entry statistics for a venue.
    
    Provides comprehensive entry analytics including:
    - Total entries vs re-entries
    - Fee collection breakdown
    - Entry patterns by time
    """
    try:
        # Verify user has access to this venue
        if current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Build date filter
        query = db.table("entry_logs").select("*").eq("venue_id", venue_id)
        
        if date_from:
            query = query.gte("timestamp", date_from)
        if date_to:
            query = query.lte("timestamp", date_to)
        
        entries = query.execute().data
        
        # Calculate statistics
        total_entries = len(entries)
        initial_entries = len([e for e in entries if e["entry_type"] == "INITIAL"])
        re_entries = len([e for e in entries if e["entry_type"] == "RE_ENTRY"])
        
        # Fee breakdown
        total_fees_collected = sum(e["total_fee_cents"] for e in entries)
        venue_fees = sum(e["fees_charged"].get("venue_re_entry_fee", 0) for e in entries)
        platform_fees = sum(e["fees_charged"].get("platform_re_entry_fee", 0) + e["fees_charged"].get("initial_entry_fee", 0) for e in entries)
        
        # Entry patterns by hour
        entry_by_hour = {}
        for entry in entries:
            hour = datetime.fromisoformat(entry["timestamp"]).hour
            entry_by_hour[hour] = entry_by_hour.get(hour, 0) + 1
        
        # Unique wallets
        unique_wallets = len(set(e["wallet_id"] for e in entries))
        
        return {
            "venue_id": venue_id,
            "date_range": {
                "from": date_from,
                "to": date_to
            },
            "summary": {
                "total_entries": total_entries,
                "initial_entries": initial_entries,
                "re_entries": re_entries,
                "unique_wallets": unique_wallets,
                "re_entry_rate": (re_entries / total_entries * 100) if total_entries > 0 else 0
            },
            "fees": {
                "total_collected_cents": total_fees_collected,
                "venue_fees_cents": venue_fees,
                "platform_fees_cents": platform_fees,
                "total_collected_dollars": total_fees_collected / 100,
                "venue_fees_dollars": venue_fees / 100,
                "platform_fees_dollars": platform_fees / 100
            },
            "patterns": {
                "entries_by_hour": entry_by_hour
            }
        }
        
    except Exception as e:
        logger.error(f"Venue entry stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get venue entry statistics")


async def log_entry_config_change(db: Client, admin_user_id: str, venue_id: str, config_data: Dict[str, Any]):
    """Log entry configuration changes for audit trail"""
    try:
        db.table("audit_logs").insert({
            "admin_user_id": admin_user_id,
            "action": "UPDATE_ENTRY_CONFIG",
            "resource_type": "entry_configuration",
            "resource_id": venue_id,
            "new_value": config_data,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {"venue_id": venue_id}
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log entry config change: {e}")


# Database migration for new tables
ENTRY_MANAGEMENT_SCHEMA = """
-- Entry configurations table
CREATE TABLE IF NOT EXISTS entry_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT UNIQUE NOT NULL,
    initial_entry_fee_cents INTEGER NOT NULL DEFAULT 0,
    re_entry_allowed BOOLEAN NOT NULL DEFAULT true,
    venue_re_entry_fee_cents INTEGER NOT NULL DEFAULT 0,
    valid_re_entry_fee_cents INTEGER NOT NULL DEFAULT 25,
    pass_purchase_required BOOLEAN NOT NULL DEFAULT false,
    max_entries_per_day INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Entry logs table
CREATE TABLE IF NOT EXISTS entry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    venue_id TEXT NOT NULL,
    gateway_id TEXT,
    entry_number INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INITIAL', 'RE_ENTRY')),
    interaction_method TEXT NOT NULL CHECK (interaction_method IN ('QR', 'NFC')),
    fees_charged JSONB NOT NULL DEFAULT '{}',
    total_fee_cents INTEGER NOT NULL DEFAULT 0,
    wallet_balance_before INTEGER NOT NULL,
    wallet_balance_after INTEGER NOT NULL,
    device_fingerprint TEXT,
    ghost_pass_token TEXT,
    brightness_level INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'APPROVED'
);

-- Wallet persistence table
CREATE TABLE IF NOT EXISTS wallet_persistence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_binding_id TEXT NOT NULL,
    venue_id TEXT NOT NULL,
    force_pwa_install BOOLEAN NOT NULL DEFAULT true,
    session_duration_hours INTEGER NOT NULL DEFAULT 24,
    auto_brightness_control BOOLEAN NOT NULL DEFAULT true,
    brightness_override_level INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    UNIQUE(wallet_binding_id, venue_id)
);

-- Brightness logs table
CREATE TABLE IF NOT EXISTS brightness_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_binding_id TEXT NOT NULL,
    brightness_level INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trigger TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_venue ON entry_logs(wallet_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_timestamp ON entry_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_persistence_binding ON wallet_persistence(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_brightness_logs_binding ON brightness_logs(wallet_binding_id);
"""