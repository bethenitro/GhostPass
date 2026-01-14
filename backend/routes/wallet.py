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
    """Fund wallet via multiple sources - No amount limits"""
    # Calculate total amount from all sources
    total_amount = sum(s.amount for s in req.sources)
    total_amount_cents = int(total_amount * 100)
    
    logger.info(f"Fund request received: {len(req.sources)} sources, total=${total_amount}, user_id={user.id}")
    
    if total_amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Total amount must be positive")
    
    # Mock bank/payment gateway success for all sources
    # In production, this would be webhook callbacks from each gateway
    bank_success = True  # Mock success for demo
    
    if not bank_success:
        raise HTTPException(status_code=400, detail="Payment gateway declined transaction")
    
    try:
        transaction_ids = []
        
        # Process each funding source separately
        for source_item in req.sources:
            amount_cents = int(source_item.amount * 100)
            
            logger.info(f"Processing source: {source_item.source}, amount=${source_item.amount}")
            
            # Atomic funding via database function
            result = db.rpc("fund_wallet", {
                "p_user_id": str(user.id),
                "p_amount": amount_cents,
                "p_gateway_id": source_item.source
            }).execute()
            
            transaction_ids.append({
                "source": source_item.source,
                "amount_cents": amount_cents,
                "amount_dollars": source_item.amount,
                "transaction_id": result.data
            })
        
        logger.info(f"All funding sources processed successfully. Total: ${total_amount}")
        
        return {
            "status": "funded",
            "total_amount_cents": total_amount_cents,
            "total_amount_dollars": total_amount,
            "sources_processed": len(req.sources),
            "transactions": transaction_ids
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
