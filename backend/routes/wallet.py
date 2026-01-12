from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from database import get_db
from models import FundRequest, WalletBalance, Transaction
from routes.auth import get_current_user
from typing import List
import logging

router = APIRouter(prefix="/wallet", tags=["Wallet"])
logger = logging.getLogger(__name__)

@router.get("/balance", response_model=WalletBalance)
def get_balance(
    user=Depends(get_current_user), 
    db: Client = Depends(get_db)
):
    """Get current wallet balance - Source of Truth"""
    try:
        # First, try to get existing wallet
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data:
            # Create wallet if it doesn't exist
            create_response = db.table("wallets").insert({
                "user_id": str(user.id),
                "balance_cents": 0
            }).execute()
            
            if create_response.data:
                wallet = create_response.data[0]
            else:
                raise HTTPException(status_code=500, detail="Failed to create wallet")
        else:
            wallet = wallet_response.data[0]
        
        balance_cents = wallet["balance_cents"]
        
        return WalletBalance(
            balance_cents=balance_cents,
            balance_dollars=balance_cents / 100.0,
            updated_at=wallet["updated_at"]
        )
    except Exception as e:
        logger.error(f"Balance fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch balance")

@router.post("/fund")
def fund_wallet(
    req: FundRequest, 
    user=Depends(get_current_user), 
    db: Client = Depends(get_db)
):
    """Fund wallet via Zelle/Stripe - Mock bank callback"""
    logger.info(f"Fund request received successfully: source={req.source}, amount={req.amount}, user_id={user.id}")
    
    # Convert dollars to cents
    amount_cents = int(req.amount * 100)
    
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Mock bank/payment gateway success
    # In production, this would be a webhook callback
    bank_success = True  # Mock success for demo
    
    if not bank_success:
        raise HTTPException(status_code=400, detail="Payment gateway declined transaction")
    
    try:
        logger.info(f"Calling fund_wallet RPC with user_id={user.id}, amount={amount_cents}, gateway_id={req.source}")
        
        # Atomic funding via database function
        result = db.rpc("fund_wallet", {
            "p_user_id": str(user.id),
            "p_amount": amount_cents,
            "p_gateway_id": req.source
        }).execute()
        
        logger.info(f"Fund wallet RPC result: {result}")
        
        return {
            "status": "funded",
            "amount_cents": amount_cents,
            "amount_dollars": req.amount,
            "source": req.source,
            "transaction_id": result.data
        }
    except Exception as e:
        logger.error(f"Funding error: {e}")
        raise HTTPException(status_code=500, detail=f"Funding failed: {str(e)}")

@router.get("/transactions", response_model=List[Transaction])
def get_transactions(
    user=Depends(get_current_user), 
    db: Client = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get transaction history with pagination"""
    try:
        # Get wallet ID
        wallet_response = db.table("wallets").select("id").eq("user_id", str(user.id)).single().execute()
        
        if not wallet_response.data:
            return []  # No wallet = no transactions
        
        wallet_id = wallet_response.data["id"]
        
        # Fetch transactions with pagination
        transactions_response = db.table("transactions")\
            .select("*")\
            .eq("wallet_id", wallet_id)\
            .order("timestamp", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        return transactions_response.data
    except Exception as e:
        logger.error(f"Transaction fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch transactions")
