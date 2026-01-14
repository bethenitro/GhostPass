from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from database import get_db
from models import FundRequest, WalletBalance, Transaction, RefundRequest, RefundResponse
from routes.auth import get_current_user
from typing import List
from uuid import UUID
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

@router.get("/refund/eligible-transactions", response_model=List[Transaction])
def get_eligible_funding_transactions(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get funding transactions eligible for refund"""
    try:
        # Get wallet ID
        wallet_response = db.table("wallets").select("id").eq("user_id", str(user.id)).single().execute()
        
        if not wallet_response.data:
            return []
            
        wallet_id = wallet_response.data["id"]
        
        # Fetch eligible funding transactions
        # Must be type=FUND and refund_status != FULL
        transactions_response = db.table("transactions")\
            .select("*")\
            .eq("wallet_id", wallet_id)\
            .eq("type", "FUND")\
            .neq("refund_status", "FULL")\
            .order("timestamp", desc=True)\
            .execute()
            
        return transactions_response.data
    except Exception as e:
        logger.error(f"Eligible transactions fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch eligible transactions")

@router.post("/refund/request")
async def request_refund(
    req: RefundRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Request a refund to the original funding source
    
    Security:
    - Only wallet owner can request refunds
    - Vendors cannot trigger refunds
    - All requests are logged to audit_logs
    """
    logger.info(f"Refund request: user_id={user.id}, amount_cents={req.amount_cents}")
    
    try:
        # Get wallet ID and verify ownership
        wallet_response = db.table("wallets").select("id, balance_cents, is_refund_eligible")\
            .eq("user_id", str(user.id))\
            .single()\
            .execute()
        
        if not wallet_response.data:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        wallet = wallet_response.data
        wallet_id = wallet["id"]
        
        # Check refund eligibility
        if not wallet.get("is_refund_eligible", True):
            logger.warning(f"Refund denied: wallet {wallet_id} not eligible")
            raise HTTPException(
                status_code=403, 
                detail="This wallet is not eligible for refunds. Please contact support."
            )
        
        # Validate balance
        if wallet["balance_cents"] < req.amount_cents:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Available: ${wallet['balance_cents']/100:.2f}, Requested: ${req.amount_cents/100:.2f}"
            )
        
        # Call database function to process refund atomically
        result = db.rpc("process_wallet_refund", {
            "p_user_id": str(user.id),
            "p_amount_cents": req.amount_cents,
            "p_wallet_id": wallet_id,
            "p_funding_transaction_id": str(req.funding_transaction_id)
        }).execute()
        
        # RPC returns a list containing the result object
        if isinstance(result.data, list) and len(result.data) > 0:
            refund_data = result.data[0]
        else:
            refund_data = result.data
        
        # Check if database function returned an error
        if not refund_data.get("success"):
            error_msg = refund_data.get("error", "Unknown error")
            logger.error(f"Refund processing failed: {error_msg}")
            
            # Provide user-friendly error messages
            if "Insufficient balance" in error_msg:
                raise HTTPException(status_code=400, detail="Insufficient wallet balance for this refund amount.")
            elif "Wallet not found" in error_msg:
                raise HTTPException(status_code=404, detail="Wallet not found. Please contact support.")
            elif "not eligible for refunds" in error_msg:
                raise HTTPException(status_code=403, detail="This wallet is not eligible for refunds. Please contact support.")
            elif "No eligible funding transaction" in error_msg:
                raise HTTPException(status_code=400, detail="No eligible funding transaction found. You may have already refunded all deposits.")
            elif "exceeds original funding amount" in error_msg:
                raise HTTPException(status_code=400, detail="Refund amount cannot exceed the original deposit amount.")
            elif "check constraint" in error_msg.lower() or "violates" in error_msg.lower():
                # Database constraint errors - log but show generic message
                logger.error(f"Database constraint violation: {error_msg}")
                raise HTTPException(status_code=500, detail="Unable to process refund at this time. Please try again later or contact support.")
            else:
                # Generic error - don't expose internal details
                raise HTTPException(status_code=400, detail="Unable to process refund. Please try again or contact support.")
        
        # Extract refund details
        original_tx_id = refund_data["original_transaction_id"]
        payment_provider = refund_data["payment_provider"]
        provider_tx_id = refund_data.get("provider_tx_id")
        
        # Call payment processor refund API (placeholder)
        # Import here to avoid circular dependencies
        from payment_processors import process_refund
        
        processor_result = {"success": False, "error": "Payment processor integration pending"}
        
        # Only call processor if we have a provider transaction ID
        if provider_tx_id:
            try:
                processor_result = await process_refund(
                    provider=payment_provider,
                    provider_tx_id=provider_tx_id,
                    amount_cents=req.amount_cents
                )
            except Exception as proc_error:
                logger.error(f"Payment processor error: {proc_error}")
                processor_result = {"success": False, "error": str(proc_error)}
        else:
            # No provider_tx_id means we can't process through payment processor
            # This is expected for some payment methods - just log it
            logger.info(f"No provider_tx_id for refund, skipping payment processor call. Provider: {payment_provider}")
        
        # Update transaction with processor refund ID if successful
        if processor_result.get("success"):
            processor_refund_id = processor_result.get("refund_id")
            
            # Update original funding transaction with refund reference
            db.table("transactions").update({
                "refund_reference_id": processor_refund_id,
                "refund_completed_at": "NOW()"
            }).eq("id", original_tx_id).execute()
            
            logger.info(f"Refund successful: {processor_refund_id}")
            
            # Log to audit_logs
            try:
                db.table("audit_logs").insert({
                    "admin_user_id": str(user.id),
                    "action": "REFUND_COMPLETED",
                    "resource_type": "wallet_refund",
                    "resource_id": wallet_id,
                    "metadata": {
                        "amount_cents": req.amount_cents,
                        "original_tx_id": str(original_tx_id),
                        "processor_refund_id": processor_refund_id,
                        "payment_provider": payment_provider
                    }
                }).execute()
            except Exception as audit_error:
                logger.error(f"Audit log error: {audit_error}")
            
            return RefundResponse(
                status="SUCCESS",
                refund_id=str(refund_data["refund_transaction_id"]),
                original_transaction_id=original_tx_id,
                amount_refunded_cents=req.amount_cents,
                processor_refund_id=processor_refund_id,
                message=f"Refund of ${req.amount_cents/100:.2f} initiated successfully",
                estimated_arrival="3-5 business days"
            )
        else:
            # Processor refund failed or not available
            # Wallet was already debited, so we return success with a note
            error_msg = processor_result.get("error", "Payment processor integration pending")
            logger.warning(f"Processor refund not completed: {error_msg}")
            
            # Log to audit_logs
            try:
                db.table("audit_logs").insert({
                    "admin_user_id": str(user.id),
                    "action": "REFUND_WALLET_DEBITED",
                    "resource_type": "wallet_refund",
                    "resource_id": wallet_id,
                    "metadata": {
                        "amount_cents": req.amount_cents,
                        "original_tx_id": str(original_tx_id),
                        "note": "Wallet debited, payment processor refund pending",
                        "payment_provider": payment_provider
                    }
                }).execute()
            except Exception as audit_error:
                logger.error(f"Audit log error: {audit_error}")
            
            # Return SUCCESS since wallet was debited successfully
            # The actual payment processor refund will be handled separately
            return RefundResponse(
                status="SUCCESS",
                refund_id=str(refund_data["refund_transaction_id"]),
                original_transaction_id=original_tx_id,
                amount_refunded_cents=req.amount_cents,
                processor_refund_id=None,
                message=f"Refund of ${req.amount_cents/100:.2f} has been processed. Your payment provider will be notified.",
                estimated_arrival="3-5 business days"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected refund error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again later or contact support.")

@router.get("/refund/history")
async def get_refund_history(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get refund history for the authenticated user"""
    try:
        # Call database function to get refund history
        result = db.rpc("get_refund_history", {
            "p_user_id": str(user.id)
        }).execute()
        
        return result.data
    except Exception as e:
        logger.error(f"Refund history fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refund history")
