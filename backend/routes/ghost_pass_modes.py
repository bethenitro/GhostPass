"""
Ghost Pass Modes API Routes

Handles the two Ghost Pass modes:
1. Pay-per-scan: Immediate wallet funding and per-scan fees
2. Event mode: Pass purchase required before entry

This API determines which mode applies based on context and handles
the appropriate flow for each mode.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import secrets

from ghost_pass import GhostPass, GhostPassConfig
from database import get_db
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ghost-pass", tags=["ghost-pass-modes"])


class ContextCheckRequest(BaseModel):
    """Request to check context mode and requirements"""
    context: str = Field(..., description="Context/venue identifier")
    wallet_binding_id: str = Field(..., description="User's wallet binding ID")
    ghost_pass_token: Optional[str] = Field(None, description="Optional Ghost Pass token")


class ContextCheckResponse(BaseModel):
    """Response with context mode and access requirements"""
    context: str
    mode: str  # "pay_per_scan" or "event"
    access_granted: bool
    requires_payment: bool = False
    requires_pass_purchase: bool = False
    payment_amount_cents: Optional[int] = None
    payment_description: Optional[str] = None
    pass_options: List[Dict[str, Any]] = []
    pass_info: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    context_info: Dict[str, Any]


class PassPurchaseRequest(BaseModel):
    """Request to purchase a Ghost Pass"""
    context: str = Field(..., description="Context/venue identifier")
    pass_id: str = Field(..., description="Pass option ID to purchase")
    wallet_binding_id: str = Field(..., description="User's wallet binding ID")


class PassPurchaseResponse(BaseModel):
    """Response after pass purchase"""
    success: bool
    ghost_pass_token: Optional[str] = None
    pass_info: Optional[Dict[str, Any]] = None
    transaction_id: Optional[str] = None
    error: Optional[str] = None


class InteractionRequest(BaseModel):
    """Request to process a Ghost Pass interaction"""
    context: str = Field(..., description="Context/venue identifier")
    wallet_binding_id: str = Field(..., description="User's wallet binding ID")
    interaction_method: str = Field(..., description="QR or NFC")
    gateway_id: str = Field(..., description="Gateway/scanner identifier")
    ghost_pass_token: Optional[str] = Field(None, description="Optional Ghost Pass token")


class InteractionResponse(BaseModel):
    """Response after processing interaction"""
    success: bool
    interaction_id: str
    mode: str
    amount_charged_cents: int = 0
    balance_after_cents: Optional[int] = None
    message: str
    requires_pass_purchase: bool = False
    pass_options: List[Dict[str, Any]] = []


@router.post("/check-context", response_model=ContextCheckResponse)
async def check_context_requirements(request: ContextCheckRequest):
    """
    Check context mode and access requirements.
    
    This endpoint determines:
    - Whether the context requires a Ghost Pass or allows pay-per-scan
    - What the user needs to do to gain access
    - Pricing information for the context
    """
    try:
        ghost_pass = GhostPass(context=request.context)
        access_check = ghost_pass.check_access_requirements(
            request.wallet_binding_id, 
            request.ghost_pass_token
        )
        
        return ContextCheckResponse(
            context=request.context,
            mode=access_check["mode"],
            access_granted=access_check["access_granted"],
            requires_payment=access_check.get("requires_payment", False),
            requires_pass_purchase=access_check.get("requires_pass_purchase", False),
            payment_amount_cents=access_check.get("payment_amount_cents"),
            payment_description=access_check.get("payment_description"),
            pass_options=access_check.get("pass_options", []),
            pass_info=access_check.get("pass_info"),
            message=access_check.get("message"),
            context_info=access_check["context_info"]
        )
        
    except Exception as e:
        logger.error(f"Context check failed: {e}")
        raise HTTPException(status_code=500, detail="Context check failed")


@router.post("/purchase-pass", response_model=PassPurchaseResponse)
async def purchase_ghost_pass(request: PassPurchaseRequest):
    """
    Purchase a Ghost Pass for event mode contexts.
    
    This endpoint:
    1. Validates the pass option exists for the context
    2. Charges the user's wallet for the pass
    3. Creates a Ghost Pass token
    4. Returns the token for future use
    """
    try:
        ghost_pass = GhostPass(context=request.context)
        context_info = ghost_pass.get_context_info()
        
        # Verify this context requires passes
        if not context_info["pass_required"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Context '{request.context}' uses pay-per-scan mode, no pass required"
            )
        
        # Find the requested pass option
        pass_option = None
        for option in context_info["pass_options"]:
            if option["id"] == request.pass_id:
                pass_option = option
                break
        
        if not pass_option:
            raise HTTPException(
                status_code=400,
                detail=f"Pass option '{request.pass_id}' not found for context '{request.context}'"
            )
        
        # Process payment (this would integrate with the wallet system)
        # For now, we'll simulate the purchase
        ghost_pass_token = f"gp_{request.context}_{secrets.token_hex(16)}"
        
        # In production, this would:
        # 1. Charge the user's wallet
        # 2. Create a database record for the pass
        # 3. Set expiration based on duration_hours
        
        pass_info = {
            "token": ghost_pass_token,
            "pass_id": request.pass_id,
            "pass_name": pass_option["name"],
            "context": request.context,
            "price_paid_cents": pass_option["price_cents"],
            "duration_hours": pass_option["duration_hours"],
            "includes": pass_option["includes"],
            "purchased_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=pass_option["duration_hours"])).isoformat(),
            "wallet_binding_id": request.wallet_binding_id
        }
        
        logger.info(f"Ghost Pass purchased: {ghost_pass_token} for context {request.context}")
        
        return PassPurchaseResponse(
            success=True,
            ghost_pass_token=ghost_pass_token,
            pass_info=pass_info,
            transaction_id=f"txn_{secrets.token_hex(8)}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pass purchase failed: {e}")
        return PassPurchaseResponse(
            success=False,
            error=str(e)
        )


@router.post("/interact", response_model=InteractionResponse)
async def process_ghost_pass_interaction(request: InteractionRequest):
    """
    Process a Ghost Pass interaction (QR scan or NFC tap).
    
    This endpoint handles both modes:
    - Pay-per-scan: Charges per-scan fee and grants access
    - Event mode: Validates Ghost Pass token and grants access
    """
    try:
        ghost_pass = GhostPass(context=request.context)
        
        # Create interaction context
        interaction_context = ghost_pass.create_interaction_context(
            request.wallet_binding_id,
            request.interaction_method,
            request.ghost_pass_token
        )
        
        access_check = interaction_context["access_check"]
        
        if not access_check["access_granted"]:
            # Access denied - return requirements
            return InteractionResponse(
                success=False,
                interaction_id=interaction_context["interaction_id"],
                mode=access_check["mode"],
                message=access_check.get("message", "Access denied"),
                requires_pass_purchase=access_check.get("requires_pass_purchase", False),
                pass_options=access_check.get("pass_options", [])
            )
        
        # Access granted - process the interaction
        amount_charged = 0
        
        if access_check.get("requires_payment", False):
            # Pay-per-scan mode - charge the fee
            amount_charged = access_check["payment_amount_cents"]
            
            # In production, this would:
            # 1. Charge the user's wallet
            # 2. Log the transaction
            # 3. Update balance
            
            logger.info(f"Pay-per-scan charged: {amount_charged} cents for {request.context}")
        
        # Log the interaction (in production, this would be a database call)
        logger.info(f"Ghost Pass interaction: {request.interaction_method} at {request.gateway_id} "
                   f"for context {request.context}")
        
        return InteractionResponse(
            success=True,
            interaction_id=interaction_context["interaction_id"],
            mode=access_check["mode"],
            amount_charged_cents=amount_charged,
            message=f"Access granted to {request.context}" + 
                   (f" (charged ${amount_charged/100:.2f})" if amount_charged > 0 else " (pass validated)")
        )
        
    except Exception as e:
        logger.error(f"Interaction processing failed: {e}")
        raise HTTPException(status_code=500, detail="Interaction processing failed")


@router.get("/contexts")
async def get_available_contexts():
    """
    Get all available contexts and their configurations.
    
    Returns information about all configured contexts including
    their modes, pricing, and pass options.
    """
    try:
        contexts = {}
        
        for context_name, config in GhostPassConfig.CONTEXT_MODES.items():
            ghost_pass = GhostPass(context=context_name)
            contexts[context_name] = ghost_pass.get_context_info()
        
        return {
            "contexts": contexts,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get contexts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get contexts")


@router.get("/context/{context_name}")
async def get_context_info(context_name: str):
    """
    Get detailed information about a specific context.
    
    Returns mode, pricing, pass options, and other configuration
    for the specified context.
    """
    try:
        if context_name not in GhostPassConfig.CONTEXT_MODES:
            raise HTTPException(status_code=404, detail=f"Context '{context_name}' not found")
        
        ghost_pass = GhostPass(context=context_name)
        context_info = ghost_pass.get_context_info()
        
        return {
            "context_info": context_info,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get context info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get context info")


@router.post("/configure-context")
async def configure_context(
    context_name: str,
    pass_required: bool,
    per_scan_fee_cents: int = 0,
    pass_options: List[Dict[str, Any]] = []
):
    """
    Configure a context's Ghost Pass mode and settings.
    
    This endpoint allows dynamic configuration of contexts
    without code changes. Useful for venue operators to
    switch between pay-per-scan and event modes.
    """
    try:
        # Validate pass options if provided
        if pass_required and not pass_options:
            raise HTTPException(
                status_code=400,
                detail="Pass options required when pass_required is True"
            )
        
        # Update the configuration
        GhostPassConfig.CONTEXT_MODES[context_name] = {
            "pass_required": pass_required,
            "per_scan_fee_cents": per_scan_fee_cents,
            "pass_options": pass_options
        }
        
        logger.info(f"Context '{context_name}' configured: pass_required={pass_required}, "
                   f"per_scan_fee={per_scan_fee_cents}")
        
        return {
            "success": True,
            "context": context_name,
            "configuration": GhostPassConfig.CONTEXT_MODES[context_name],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Context configuration failed: {e}")
        raise HTTPException(status_code=500, detail="Context configuration failed")