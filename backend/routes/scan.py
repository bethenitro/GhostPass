from fastapi import APIRouter, Depends, HTTPException, Header
from supabase import Client
from database import get_db
from models import ScanRequest, ScanResponse
from datetime import datetime, timezone
import logging
import uuid

router = APIRouter(prefix="/scan", tags=["Scan"])
logger = logging.getLogger(__name__)

def verify_scanner_auth(authorization: str = Header(...)):
    """Verify scanner/gateway authentication"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    # In production, validate scanner API key here
    # For now, just check format
    token = authorization.replace("Bearer ", "")
    if len(token) < 10:  # Basic validation
        raise HTTPException(status_code=401, detail="Invalid scanner token")
    
    return token

@router.post("/validate", response_model=ScanResponse)
def validate_scan(
    req: ScanRequest,
    scanner_token: str = Depends(verify_scanner_auth),
    db: Client = Depends(get_db)
):
    """Validate GhostPass scan and process fees"""
    try:
        # 1. Validate gateway exists and is enabled
        gateway_response = db.table("gateway_points")\
            .select("*")\
            .eq("id", req.gateway_id)\
            .single()\
            .execute()
        
        if not gateway_response.data:
            return ScanResponse(
                status="DENIED",
                receipt_id=req.gateway_id,
                message="Invalid gateway location"
            )
        
        gateway = gateway_response.data
        gateway_name = gateway.get("name", "Unknown Location")
        gateway_type = gateway.get("type", "ENTRY_POINT")
        
        # 2. Check if gateway is enabled
        if gateway.get("status") != "ENABLED":
            return ScanResponse(
                status="DENIED",
                receipt_id=req.gateway_id,
                message=f"Access denied: {gateway_name} is currently disabled"
            )
        
        # 3. For INTERNAL_AREA, check if it accepts GhostPass
        if gateway_type == "INTERNAL_AREA":
            if not gateway.get("accepts_ghostpass", True):
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message=f"GhostPass not accepted at {gateway_name}"
                )
        
        # 4. For TABLE_SEAT, check linked area status and accepts_ghostpass
        if gateway_type == "TABLE_SEAT":
            linked_area_id = gateway.get("linked_area_id")
            if not linked_area_id:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Table configuration error: no linked area"
                )
            
            # Check linked area
            linked_area_response = db.table("gateway_points")\
                .select("*")\
                .eq("id", linked_area_id)\
                .single()\
                .execute()
            
            if not linked_area_response.data:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Table configuration error: linked area not found"
                )
            
            linked_area = linked_area_response.data
            
            # Check if linked area is enabled
            if linked_area.get("status") != "ENABLED":
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message=f"Access denied: {linked_area.get('name', 'Area')} is currently closed"
                )
            
            # Check if linked area accepts GhostPass
            if not linked_area.get("accepts_ghostpass", True):
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message=f"GhostPass not accepted in {linked_area.get('name', 'this area')}"
                )
        
        # 5. Vaporize expired sessions (RPC call with empty params)
        try:
            result = db.rpc("vaporize_expired_sessions", {}).execute()
            # The RPC function returns an integer count directly
            if result and hasattr(result, 'data') and result.data is not None:
                vaporized_count = result.data
                logger.info(f"Vaporized {vaporized_count} expired sessions")
        except Exception as e:
            # Log the error but continue - vaporization is not critical for scanning
            logger.debug(f"Vaporize function call had an issue: {e}")
        
        # 6. Check if this is a session scan (starts with ghostsession:)
        is_session_scan = str(req.pass_id).startswith("ghostsession:")
        
        if is_session_scan:
            # Handle session validation
            session_id = str(req.pass_id).replace("ghostsession:", "")
            
            session_response = db.table("sessions")\
                .select("*")\
                .eq("id", session_id)\
                .eq("status", "ACTIVE")\
                .single()\
                .execute()
            
            if not session_response.data:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Session not found or vaporized"
                )
            
            session = session_response.data
            
            # Check if session has vaporized
            vaporizes_at = datetime.fromisoformat(session['vaporizes_at'].replace('Z', '+00:00'))
            current_time = datetime.now(timezone.utc)
            
            if vaporizes_at < current_time:
                # Mark as vaporized
                db.table("sessions")\
                    .update({"status": "VAPORIZED"})\
                    .eq("id", session_id)\
                    .execute()
                
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Session has vaporized"
                )
            
            # Set venue_id on first scan if not set
            if not session.get('venue_id'):
                db.table("sessions")\
                    .update({"venue_id": req.venue_id})\
                    .eq("id", session_id)\
                    .execute()
            
            user_id = session['user_id']
            
        else:
            # Handle traditional pass validation
            # 2. Update expired passes first (RPC call with empty params)
            try:
                db.rpc("update_expired_passes", {}).execute()
            except Exception as e:
                logger.warning(f"Could not call update_expired_passes function: {e}")
            
            # 3. Fetch the pass
            pass_response = db.table("ghost_passes")\
                .select("*")\
                .eq("id", str(req.pass_id))\
                .single()\
                .execute()
            
            if not pass_response.data:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Pass not found"
                )
            
            ghost_pass = pass_response.data
            
            # 4. Check if pass is active and not expired
            expires_at = datetime.fromisoformat(ghost_pass['expires_at'].replace('Z', '+00:00'))
            current_time = datetime.now(timezone.utc)
            
            if ghost_pass['status'] != 'ACTIVE':
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Pass is not active"
                )
            
            if expires_at < current_time:
                # Mark as expired
                db.table("ghost_passes")\
                    .update({"status": "EXPIRED"})\
                    .eq("id", str(req.pass_id))\
                    .execute()
                
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Pass has expired"
                )
            
            user_id = ghost_pass["user_id"]
        
        # 5. Process fees (skip for sessions - they're free)
        if not is_session_scan:
            # Fetch fee configuration for venue
            fee_config_response = db.table("fee_configs")\
                .select("*")\
                .eq("venue_id", req.venue_id)\
                .single()\
                .execute()
            
            if not fee_config_response.data:
                logger.warning(f"No fee config found for venue: {req.venue_id}")
                # Use default split if no config found
                fee_config = {
                    "valid_pct": 70.0,
                    "vendor_pct": 15.0,
                    "pool_pct": 10.0,
                    "promoter_pct": 5.0
                }
            else:
                fee_config = fee_config_response.data
            
            # 6. Calculate and log fee splits
            # For demo, using a base amount of $1.00 per scan
            base_amount_cents = 100
            
            splits = {
                "valid": int(base_amount_cents * fee_config["valid_pct"] / 100),
                "vendor": int(base_amount_cents * fee_config["vendor_pct"] / 100),
                "pool": int(base_amount_cents * fee_config["pool_pct"] / 100),
                "promoter": int(base_amount_cents * fee_config["promoter_pct"] / 100)
            }
            
            # Get user's wallet for logging
            wallet_response = db.table("wallets")\
                .select("id")\
                .eq("user_id", user_id)\
                .single()\
                .execute()
            
            if wallet_response.data:
                wallet_id = wallet_response.data["id"]
                
                # Get venue/vendor name (use venue_id as fallback)
                venue_name = req.venue_id  # In production, would fetch from venues table
                
                # Get current wallet balance for transaction ledger
                wallet_balance_response = db.table("wallets")\
                    .select("balance_cents")\
                    .eq("id", wallet_id)\
                    .single()\
                    .execute()
                
                current_balance = wallet_balance_response.data["balance_cents"] if wallet_balance_response.data else 0
                
                # Log fee transactions with vendor name and balance snapshots
                fee_transactions = []
                running_balance = current_balance
                
                for split_type, amount in splits.items():
                    fee_transactions.append({
                        "wallet_id": wallet_id,
                        "type": "FEE",
                        "amount_cents": amount,
                        "balance_before_cents": running_balance,
                        "balance_after_cents": running_balance,  # Fees don't affect user balance
                        "vendor_name": f"{venue_name} - {split_type}",  # Include split type in vendor name
                        "gateway_id": req.gateway_id,
                        "gateway_name": gateway_name,  # Human-readable location name
                        "gateway_type": gateway_type,  # Gateway type for categorization
                        "venue_id": req.venue_id,
                        "metadata": {
                            "pass_id": str(req.pass_id),
                            "split_type": split_type,
                            "scan_timestamp": current_time.isoformat()
                        }
                    })
                
                # Insert all fee transactions
                db.table("transactions").insert(fee_transactions).execute()
        
        # 7. For sessions, vaporize immediately after successful scan
        if is_session_scan:
            # Record scan metric before vaporizing
            try:
                db.rpc(
                    "record_gateway_metric",
                    {
                        "p_gateway_point_id": req.gateway_id,
                        "p_metric_type": "QR_SCAN",
                        "p_amount_cents": 0,
                        "p_metadata": {
                            "session_id": session_id,
                            "scan_timestamp": current_time.isoformat(),
                            "is_session": True
                        }
                    }
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to record session scan metric: {e}")
            
            db.table("sessions")\
                .update({"status": "VAPORIZED"})\
                .eq("id", session_id)\
                .execute()
            
            return ScanResponse(
                status="APPROVED",
                receipt_id=req.gateway_id,
                message=f"Session validated and vaporized. No reuse possible."
            )
        
        # 8. Record QR scan metric for entry points
        try:
            db.rpc(
                "record_gateway_metric",
                {
                    "p_gateway_point_id": req.gateway_id,
                    "p_metric_type": "QR_SCAN",
                    "p_amount_cents": 0,
                    "p_metadata": {
                        "pass_id": str(req.pass_id),
                        "scan_timestamp": current_time.isoformat(),
                        "is_session": is_session_scan
                    }
                }
            ).execute()
        except Exception as e:
            logger.warning(f"Failed to record scan metric: {e}")
        
        # 9. Return approval for traditional passes
        return ScanResponse(
            status="APPROVED",
            receipt_id=req.gateway_id,
            message=f"Pass valid until {expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        
    except Exception as e:
        logger.error(f"Scan validation error: {e}")
        return ScanResponse(
            status="DENIED",
            receipt_id=req.gateway_id,
            message="System error during validation"
        )

@router.get("/venue/{venue_id}/stats")
def get_venue_stats(
    venue_id: str,
    scanner_token: str = Depends(verify_scanner_auth),
    db: Client = Depends(get_db)
):
    """Get venue scanning statistics"""
    try:
        # Count scans for this venue in the last 24 hours
        stats_response = db.table("transactions")\
            .select("*", count="exact")\
            .eq("venue_id", venue_id)\
            .eq("type", "FEE")\
            .gte("timestamp", "now() - interval '24 hours'")\
            .execute()
        
        return {
            "venue_id": venue_id,
            "scans_24h": stats_response.count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Venue stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch venue stats")
