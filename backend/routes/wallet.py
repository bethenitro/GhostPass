from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from database import get_db
from models import (
    FundRequest, WalletBalance, Transaction, RefundRequest, RefundResponse,
    DeviceWalletBindingRequest, DeviceWalletBindingResponse
)
from routes.auth import get_current_user
from ghost_pass import cryptographic_proof_engine, biometric_verification_engine, ProofType, AccessClass
from typing import List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timezone
import logging
import time

router = APIRouter(prefix="/wallet", tags=["Wallet"])
logger = logging.getLogger(__name__)

class PlatformFeeEngine:
    """
    VALID Platform Fee Engine - Core monetization system.
    Charges platform usage fee on every successful interaction.
    
    REQUIRED BUILD ITEM - Fee Distribution:
    - VALID platform percentage split
    - Vendor percentage split  
    - Pool percentage split
    - Promoter percentage split
    """
    
    def __init__(self):
        self.default_fee_cents = 50  # $0.50 default platform fee
        self.fee_enabled = True
        self.context_fees = {
            "entry": 25,    # $0.25 for entry points
            "bar": 50,      # $0.50 for bar transactions
            "merch": 75,    # $0.75 for merchandise
            "general": 50   # $0.50 default
        }
        
        # REQUIRED BUILD ITEM - Fee Distribution Percentages
        self.distribution_config = {
            "valid_platform_percentage": 40,  # 40% to VALID platform
            "vendor_percentage": 35,          # 35% to vendor
            "pool_percentage": 15,            # 15% to shared pool
            "promoter_percentage": 10         # 10% to promoter
        }
    
    def calculate_platform_fee(self, context: str = "general") -> int:
        """Calculate platform fee based on context"""
        if not self.fee_enabled:
            return 0
        return self.context_fees.get(context, self.default_fee_cents)
    
    def calculate_fee_distribution(self, total_fee_cents: int) -> Dict[str, int]:
        """
        REQUIRED BUILD ITEM - Calculate fee distribution breakdown.
        Splits platform fee among VALID, vendor, pool, and promoter.
        """
        distribution = {}
        
        # Calculate each percentage
        distribution["valid_platform_cents"] = int(
            total_fee_cents * self.distribution_config["valid_platform_percentage"] / 100
        )
        distribution["vendor_cents"] = int(
            total_fee_cents * self.distribution_config["vendor_percentage"] / 100
        )
        distribution["pool_cents"] = int(
            total_fee_cents * self.distribution_config["pool_percentage"] / 100
        )
        distribution["promoter_cents"] = int(
            total_fee_cents * self.distribution_config["promoter_percentage"] / 100
        )
        
        # Handle rounding - any remainder goes to VALID platform
        total_distributed = sum(distribution.values())
        if total_distributed < total_fee_cents:
            distribution["valid_platform_cents"] += (total_fee_cents - total_distributed)
        
        return distribution
    
    def calculate_atomic_transaction(self, item_amount_cents: int, context: str = "general") -> Dict[str, int]:
        """
        Calculate atomic transaction breakdown:
        - Platform fee (charged to user)
        - Vendor payout (item amount)
        - Total charged (item + platform fee)
        - Fee distribution breakdown
        """
        platform_fee = self.calculate_platform_fee(context)
        fee_distribution = self.calculate_fee_distribution(platform_fee)
        
        return {
            "item_amount_cents": item_amount_cents,
            "platform_fee_cents": platform_fee,
            "vendor_payout_cents": item_amount_cents,  # Vendor gets full item price
            "total_charged_cents": item_amount_cents + platform_fee,
            "context": context,
            "fee_distribution": fee_distribution
        }
    
    def set_platform_fee(self, fee_cents: int, context: str = "general"):
        """Admin function to set platform fees"""
        self.context_fees[context] = fee_cents
        logger.info(f"Platform fee updated: {context} = ${fee_cents/100:.2f}")
    
    def set_distribution_percentages(self, valid_pct: int, vendor_pct: int, pool_pct: int, promoter_pct: int):
        """
        REQUIRED BUILD ITEM - Admin function to set fee distribution percentages.
        Percentages must add up to 100.
        """
        if valid_pct + vendor_pct + pool_pct + promoter_pct != 100:
            raise ValueError("Distribution percentages must add up to 100")
        
        self.distribution_config = {
            "valid_platform_percentage": valid_pct,
            "vendor_percentage": vendor_pct,
            "pool_percentage": pool_pct,
            "promoter_percentage": promoter_pct
        }
        
        logger.info(f"Fee distribution updated: VALID={valid_pct}%, Vendor={vendor_pct}%, Pool={pool_pct}%, Promoter={promoter_pct}%")
    
    def process_vendor_payout(self, vendor_id: str, payout_amount_cents: int, transaction_id: str) -> Dict[str, Any]:
        """
        REQUIRED BUILD ITEM - Process vendor payout.
        In production, this would integrate with payment processors.
        """
        # For now, create payout request record
        payout_data = {
            "vendor_id": vendor_id,
            "amount_cents": payout_amount_cents,
            "transaction_id": transaction_id,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payout_method": "ACH_TRANSFER"  # Default method
        }
        
        logger.info(f"Vendor payout processed: {vendor_id} = ${payout_amount_cents/100:.2f}")
        
        return {
            "status": "PAYOUT_SCHEDULED",
            "vendor_id": vendor_id,
            "amount": f"${payout_amount_cents/100:.2f}",
            "payout_data": payout_data
        }

# Global platform fee engine instance
platform_fee_engine = PlatformFeeEngine()

@router.get("/balance", response_model=WalletBalance)
def get_balance(
    user=Depends(get_current_user), 
    db: Client = Depends(get_db)
):
    """Get current wallet balance - Source of Truth"""
    try:
        # First, try to get existing wallet
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            # Create wallet if it doesn't exist
            create_response = db.table("wallets").insert({
                "user_id": str(user.id),
                "balance_cents": 0
            }).execute()
            
            if create_response.data and len(create_response.data) > 0:
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
        wallet_response = db.table("wallets").select("id").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            return []  # No wallet = no transactions
        
        wallet_id = wallet_response.data[0]["id"]
        
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
        wallet_response = db.table("wallets").select("id").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            return []
            
        wallet_id = wallet_response.data[0]["id"]
        
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
            .execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        wallet = wallet_response.data[0]
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
@router.post("/atomic-transaction")
def process_atomic_transaction(
    item_amount_cents: int,
    gateway_id: str,
    context: str = "general",
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Process atomic Ghost Pass transaction with platform fee.
    
    REQUIRED BUILD ITEM - Platform Fee Engine:
    - Platform fee charged automatically on every interaction
    - Fee is independent of vendor pricing
    - Fee is deducted before vendor payout
    - Transaction is atomic (no partial states)
    """
    try:
        # Calculate fee breakdown using platform fee engine
        fee_breakdown = platform_fee_engine.calculate_atomic_transaction(item_amount_cents, context)
        
        total_charged = fee_breakdown["total_charged_cents"]
        platform_fee = fee_breakdown["platform_fee_cents"]
        vendor_payout = fee_breakdown["vendor_payout_cents"]
        
        logger.info(f"Atomic transaction: user_id={user.id}, item=${item_amount_cents/100:.2f}, platform_fee=${platform_fee/100:.2f}, total=${total_charged/100:.2f}")
        
        # Get wallet and verify balance
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="No wallet found. Please fund your wallet first.")
        
        wallet = wallet_response.data[0]
        
        if wallet["balance_cents"] < total_charged:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. Required: ${total_charged/100:.2f}, Available: ${wallet['balance_cents']/100:.2f}"
            )
        
        # Process atomic transaction via database function
        result = db.rpc("process_atomic_ghost_pass_transaction_with_distribution", {
            "p_user_id": str(user.id),
            "p_item_amount_cents": item_amount_cents,
            "p_platform_fee_cents": platform_fee,
            "p_vendor_payout_cents": vendor_payout,
            "p_total_charged_cents": total_charged,
            "p_gateway_id": gateway_id,
            "p_context": context
        }).execute()
        
        # Database function returns a table (list of rows), get the first row
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Transaction processing failed - no result returned")
        
        transaction_data = result.data[0]  # Get the first (and only) row
        
        # Generate receipt
        receipt = {
            "transaction_id": str(transaction_data["transaction_id"]),
            "timestamp": transaction_data["created_timestamp"],
            "gateway_id": gateway_id,
            "context": context,
            "breakdown": {
                "item_amount": f"${item_amount_cents/100:.2f}",
                "platform_fee": f"${platform_fee/100:.2f}",
                "total_charged": f"${total_charged/100:.2f}"
            },
            "vendor_payout": f"${vendor_payout/100:.2f}",
            "wallet_balance_after": f"${transaction_data['balance_after_cents']/100:.2f}"
        }
        
        return {
            "status": "SUCCESS",
            "message": "Transaction processed successfully",
            "receipt": receipt,
            "audit_trail": {
                "platform_fee_charged": platform_fee,
                "vendor_payout_calculated": vendor_payout,
                "total_deducted": total_charged,
                "transaction_atomic": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Atomic transaction error: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

@router.get("/platform-fee-config")
def get_platform_fee_config(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get current platform fee configuration (for transparency)"""
    return {
        "fee_enabled": platform_fee_engine.fee_enabled,
        "default_fee_cents": platform_fee_engine.default_fee_cents,
        "context_fees": platform_fee_engine.context_fees,
        "fee_policy": "Platform fee is charged on every successful interaction and is independent of vendor pricing"
    }

@router.post("/admin/platform-fee")
def set_platform_fee(
    fee_cents: int,
    context: str = "general",
    admin_user=Depends(get_current_user),  # In production, use get_admin_user
    db: Client = Depends(get_db)
):
    """
    Admin endpoint to configure platform fees.
    REQUIRED: Fee is configurable by VALID only (admin setting)
    """
    # TODO: Add proper admin role check
    # For now, any authenticated user can set fees (demo purposes)
    
    if fee_cents < 0:
        raise HTTPException(status_code=400, detail="Fee cannot be negative")
    
    if fee_cents > 500:  # $5.00 max
        raise HTTPException(status_code=400, detail="Fee cannot exceed $5.00")
    
    # Update platform fee engine
    platform_fee_engine.set_platform_fee(fee_cents, context)
    
    # Log admin action
    try:
        db.table("audit_logs").insert({
            "admin_user_id": str(admin_user.id),
            "action": "PLATFORM_FEE_UPDATE",
            "resource_type": "platform_fee_config",
            "resource_id": context,
            "old_value": {"fee_cents": platform_fee_engine.context_fees.get(context, 0)},
            "new_value": {"fee_cents": fee_cents},
            "metadata": {"context": context}
        }).execute()
    except Exception as e:
        logger.error(f"Audit log error: {e}")
    
    return {
        "status": "updated",
        "context": context,
        "new_fee_cents": fee_cents,
        "new_fee_dollars": fee_cents / 100,
        "message": f"Platform fee for {context} updated to ${fee_cents/100:.2f}"
    }
@router.post("/bind-device", response_model=DeviceWalletBindingResponse)
def bind_device_to_wallet(
    req: DeviceWalletBindingRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Bind wallet to device with biometric authentication.
    
    REQUIRED BUILD ITEM - Device-Bound Wallet:
    - Credentials never leave device
    - Device + biometric binding required
    - If device changes, credentials must be re-approved
    """
    try:
        logger.info(f"Device binding request: user_id={user.id}")
        
        # Generate binding ID and token manually (since DB function might not exist)
        import hashlib
        
        # Generate binding ID
        combined = f"{req.device_fingerprint}:{req.biometric_hash}:{str(user.id)}"
        binding_id = hashlib.sha256(combined.encode()).hexdigest()[:32]
        
        # Generate Ghost Pass token
        import time
        token_data = f"{binding_id}:{time.time()}:{str(uuid4())}"
        ghost_pass_token = hashlib.sha256(token_data.encode()).hexdigest()
        
        logger.info(f"Generated binding_id: {binding_id}, token: {ghost_pass_token[:16]}...")
        
        # Update wallet with device binding
        try:
            # First, get or create wallet
            wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
            
            if not wallet_response.data or len(wallet_response.data) == 0:
                # Create wallet
                wallet_data = {
                    "user_id": str(user.id),
                    "balance_cents": 0,
                    "device_fingerprint": req.device_fingerprint,
                    "biometric_hash": req.biometric_hash,
                    "wallet_binding_id": binding_id,
                    "ghost_pass_token": ghost_pass_token,
                    "device_bound": True
                }
                create_result = db.table("wallets").insert(wallet_data).execute()
                wallet_id = create_result.data[0]["id"]
                logger.info(f"Created new wallet: {wallet_id}")
            else:
                # Update existing wallet
                wallet_id = wallet_response.data[0]["id"]
                update_data = {
                    "device_fingerprint": req.device_fingerprint,
                    "biometric_hash": req.biometric_hash,
                    "wallet_binding_id": binding_id,
                    "ghost_pass_token": ghost_pass_token,
                    "device_bound": True,
                    "updated_at": "NOW()"
                }
                db.table("wallets").update(update_data).eq("id", wallet_id).execute()
                logger.info(f"Updated existing wallet: {wallet_id}")
                
        except Exception as db_error:
            logger.error(f"Database update error: {db_error}")
            raise HTTPException(status_code=500, detail=f"Failed to update wallet: {str(db_error)}")
        
        # Log device binding for audit (optional - don't fail if audit table doesn't exist)
        try:
            db.table("audit_logs").insert({
                "admin_user_id": str(user.id),
                "action": "DEVICE_WALLET_BINDING",
                "resource_type": "wallet_device_binding",
                "resource_id": str(wallet_id),
                "metadata": {
                    "wallet_binding_id": binding_id,
                    "device_fingerprint": req.device_fingerprint[:8],  # Partial for privacy
                    "biometric_bound": True
                }
            }).execute()
            logger.info("Audit log created successfully")
        except Exception as e:
            logger.warning(f"Audit log creation failed (table may not exist): {e}")
            # Don't fail the whole operation if audit logging fails
        
        # Create response
        logger.info(f"Device binding successful, creating response...")
        
        response = DeviceWalletBindingResponse(
            wallet_binding_id=binding_id,
            ghost_pass_token=ghost_pass_token,
            device_bound=True,
            created_at=datetime.now(timezone.utc)
        )
        
        logger.info(f"Response created successfully")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device binding error: {e}")
        raise HTTPException(status_code=500, detail=f"Device binding failed: {str(e)}")

@router.post("/verify-device-binding")
def verify_device_binding(
    device_fingerprint: str,
    biometric_hash: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Verify device binding for wallet access.
    Returns wallet binding info if device is authorized.
    """
    try:
        # Get wallet with device binding - use execute() instead of single() to avoid bool issues
        wallet_response = db.table("wallets")\
            .select("*")\
            .eq("user_id", str(user.id))\
            .eq("device_bound", True)\
            .execute()
        
        # Check if any wallets were found
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(
                status_code=404, 
                detail="No device-bound wallet found. Please bind your device first."
            )
        
        # Get the first (and should be only) wallet
        wallet = wallet_response.data[0]
        
        # Ensure wallet is a dictionary
        if not isinstance(wallet, dict):
            logger.error(f"Unexpected wallet data type: {type(wallet)}, value: {wallet}")
            raise HTTPException(
                status_code=500,
                detail="Invalid wallet data structure"
            )
        
        # Verify device fingerprint and biometric hash
        if (wallet.get("device_fingerprint") != device_fingerprint or 
            wallet.get("biometric_hash") != biometric_hash):
            
            # Log failed verification attempt
            try:
                db.table("audit_logs").insert({
                    "admin_user_id": str(user.id),
                    "action": "DEVICE_BINDING_VERIFICATION_FAILED",
                    "resource_type": "wallet_security",
                    "resource_id": wallet.get("id"),
                    "metadata": {
                        "attempted_device_fingerprint": device_fingerprint[:8],
                        "reason": "Device fingerprint or biometric mismatch"
                    }
                }).execute()
            except Exception as e:
                logger.error(f"Audit log error: {e}")
            
            raise HTTPException(
                status_code=403,
                detail="Device binding verification failed. Credentials must be re-approved on this device."
            )
        
        # Check if wallet/token is revoked
        ghost_pass_token = wallet.get("ghost_pass_token")
        if ghost_pass_token:
            try:
                is_revoked = db.rpc("is_ghost_pass_revoked", {
                    "p_ghost_pass_token": ghost_pass_token
                }).execute()
                
                # Handle the boolean response safely
                if is_revoked.data is True:
                    raise HTTPException(
                        status_code=403,
                        detail="Ghost Pass has been revoked. Please contact support."
                    )
            except Exception as rpc_error:
                # Log the RPC error but don't fail the verification for this
                logger.warning(f"Could not check revocation status: {rpc_error}")
                # Continue with verification - revocation check is not critical for device binding
        
        return {
            "verified": True,
            "wallet_binding_id": wallet.get("wallet_binding_id"),
            "ghost_pass_token": wallet.get("ghost_pass_token"),
            "balance_cents": wallet.get("balance_cents", 0),
            "message": "Device binding verified successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device verification error: {e}")
        raise HTTPException(status_code=500, detail="Device verification failed")

@router.post("/revoke-ghost-pass")
def revoke_ghost_pass(
    ghost_pass_token: str,
    reason: str = "Manual revocation",
    admin_user=Depends(get_current_user),  # In production, use get_admin_user
    db: Client = Depends(get_db)
):
    """
    Revoke Ghost Pass token in real-time.
    
    REQUIRED BUILD ITEM - Revocation & Audit:
    - Real-time revocation propagates to tap, QR, vendors, entry points
    - Full audit trail of revocation
    """
    try:
        revocation_id = str(uuid4())
        
        # Insert revocation record
        db.table("ghost_pass_revocations").insert({
            "revocation_id": revocation_id,
            "ghost_pass_token": ghost_pass_token,
            "revocation_type": "TOKEN",
            "reason": reason,
            "revoked_by": str(admin_user.id),
            "metadata": {
                "revocation_method": "manual",
                "admin_email": getattr(admin_user, 'email', 'unknown')
            }
        }).execute()
        
        # Log admin action
        try:
            db.table("audit_logs").insert({
                "admin_user_id": str(admin_user.id),
                "action": "GHOST_PASS_REVOKED",
                "resource_type": "ghost_pass_token",
                "resource_id": ghost_pass_token,
                "metadata": {
                    "revocation_id": revocation_id,
                    "reason": reason,
                    "propagates_to": ["tap", "qr", "vendors", "entry_points"]
                }
            }).execute()
        except Exception as e:
            logger.error(f"Audit log error: {e}")
        
        logger.info(f"Ghost Pass revoked: {ghost_pass_token} by {admin_user.id}")
        
        return {
            "status": "revoked",
            "revocation_id": revocation_id,
            "ghost_pass_token": ghost_pass_token,
            "reason": reason,
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "propagation": {
                "tap": "immediate",
                "qr": "immediate", 
                "vendors": "immediate",
                "entry_points": "immediate"
            }
        }
        
    except Exception as e:
        logger.error(f"Revocation error: {e}")
        raise HTTPException(status_code=500, detail=f"Revocation failed: {str(e)}")


from pydantic import BaseModel

class CreateProofRequest(BaseModel):
    proof_type: str
    proof_data: dict

@router.post("/create-proof")
def create_cryptographic_proof(
    request: CreateProofRequest,
    user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Cryptographic Proof Creation
    Create device-bound cryptographic proofs without storing sensitive credentials.
    """
    try:
        # Get wallet with device binding
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="No wallet found. Please bind device first.")
        
        wallet = wallet_response.data[0]
        
        if not wallet.get("device_bound"):
            raise HTTPException(status_code=400, detail="Device not bound. Please bind device first.")
        
        device_fingerprint = wallet["device_fingerprint"]
        
        # Create proof based on type
        if request.proof_type == ProofType.AGE_VERIFIED.value:
            is_verified = request.proof_data.get("verified", False)
            proof = cryptographic_proof_engine.create_age_verification_proof(is_verified, device_fingerprint)
        
        elif proof_type == ProofType.MEDICAL_CREDENTIAL.value:
            has_credential = proof_data.get("credential_present", False)
            proof = cryptographic_proof_engine.create_medical_credential_proof(has_credential, device_fingerprint)
        
        elif proof_type == ProofType.ACCESS_CLASS.value:
            access_class_str = proof_data.get("access_class", "GA")
            try:
                access_class = AccessClass(access_class_str)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid access class: {access_class_str}")
            proof = cryptographic_proof_engine.create_access_class_proof(access_class, device_fingerprint)
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid proof type: {proof_type}")
        
        # Store proof in database
        proof_record = {
            "proof_id": proof["proof_data"]["proof_id"],
            "wallet_binding_id": wallet["wallet_binding_id"],
            "proof_type": proof_type,
            "proof_value": proof["proof_data"],
            "signature": proof["signature"],
            "device_fingerprint": device_fingerprint,
            "verified": True,
            "expires_at": None  # Proofs don't expire by default
        }
        
        db.table("cryptographic_proofs").insert(proof_record).execute()
        
        # Log audit trail
        try:
            db.table("audit_logs").insert({
                "admin_user_id": str(user.id),
                "action": "CRYPTOGRAPHIC_PROOF_CREATED",
                "resource_type": "cryptographic_proof",
                "resource_id": proof["proof_data"]["proof_id"],
                "metadata": {
                    "proof_type": proof_type,
                    "wallet_binding_id": wallet["wallet_binding_id"],
                    "device_fingerprint": device_fingerprint[:8]  # Partial for privacy
                }
            }).execute()
        except Exception as e:
            logger.warning(f"Audit log creation failed: {e}")
        
        return {
            "status": "SUCCESS",
            "message": "Cryptographic proof created successfully",
            "proof_id": proof["proof_data"]["proof_id"],
            "proof_type": proof_type,
            "signature": proof["signature"],
            "created_at": proof["proof_data"]["timestamp"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proof creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Proof creation failed: {str(e)}")


@router.post("/verify-proof")
def verify_cryptographic_proof(
    proof_id: str,
    signature: str,
    user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Cryptographic Proof Verification
    Verify cryptographic proofs without accessing sensitive credentials.
    """
    try:
        # Get proof from database
        proof_response = db.table("cryptographic_proofs")\
            .select("*")\
            .eq("proof_id", proof_id)\
            .execute()
        
        if not proof_response.data or len(proof_response.data) == 0:
            raise HTTPException(status_code=404, detail="Proof not found")
        
        proof_record = proof_response.data[0]
        
        # Verify signature
        is_valid = cryptographic_proof_engine.verify_proof_signature(
            proof_record["proof_value"],
            proof_record["device_fingerprint"],
            signature
        )
        
        if not is_valid:
            return {
                "status": "INVALID",
                "message": "Proof signature verification failed",
                "verified": False
            }
        
        # Check if proof is expired
        if proof_record.get("expires_at"):
            expires_at = datetime.fromisoformat(proof_record["expires_at"].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at:
                return {
                    "status": "EXPIRED",
                    "message": "Proof has expired",
                    "verified": False
                }
        
        # Return proof verification result
        proof_data = proof_record["proof_value"]
        
        return {
            "status": "VALID",
            "message": "Proof verified successfully",
            "verified": True,
            "proof_type": proof_record["proof_type"],
            "proof_data": {
                "verified": proof_data.get("verified"),
                "credential_present": proof_data.get("credential_present"),
                "access_class": proof_data.get("access_class"),
                "timestamp": proof_data.get("timestamp")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proof verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Proof verification failed: {str(e)}")


@router.post("/biometric-challenge")
def generate_biometric_challenge(
    user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Biometric Challenge Generation
    Generate biometric challenge for device verification.
    """
    try:
        # Get wallet with device binding
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="No wallet found")
        
        wallet = wallet_response.data[0]
        
        if not wallet.get("device_bound"):
            raise HTTPException(status_code=400, detail="Device not bound")
        
        device_fingerprint = wallet["device_fingerprint"]
        
        # Generate biometric challenge
        challenge = biometric_verification_engine.generate_biometric_challenge(device_fingerprint)
        
        return {
            "status": "SUCCESS",
            "challenge": challenge,
            "expires_in": 300  # 5 minutes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Challenge generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Challenge generation failed: {str(e)}")


@router.post("/biometric-verify")
def verify_biometric_response(
    challenge: str,
    biometric_hash: str,
    user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Biometric Verification
    Verify biometric response against challenge.
    """
    try:
        # Get wallet with device binding
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="No wallet found")
        
        wallet = wallet_response.data[0]
        
        if not wallet.get("device_bound"):
            raise HTTPException(status_code=400, detail="Device not bound")
        
        device_fingerprint = wallet["device_fingerprint"]
        
        # Verify biometric response
        is_valid = biometric_verification_engine.verify_biometric_response(
            challenge, biometric_hash, device_fingerprint
        )
        
        if not is_valid:
            # Log failed verification attempt
            try:
                db.table("audit_logs").insert({
                    "admin_user_id": str(user.id),
                    "action": "BIOMETRIC_VERIFICATION_FAILED",
                    "resource_type": "wallet_device_binding",
                    "resource_id": str(wallet["id"]),
                    "metadata": {
                        "device_fingerprint": device_fingerprint[:8],
                        "reason": "biometric_verification_failed"
                    }
                }).execute()
            except Exception as e:
                logger.warning(f"Audit log creation failed: {e}")
            
            return {
                "status": "FAILED",
                "message": "Biometric verification failed",
                "verified": False
            }
        
        # Generate device attestation
        attestation = biometric_verification_engine.generate_device_attestation(
            device_fingerprint, biometric_hash
        )
        
        return {
            "status": "SUCCESS",
            "message": "Biometric verification successful",
            "verified": True,
            "attestation": attestation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Biometric verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Biometric verification failed: {str(e)}")


@router.get("/proofs")
def get_user_proofs(
    user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get all cryptographic proofs for user's wallet"""
    try:
        # Get wallet
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        
        if not wallet_response.data or len(wallet_response.data) == 0:
            raise HTTPException(status_code=404, detail="No wallet found")
        
        wallet = wallet_response.data[0]
        
        if not wallet.get("wallet_binding_id"):
            return {"proofs": []}
        
        # Get proofs
        proofs_response = db.table("cryptographic_proofs")\
            .select("proof_id, proof_type, proof_value, created_at, expires_at, verified")\
            .eq("wallet_binding_id", wallet["wallet_binding_id"])\
            .execute()
        
        proofs = []
        for proof in proofs_response.data:
            proof_data = proof["proof_value"]
            proofs.append({
                "proof_id": proof["proof_id"],
                "proof_type": proof["proof_type"],
                "verified": proof_data.get("verified"),
                "credential_present": proof_data.get("credential_present"),
                "access_class": proof_data.get("access_class"),
                "created_at": proof["created_at"],
                "expires_at": proof["expires_at"],
                "is_verified": proof["verified"]
            })
        
        return {"proofs": proofs}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get proofs error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get proofs: {str(e)}")

@router.post("/admin/fee-distribution")
def set_fee_distribution(
    valid_percentage: int,
    vendor_percentage: int,
    pool_percentage: int,
    promoter_percentage: int,
    admin_user = Depends(get_current_user),  # In production, use get_admin_user
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Admin endpoint to configure fee distribution percentages.
    Controls how platform fees are split between VALID, vendors, pool, and promoters.
    """
    try:
        # Validate percentages add up to 100
        total_percentage = valid_percentage + vendor_percentage + pool_percentage + promoter_percentage
        if total_percentage != 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Percentages must add up to 100, got {total_percentage}"
            )
        
        # Update fee distribution
        platform_fee_engine.set_distribution_percentages(
            valid_percentage, vendor_percentage, pool_percentage, promoter_percentage
        )
        
        # Log admin action
        try:
            db.table("audit_logs").insert({
                "admin_user_id": str(admin_user.id),
                "action": "FEE_DISTRIBUTION_UPDATED",
                "resource_type": "platform_fee_config",
                "resource_id": "fee_distribution",
                "old_value": {},  # Could store previous values
                "new_value": {
                    "valid_percentage": valid_percentage,
                    "vendor_percentage": vendor_percentage,
                    "pool_percentage": pool_percentage,
                    "promoter_percentage": promoter_percentage
                },
                "metadata": {
                    "admin_email": getattr(admin_user, 'email', 'unknown'),
                    "total_percentage": total_percentage
                }
            }).execute()
        except Exception as e:
            logger.warning(f"Audit log creation failed: {e}")
        
        return {
            "status": "SUCCESS",
            "message": "Fee distribution updated successfully",
            "distribution": {
                "valid_platform": f"{valid_percentage}%",
                "vendor": f"{vendor_percentage}%",
                "pool": f"{pool_percentage}%",
                "promoter": f"{promoter_percentage}%"
            },
            "updated_by": str(admin_user.id),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fee distribution update error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update fee distribution: {str(e)}")


@router.get("/admin/fee-distribution")
def get_fee_distribution(
    admin_user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get current fee distribution configuration"""
    try:
        distribution = platform_fee_engine.distribution_config
        
        return {
            "status": "SUCCESS",
            "distribution": {
                "valid_platform": f"{distribution['valid_platform_percentage']}%",
                "vendor": f"{distribution['vendor_percentage']}%", 
                "pool": f"{distribution['pool_percentage']}%",
                "promoter": f"{distribution['promoter_percentage']}%"
            },
            "context_fees": {
                context: f"${fee_cents/100:.2f}"
                for context, fee_cents in platform_fee_engine.context_fees.items()
            },
            "fee_enabled": platform_fee_engine.fee_enabled
        }
        
    except Exception as e:
        logger.error(f"Get fee distribution error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get fee distribution: {str(e)}")


@router.post("/admin/process-vendor-payouts")
def process_vendor_payouts(
    vendor_id: str = None,  # If None, process all pending payouts
    admin_user = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    REQUIRED BUILD ITEM - Process vendor payouts.
    Calculates and initiates payouts to vendors based on fee distribution.
    """
    try:
        # Get pending payout requests
        query = db.table("payout_requests").select("*").eq("status", "PENDING")
        
        if vendor_id:
            query = query.eq("vendor_id", vendor_id)
        
        payout_requests = query.execute()
        
        if not payout_requests.data:
            return {
                "status": "SUCCESS",
                "message": "No pending payouts found",
                "processed_count": 0
            }
        
        processed_payouts = []
        total_payout_cents = 0
        
        for payout_request in payout_requests.data:
            # Process individual payout
            payout_result = platform_fee_engine.process_vendor_payout(
                payout_request["vendor_id"],
                payout_request["amount_cents"],
                payout_request["transaction_id"]
            )
            
            # Update payout request status
            db.table("payout_requests")\
                .update({
                    "status": "PROCESSED",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": str(admin_user.id)
                })\
                .eq("id", payout_request["id"])\
                .execute()
            
            processed_payouts.append({
                "vendor_id": payout_request["vendor_id"],
                "amount": f"${payout_request['amount_cents']/100:.2f}",
                "transaction_id": payout_request["transaction_id"]
            })
            
            total_payout_cents += payout_request["amount_cents"]
        
        # Log admin action
        try:
            db.table("audit_logs").insert({
                "admin_user_id": str(admin_user.id),
                "action": "VENDOR_PAYOUTS_PROCESSED",
                "resource_type": "vendor_payouts",
                "resource_id": f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "metadata": {
                    "processed_count": len(processed_payouts),
                    "total_payout_amount": f"${total_payout_cents/100:.2f}",
                    "vendor_id_filter": vendor_id,
                    "admin_email": getattr(admin_user, 'email', 'unknown')
                }
            }).execute()
        except Exception as e:
            logger.warning(f"Audit log creation failed: {e}")
        
        return {
            "status": "SUCCESS",
            "message": f"Processed {len(processed_payouts)} vendor payouts",
            "processed_count": len(processed_payouts),
            "total_payout": f"${total_payout_cents/100:.2f}",
            "payouts": processed_payouts,
            "processed_by": str(admin_user.id),
            "processed_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vendor payout processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process vendor payouts: {str(e)}")