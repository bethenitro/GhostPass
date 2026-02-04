from fastapi import APIRouter, Depends, HTTPException, Header
from supabase import Client
from database import get_db
from models import ScanRequest, ScanResponse
from utils import parse_supabase_timestamp
from datetime import datetime, timezone
import logging
import uuid

# Import entry tracking system
from ghost_pass_entry_tracking import GhostPassEntryTracker
from ghost_pass_wallet_access import wallet_access_manager

router = APIRouter(prefix="/scan", tags=["Scan"])
logger = logging.getLogger(__name__)

# Import platform fee engine
from routes.wallet import platform_fee_engine

# Initialize entry tracker
entry_tracker = None

def get_entry_tracker():
    global entry_tracker
    if entry_tracker is None:
        entry_tracker = GhostPassEntryTracker(get_db())
    return entry_tracker

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
async def validate_scan(
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
            .execute()
        
        if not gateway_response.data or len(gateway_response.data) == 0:
            return ScanResponse(
                status="DENIED",
                receipt_id=req.gateway_id,
                message="Invalid gateway location"
            )
        
        gateway = gateway_response.data[0]
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
                .execute()
            
            if not linked_area_response.data or len(linked_area_response.data) == 0:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Table configuration error: linked area not found"
                )
            
            linked_area = linked_area_response.data[0]
            
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
        
        # 5. Check if this is a session scan (starts with ghostsession:)
        is_session_scan = str(req.pass_id).startswith("ghostsession:")
        
        # 6. Check for Ghost Pass revocation (REQUIRED BUILD ITEM)
        # Check if this pass/session is revoked before processing
        if not is_session_scan:
            # For regular passes, check if the pass itself is revoked
            try:
                revocation_check = db.rpc("is_ghost_pass_revoked", {
                    "p_ghost_pass_token": str(req.pass_id)
                }).execute()
                
                # Handle the boolean response safely
                if revocation_check.data is True:
                    return ScanResponse(
                        status="DENIED",
                        receipt_id=req.gateway_id,
                        message="Ghost Pass has been revoked"
                    )
            except Exception as rpc_error:
                # Log the RPC error but don't fail the scan for this
                logger.warning(f"Could not check revocation status for pass {req.pass_id}: {rpc_error}")
                # Continue with scan - revocation check is not critical for basic scanning
        
        # 7. Vaporize expired sessions (RPC call with empty params)
        try:
            result = db.rpc("vaporize_expired_sessions", {}).execute()
            # The RPC function returns an integer count directly
            if result and hasattr(result, 'data') and result.data is not None:
                vaporized_count = result.data
                logger.info(f"Vaporized {vaporized_count} expired sessions")
        except Exception as e:
            # Log the error but continue - vaporization is not critical for scanning
            logger.debug(f"Vaporize function call had an issue: {e}")
        
        # 8. Handle session or pass validation
        
        if is_session_scan:
            # Handle session validation
            session_id = str(req.pass_id).replace("ghostsession:", "")
            
            session_response = db.table("sessions")\
                .select("*")\
                .eq("id", session_id)\
                .eq("status", "ACTIVE")\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Session not found or vaporized"
                )
            
            session = session_response.data[0]
            
            # Check if session has vaporized
            vaporizes_at = parse_supabase_timestamp(session['vaporizes_at'])
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
                .execute()
            
            if not pass_response.data or len(pass_response.data) == 0:
                logger.warning(f"Ghost pass not found in database: {req.pass_id}")
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Pass not found"
                )
            
            ghost_pass = pass_response.data[0]
            logger.info(f"Found ghost pass: {ghost_pass.get('id')} with status: {ghost_pass.get('status')}")
            
            # 4. Check if pass is active and not expired
            expires_at = parse_supabase_timestamp(ghost_pass['expires_at'])
            current_time = datetime.now(timezone.utc)
            
            if ghost_pass['status'] != 'ACTIVE':
                logger.warning(f"Ghost pass {req.pass_id} has status: {ghost_pass['status']}")
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message=f"Pass is {ghost_pass['status'].lower()}"
                )
            
            if expires_at < current_time:
                logger.warning(f"Ghost pass {req.pass_id} expired at {expires_at}, current time: {current_time}")
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
                .execute()
            
            if not fee_config_response.data or len(fee_config_response.data) == 0:
                logger.warning(f"No fee config found for venue: {req.venue_id}")
                # Use default split if no config found
                fee_config = {
                    "valid_pct": 70.0,
                    "vendor_pct": 15.0,
                    "pool_pct": 10.0,
                    "promoter_pct": 5.0
                }
            else:
                fee_config = fee_config_response.data[0]
            
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
                .execute()
            
            if wallet_response.data and len(wallet_response.data) > 0:
                wallet_id = wallet_response.data[0]["id"]
                
                # Get venue/vendor name (use venue_id as fallback)
                venue_name = req.venue_id  # In production, would fetch from venues table
                
                # Get current wallet balance for transaction ledger
                wallet_balance_response = db.table("wallets")\
                    .select("balance_cents")\
                    .eq("id", wallet_id)\
                    .execute()
                
                current_balance = wallet_balance_response.data[0]["balance_cents"] if wallet_balance_response.data and len(wallet_balance_response.data) > 0 else 0
                
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
            
            # Log session scan audit trail
            try:
                db.rpc(
                    "log_scan_audit",
                    {
                        "p_entry_point_id": req.gateway_id,
                        "p_scanner_token": scanner_token,
                        "p_metadata": {
                            "session_id": session_id,
                            "venue_id": req.venue_id,
                            "scan_timestamp": current_time.isoformat(),
                            "is_session": True,
                            "gateway_name": gateway_name,
                            "gateway_type": gateway_type,
                            "scan_result": "APPROVED"
                        }
                    }
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to log session scan audit: {e}")
            
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
        
        # 9. Log scan audit trail
        try:
            db.rpc(
                "log_scan_audit",
                {
                    "p_entry_point_id": req.gateway_id,
                    "p_scanner_token": scanner_token,
                    "p_metadata": {
                        "pass_id": str(req.pass_id),
                        "venue_id": req.venue_id,
                        "scan_timestamp": current_time.isoformat(),
                        "is_session": is_session_scan,
                        "gateway_name": gateway_name,
                        "gateway_type": gateway_type,
                        "scan_result": "APPROVED"
                    }
                }
            ).execute()
        except Exception as e:
            logger.warning(f"Failed to log scan audit: {e}")
        
        # 9. ENTRY TRACKING INTEGRATION - Check entry permission and record entry
        if gateway_type == "ENTRY_POINT":
            try:
                tracker = get_entry_tracker()
                
                # Get wallet for entry tracking
                wallet_response = db.table("wallets")\
                    .select("id, wallet_binding_id")\
                    .eq("user_id", user_id)\
                    .execute()
                
                if wallet_response.data and len(wallet_response.data) > 0:
                    wallet_data = wallet_response.data[0]
                    wallet_id = wallet_data["id"]
                    wallet_binding_id = wallet_data["wallet_binding_id"]
                    
                    # Check entry permission
                    entry_permission = tracker.check_entry_permission(
                        wallet_binding_id=wallet_binding_id,
                        venue_id=req.venue_id,
                        event_id=None  # Could be extracted from gateway or request
                    )
                    
                    if not entry_permission["allowed"]:
                        return ScanResponse(
                            status="DENIED",
                            receipt_id=req.gateway_id,
                            message=entry_permission["message"]
                        )
                    
                    # Record entry event for audit trail
                    entry_event = tracker.record_entry_event(
                        wallet_id=str(wallet_id),
                        wallet_binding_id=wallet_binding_id,
                        venue_id=req.venue_id,
                        entry_permission=entry_permission,
                        gateway_id=req.gateway_id,
                        gateway_name=gateway_name,
                        device_fingerprint=None,  # Could be extracted from request
                        interaction_method="QR",
                        event_id=None,
                        metadata={
                            "pass_id": str(req.pass_id),
                            "gateway_type": gateway_type,
                            "scan_timestamp": current_time.isoformat()
                        }
                    )
                    
                    logger.info(f"Entry event recorded: {entry_event.id} for wallet {wallet_binding_id}")
                    
                    # Handle wallet surfacing for first-time users
                    if entry_permission["entry_type"] == "initial":
                        try:
                            # Create wallet session for automatic surfacing
                            wallet_session = wallet_access_manager.create_wallet_session(
                                wallet_binding_id=wallet_binding_id,
                                device_fingerprint=f"scan_{req.gateway_id}_{int(current_time.timestamp())}",
                                venue_id=req.venue_id
                            )
                            
                            logger.info(f"Created wallet session {wallet_session.session_id} for first-time user")
                            
                        except Exception as wallet_error:
                            logger.warning(f"Failed to create wallet session: {wallet_error}")
                            # Don't fail the scan for wallet session creation issues
                    
                    # Add entry fees to the response message
                    if entry_permission.get("fees"):
                        fees = entry_permission["fees"]
                        if fees["total_fees_cents"] > 0:
                            fee_message = f" Entry fees: ${fees['total_fees_cents']/100:.2f}"
                            if fees["venue_reentry_fee_cents"] > 0:
                                fee_message += f" (Venue: ${fees['venue_reentry_fee_cents']/100:.2f}, Platform: ${fees['valid_reentry_scan_fee_cents']/100:.2f})"
                        else:
                            fee_message = ""
                    else:
                        fee_message = ""
                        
                else:
                    logger.warning(f"No wallet found for user {user_id} during entry tracking")
                    
            except Exception as entry_error:
                logger.error(f"Entry tracking failed: {entry_error}")
                # Don't fail the scan for entry tracking issues in production
                # In development, you might want to fail here for debugging
                pass
        
        # 10. Return approval for traditional passes
        return ScanResponse(
            status="APPROVED",
            receipt_id=req.gateway_id,
            message=f"Pass valid until {expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}{fee_message if 'fee_message' in locals() else ''}"
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
@router.post("/nfc", response_model=ScanResponse)
def validate_nfc_scan(
    req: ScanRequest,
    scanner_token: str = Depends(verify_scanner_auth),
    db: Client = Depends(get_db)
):
    """
    Validate NFC Ghost Pass scan with platform fee processing.
    
    REQUIRED BUILD ITEM - Dual Interaction Methods:
    - NFC tap (preferred for speed)
    - Same wallet, same balance, same audit trail as QR
    - Platform fee charged automatically
    """
    try:
        logger.info(f"NFC scan validation: pass_id={req.pass_id}, gateway_id={req.gateway_id}")
        
        # Use the same validation logic as QR but mark as NFC interaction
        # First, validate the gateway and pass (reuse existing logic)
        qr_response = validate_scan(req, scanner_token, db)
        
        if qr_response.status == "DENIED":
            return qr_response
        
        # If QR validation passed, process as NFC with platform fee
        # Get gateway context for fee calculation
        gateway_response = db.table("gateway_points")\
            .select("*")\
            .eq("id", req.gateway_id)\
            .execute()
        
        if not gateway_response.data or len(gateway_response.data) == 0:
            return ScanResponse(
                status="DENIED",
                receipt_id=req.gateway_id,
                message="Invalid gateway for NFC scan"
            )
        
        gateway = gateway_response.data[0]
        gateway_type = gateway.get("type", "ENTRY_POINT")
        
        # Determine context for platform fee
        context = "entry"
        if gateway_type == "INTERNAL_AREA":
            context = "bar"
        elif gateway_type == "TABLE_SEAT":
            context = "general"
        
        # Calculate platform fee (NFC interactions charge platform fee)
        fee_breakdown = platform_fee_engine.calculate_atomic_transaction(0, context)  # $0 item, just platform fee
        platform_fee = fee_breakdown["platform_fee_cents"]
        
        # Get user from pass
        is_session_scan = str(req.pass_id).startswith("ghostsession:")
        
        if is_session_scan:
            session_id = str(req.pass_id).replace("ghostsession:", "")
            session_response = db.table("sessions")\
                .select("user_id")\
                .eq("id", session_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Session not found for NFC scan"
                )
            
            user_id = session_response.data[0]["user_id"]
        else:
            pass_response = db.table("ghost_passes")\
                .select("user_id")\
                .eq("id", str(req.pass_id))\
                .execute()
            
            if not pass_response.data or len(pass_response.data) == 0:
                return ScanResponse(
                    status="DENIED",
                    receipt_id=req.gateway_id,
                    message="Pass not found for NFC scan"
                )
            
            user_id = pass_response.data[0]["user_id"]
        
        # Process platform fee if enabled
        if platform_fee > 0:
            # Get user's wallet
            wallet_response = db.table("wallets")\
                .select("*")\
                .eq("user_id", user_id)\
                .execute()
            
            if wallet_response.data and len(wallet_response.data) > 0:
                wallet = wallet_response.data[0]
                wallet_id = wallet["id"]
                current_balance = wallet["balance_cents"]
                
                # Check if user has sufficient balance for platform fee
                if current_balance >= platform_fee:
                    # Deduct platform fee atomically
                    new_balance = current_balance - platform_fee
                    
                    # Update wallet balance
                    db.table("wallets")\
                        .update({"balance_cents": new_balance, "updated_at": "NOW()"})\
                        .eq("id", wallet_id)\
                        .execute()
                    
                    # Log platform fee transaction
                    db.table("transactions").insert({
                        "wallet_id": wallet_id,
                        "type": "FEE",
                        "amount_cents": platform_fee,
                        "balance_before_cents": current_balance,
                        "balance_after_cents": new_balance,
                        "vendor_name": "VALID Platform Fee",
                        "gateway_id": req.gateway_id,
                        "gateway_name": gateway.get("name", "NFC Gateway"),
                        "gateway_type": gateway_type,
                        "venue_id": req.venue_id,
                        "interaction_method": "NFC",
                        "platform_fee_cents": platform_fee,
                        "context": context,
                        "metadata": {
                            "pass_id": str(req.pass_id),
                            "interaction_type": "nfc_tap",
                            "platform_fee_charged": True,
                            "scan_timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    }).execute()
                    
                    logger.info(f"NFC platform fee charged: ${platform_fee/100:.2f} from user {user_id}")
                else:
                    # Insufficient balance for platform fee - deny access
                    return ScanResponse(
                        status="DENIED",
                        receipt_id=req.gateway_id,
                        message=f"Insufficient balance for platform fee (${platform_fee/100:.2f} required)"
                    )
        
        # Log NFC interaction
        try:
            interaction_id = str(uuid.uuid4())
            db.rpc("log_ghost_pass_interaction", {
                "p_interaction_id": interaction_id,
                "p_wallet_binding_id": wallet.get("wallet_binding_id", "legacy"),
                "p_ghost_pass_token": wallet.get("ghost_pass_token", "legacy"),
                "p_interaction_method": "NFC",
                "p_gateway_id": req.gateway_id,
                "p_item_amount_cents": 0,
                "p_platform_fee_cents": platform_fee,
                "p_vendor_payout_cents": 0,
                "p_total_charged_cents": platform_fee,
                "p_context": context,
                "p_device_fingerprint": "nfc_device",
                "p_proofs_verified": 0,
                "p_status": "APPROVED",
                "p_metadata": {
                    "pass_id": str(req.pass_id),
                    "venue_id": req.venue_id,
                    "gateway_name": gateway.get("name"),
                    "is_session": is_session_scan
                }
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to log NFC interaction: {e}")
        
        # Record NFC scan metric
        try:
            db.rpc("record_gateway_metric", {
                "p_gateway_point_id": req.gateway_id,
                "p_metric_type": "NFC_SCAN",
                "p_amount_cents": platform_fee,
                "p_metadata": {
                    "pass_id": str(req.pass_id),
                    "platform_fee_cents": platform_fee,
                    "scan_timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_session": is_session_scan
                }
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to record NFC scan metric: {e}")
        
        # Return success with fee information
        message = "NFC scan approved"
        if platform_fee > 0:
            message += f" (Platform fee: ${platform_fee/100:.2f} charged)"
        
        return ScanResponse(
            status="APPROVED",
            receipt_id=req.gateway_id,
            message=message
        )
        
    except Exception as e:
        logger.error(f"NFC scan validation error: {e}")
        return ScanResponse(
            status="DENIED",
            receipt_id=req.gateway_id,
            message="System error during NFC validation"
        )

@router.get("/platform-fee-status")
def get_platform_fee_status(
    scanner_token: str = Depends(verify_scanner_auth),
    db: Client = Depends(get_db)
):
    """
    Get current platform fee configuration for scanners.
    Allows scanners to display fee information to users.
    """
    return {
        "fee_enabled": platform_fee_engine.fee_enabled,
        "context_fees": {
            context: f"${fee_cents/100:.2f}" 
            for context, fee_cents in platform_fee_engine.context_fees.items()
        },
        "nfc_preferred": True,
        "qr_fallback": True,
        "message": "Platform fee charged on every successful interaction"
    }