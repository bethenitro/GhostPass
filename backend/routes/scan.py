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
        # 1. Update expired passes first
        db.rpc("update_expired_passes").execute()
        
        # 2. Fetch the pass
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
        
        # 3. Check if pass is active and not expired
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
        
        # 4. Fetch fee configuration for venue
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
        
        # 5. Calculate and log fee splits
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
            .eq("user_id", ghost_pass["user_id"])\
            .single()\
            .execute()
        
        if wallet_response.data:
            wallet_id = wallet_response.data["id"]
            
            # Log fee transactions for audit trail
            fee_transactions = []
            for split_type, amount in splits.items():
                fee_transactions.append({
                    "wallet_id": wallet_id,
                    "type": "FEE",
                    "amount_cents": amount,
                    "gateway_id": req.gateway_id,
                    "venue_id": req.venue_id,
                    "metadata": {
                        "pass_id": str(req.pass_id),
                        "split_type": split_type,
                        "scan_timestamp": current_time.isoformat()
                    }
                })
            
            # Insert all fee transactions
            db.table("transactions").insert(fee_transactions).execute()
        
        # 6. Return approval
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
