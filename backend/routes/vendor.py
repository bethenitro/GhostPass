from fastapi import APIRouter, Depends, HTTPException, Header
from supabase import Client
from database import get_db
from models import PayoutRequest, PayoutResponse
from routes.auth import get_current_user
import logging
import uuid
from datetime import datetime

router = APIRouter(prefix="/vendor", tags=["Vendor"])
logger = logging.getLogger(__name__)

@router.post("/payout/request", response_model=PayoutResponse)
def request_payout(
    req: PayoutRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Request vendor payout - Mock FBO transfer"""
    try:
        # 1. Calculate vendor earnings from fee transactions
        # Get all FEE transactions where metadata contains vendor split
        vendor_earnings_response = db.table("transactions")\
            .select("amount_cents")\
            .eq("type", "FEE")\
            .contains("metadata", {"split_type": "vendor"})\
            .execute()
        
        total_vendor_earnings = sum(
            transaction["amount_cents"] 
            for transaction in vendor_earnings_response.data
        )
        
        if req.amount_cents > total_vendor_earnings:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient vendor balance. Available: ${total_vendor_earnings/100:.2f}, Requested: ${req.amount_cents/100:.2f}"
            )
        
        # 2. Mock FBO (For Benefit Of) transfer
        # In production, this would integrate with banking APIs
        payout_id = str(uuid.uuid4())
        
        # Mock bank transfer success
        transfer_success = True  # In production, call actual banking API
        
        if not transfer_success:
            raise HTTPException(status_code=500, detail="Bank transfer failed")
        
        # 3. Log payout transaction
        wallet_response = db.table("wallets")\
            .select("id")\
            .eq("user_id", str(user.id))\
            .single()\
            .execute()
        
        if wallet_response.data:
            db.table("transactions").insert({
                "wallet_id": wallet_response.data["id"],
                "type": "FEE",
                "amount_cents": -req.amount_cents,  # Negative for payout
                "gateway_id": "payout_system",
                "metadata": {
                    "payout_id": payout_id,
                    "account_details": req.account_details,
                    "payout_timestamp": datetime.utcnow().isoformat()
                }
            }).execute()
        
        return PayoutResponse(
            status="success",
            payout_id=payout_id,
            amount_cents=req.amount_cents
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payout request error: {e}")
        raise HTTPException(status_code=500, detail=f"Payout failed: {str(e)}")

@router.get("/earnings")
def get_vendor_earnings(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get vendor earnings summary"""
    try:
        # Get wallet ID
        wallet_response = db.table("wallets")\
            .select("id")\
            .eq("user_id", str(user.id))\
            .single()\
            .execute()
        
        if not wallet_response.data:
            return {
                "total_earnings_cents": 0,
                "available_payout_cents": 0,
                "total_payouts_cents": 0
            }
        
        wallet_id = wallet_response.data["id"]
        
        # Get vendor fee earnings (positive amounts)
        earnings_response = db.table("transactions")\
            .select("amount_cents")\
            .eq("wallet_id", wallet_id)\
            .eq("type", "FEE")\
            .contains("metadata", {"split_type": "vendor"})\
            .gt("amount_cents", 0)\
            .execute()
        
        total_earnings = sum(
            transaction["amount_cents"] 
            for transaction in earnings_response.data
        )
        
        # Get total payouts (negative amounts)
        payouts_response = db.table("transactions")\
            .select("amount_cents")\
            .eq("wallet_id", wallet_id)\
            .eq("type", "FEE")\
            .contains("metadata", {"payout_id": True})\
            .lt("amount_cents", 0)\
            .execute()
        
        total_payouts = abs(sum(
            transaction["amount_cents"] 
            for transaction in payouts_response.data
        ))
        
        available_payout = total_earnings - total_payouts
        
        return {
            "total_earnings_cents": total_earnings,
            "available_payout_cents": max(0, available_payout),
            "total_payouts_cents": total_payouts,
            "total_earnings_dollars": total_earnings / 100.0,
            "available_payout_dollars": max(0, available_payout) / 100.0,
            "total_payouts_dollars": total_payouts / 100.0
        }
        
    except Exception as e:
        logger.error(f"Vendor earnings error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch vendor earnings")