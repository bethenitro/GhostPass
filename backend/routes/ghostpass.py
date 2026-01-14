from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from database import get_db
from routes.auth import get_current_user
from models import PurchaseRequest, PurchaseResponse, GhostPass
from typing import List
import logging

router = APIRouter(prefix="/ghostpass", tags=["GhostPass"])
logger = logging.getLogger(__name__)

# Pricing in cents: 1 Day ($10), 3 Days ($20), 7 Days ($50)
PRICES = {
    1: 1000,   # $10.00
    3: 2000,   # $20.00  
    7: 5000    # $50.00
}

@router.post("/purchase", response_model=PurchaseResponse)
def purchase_pass(
    req: PurchaseRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Purchase a GhostPass with specified duration"""
    if req.duration not in PRICES:
        raise HTTPException(status_code=400, detail="Invalid duration. Must be 1, 3, or 7 days")
    
    price_cents = PRICES[req.duration]
    
    try:
        logger.info(f"Attempting to purchase pass for user {user.id}, duration: {req.duration} days, price: {price_cents} cents")
        
        # Ensure user exists in our users table (should already be done by auth, but double-check)
        db.table("users").upsert({
            "id": str(user.id),
            "email": user.email
        }, on_conflict="id").execute()
        
        # Check if user has a wallet and sufficient balance
        wallet_response = db.table("wallets").select("*").eq("user_id", str(user.id)).execute()
        if not wallet_response.data:
            raise HTTPException(status_code=404, detail="No wallet found. Please fund your wallet first.")
        
        wallet = wallet_response.data[0]
        logger.info(f"Wallet found: balance_cents={wallet['balance_cents']}, required={price_cents}")
        if wallet["balance_cents"] < price_cents:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. Required: ${price_cents/100:.2f}, Available: ${wallet['balance_cents']/100:.2f}"
            )
        
        # Atomic purchase via database function
        # This checks balance, deducts amount, creates pass, and logs transaction
        pass_id = None
        try:
            logger.info("Making RPC call to purchase_pass")
            
            # Try the RPC call with error handling
            rpc_params = {
                "p_user_id": str(user.id),
                "p_amount": price_cents,
                "p_duration_days": req.duration
            }
            logger.info(f"RPC params: {rpc_params}")
            
            result = db.rpc("purchase_pass", rpc_params).execute()
            
            # The function now returns a table with one row containing pass_id
            if hasattr(result, 'data') and result.data and len(result.data) > 0:
                # Extract pass_id from first row of result
                pass_id = str(result.data[0]['pass_id'])
                logger.info(f"RPC call successful - Pass created with ID: {pass_id}")
            else:
                raise Exception("No pass ID returned from purchase_pass function")
            
        except Exception as e:
            error_str = str(e)
            logger.error(f"RPC call failed: {error_str}")
            logger.error(f"Trying manual approach as fallback")
            pass_id = None
            
            # Manual transaction approach as fallback (only if pass_id wasn't extracted)
            if pass_id is None:
                logger.error(f"Trying manual approach as fallback")
                try:
                    from datetime import datetime, timedelta
                    import uuid
                    
                    # Generate pass ID
                    pass_id = str(uuid.uuid4())
                    expires_at = datetime.utcnow() + timedelta(days=req.duration)
                    
                    # Deduct from wallet
                    wallet_update = db.table("wallets")\
                        .update({"balance_cents": wallet["balance_cents"] - price_cents})\
                        .eq("id", wallet["id"])\
                        .execute()
                    
                    if not wallet_update.data:
                        raise Exception("Failed to update wallet balance")
                    
                    # Create ghost pass
                    pass_insert = db.table("ghost_passes")\
                        .insert({
                            "id": pass_id,
                            "user_id": str(user.id),
                            "status": "ACTIVE",
                            "expires_at": expires_at.isoformat()
                        })\
                        .execute()
                    
                    if not pass_insert.data:
                        raise Exception("Failed to create ghost pass")
                    
                    # Log transaction with balance tracking
                    current_balance = wallet["balance_cents"]
                    new_balance = current_balance - price_cents
                    
                    transaction_insert = db.table("transactions")\
                        .insert({
                            "wallet_id": wallet["id"],
                            "type": "SPEND",
                            "amount_cents": -price_cents,
                            "balance_before_cents": current_balance,
                            "balance_after_cents": new_balance,
                            "vendor_name": "GhostPass System",
                            "metadata": {
                                "pass_id": pass_id,
                                "duration_days": req.duration,
                                "expires_at": expires_at.isoformat()
                            }
                        })\
                        .execute()
                    
                    logger.info(f"Manual transaction completed - Pass ID: {pass_id}")
                    
                except Exception as manual_error:
                    logger.error(f"Manual transaction also failed: {manual_error}")
                    raise HTTPException(status_code=500, detail="Purchase failed. Please try again.")

        
        # Fetch the created pass to get expiration
        try:
            logger.info(f"Fetching pass details for ID: {pass_id}")
            pass_response = db.table("ghost_passes")\
                .select("expires_at")\
                .eq("id", str(pass_id))\
                .single()\
                .execute()
            
            logger.info(f"Pass response type: {type(pass_response)}")
            logger.info(f"Pass response: {pass_response}")
            
            # Check if pass_response has data attribute
            if hasattr(pass_response, 'data'):
                logger.info(f"Pass response.data type: {type(pass_response.data)}")
                logger.info(f"Pass response.data: {pass_response.data}")
                
                if pass_response.data and isinstance(pass_response.data, dict):
                    expires_at = pass_response.data.get("expires_at")
                    if expires_at:
                        logger.info(f"Found expires_at: {expires_at}")
                    else:
                        raise Exception("No expiration date found in pass data")
                else:
                    raise Exception(f"Pass data is not a dict: {type(pass_response.data)}")
            else:
                raise Exception("Pass response has no data attribute")
            
        except Exception as e:
            logger.error(f"Error fetching pass details: {e}")
            logger.error(f"Error type: {type(e)}")
            # Fallback: calculate expiration manually
            from datetime import datetime, timedelta
            expires_at = (datetime.utcnow() + timedelta(days=req.duration)).isoformat()
            logger.info(f"Using fallback expires_at: {expires_at}")
        
        return PurchaseResponse(
            status="success",
            pass_id=pass_id,
            expires_at=expires_at,
            amount_charged_cents=price_cents
        )
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is (don't convert to 500)
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Pass purchase error: {error_msg}")
        logger.error(f"Error type: {type(e)}")
        
        # Handle specific database errors
        if "Insufficient balance" in error_msg:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        elif "Wallet not found" in error_msg:
            raise HTTPException(status_code=404, detail="Wallet not found. Please fund your wallet first.")
        elif "function purchase_pass" in error_msg.lower() and "does not exist" in error_msg.lower():
            raise HTTPException(status_code=500, detail="Database function not found. Please run database setup.")
        else:
            raise HTTPException(status_code=500, detail=f"Purchase failed: {error_msg}")

@router.get("/status", response_model=GhostPass)
def get_pass_status(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get user's current active pass status"""
    try:
        logger.info(f"Fetching pass status for user: {user.id}")
        
        # Get the most recent active pass
        pass_response = db.table("ghost_passes")\
            .select("*")\
            .eq("user_id", str(user.id))\
            .eq("status", "ACTIVE")\
            .gte("expires_at", "now()")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        logger.info(f"Pass query result: {pass_response.data}")
        
        if not pass_response.data:
            logger.info("No active pass found")
            raise HTTPException(status_code=404, detail="No active pass found")
        
        active_pass = pass_response.data[0]
        logger.info(f"Returning active pass: ID={active_pass.get('id')}, expires_at={active_pass.get('expires_at')}")
        
        return active_pass
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pass status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch pass status")

@router.get("/passes", response_model=List[GhostPass])
def get_user_passes(
    user=Depends(get_current_user),
    db: Client = Depends(get_db),
    active_only: bool = False
):
    """Get user's GhostPasses"""
    try:
        query = db.table("ghost_passes").select("*").eq("user_id", str(user.id))
        
        if active_only:
            query = query.eq("status", "ACTIVE").gte("expires_at", "now()")
        
        passes_response = query.order("created_at", desc=True).execute()
        return passes_response.data
        
    except Exception as e:
        logger.error(f"Passes fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch passes")

@router.get("/passes/{pass_id}", response_model=GhostPass)
def get_pass_details(
    pass_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get specific pass details"""
    try:
        pass_response = db.table("ghost_passes")\
            .select("*")\
            .eq("id", pass_id)\
            .eq("user_id", str(user.id))\
            .single()\
            .execute()
        
        if not pass_response.data:
            raise HTTPException(status_code=404, detail="Pass not found")
        
        return pass_response.data
        
    except Exception as e:
        logger.error(f"Pass details error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch pass details")
