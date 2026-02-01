"""
FastAPI routes for The Senate governance engine.

Implements REST endpoints for governance evaluation, veto operations,
and audit queries with proper error handling and validation.

Requirements: 14.1, 14.2, 14.3, 14.4
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from senate.models.governance import GovernanceRequest, GovernanceVerdict
from senate.core.governance_orchestrator import GovernanceOrchestrator
from senate.core.audit_logger import AuditLogger
from senate.core.veto_system import VetoSystem, VetoInterface
from senate.core.security_manager import get_security_manager
from senate.utils.errors import ValidationError, GovernanceError
from senate.utils.logging import get_logger


logger = get_logger("api")

# Initialize core components
orchestrator = GovernanceOrchestrator()
audit_logger = AuditLogger()
veto_system = VetoSystem(audit_logger)
veto_interface = VetoInterface(veto_system)

# Create routers
governance_router = APIRouter(prefix="/governance", tags=["governance"])
veto_router = APIRouter(prefix="/veto", tags=["veto"])
audit_router = APIRouter(prefix="/audit", tags=["audit"])


# Request/Response Models
class GovernanceRequestModel(BaseModel):
    """Request model for governance evaluation - EXACT PATENT FORMAT."""
    user_prompt: str = Field(..., description="User action to evaluate", min_length=1, max_length=100000)
    transaction_id: str = Field(..., description="Unique transaction identifier", min_length=1, max_length=255)


class GovernanceResponseModel(BaseModel):
    """Response model for governance evaluation - EXACT PATENT FORMAT."""
    final_decision: str = Field(..., description="Final decision: APPROVE or DENY")
    decision_source: str = Field(..., description="Source of decision: SENATE, JUDGE, or VETO")
    risk_summary: List[str] = Field(..., description="List of identified risks")
    confidence: int = Field(..., description="Confidence score 0-100")


class VetoRequestModel(BaseModel):
    """Request model for veto operations."""
    transaction_id: str = Field(..., description="Transaction to veto", min_length=1)
    veto_reason: str = Field(..., description="Reason for veto", min_length=1, max_length=1000)
    new_decision: str = Field("DENY", description="New decision: APPROVE or DENY")
    admin_id: str = Field("ADMIN", description="Administrator ID")


class VetoResponseModel(BaseModel):
    """Response model for veto operations."""
    success: bool = Field(..., description="Whether veto was successful")
    transaction_id: str = Field(..., description="Transaction identifier")
    original_decision: Optional[str] = Field(None, description="Original decision")
    new_decision: Optional[str] = Field(None, description="New decision after veto")
    veto_timestamp: Optional[str] = Field(None, description="Veto timestamp")
    message: Optional[str] = Field(None, description="Success/error message")
    error: Optional[str] = Field(None, description="Error message if failed")


# Governance Routes
@governance_router.post("/evaluate", response_model=GovernanceResponseModel)
async def evaluate_governance_request(request: GovernanceRequestModel) -> GovernanceResponseModel:
    """
    Evaluate governance request and return decision.
    
    PATENT COMPLIANCE:
    - Input: {"user_prompt": "string", "transaction_id": "string"}
    - Output: {"final_decision": "APPROVE"|"DENY", "decision_source": "SENATE"|"JUDGE"|"VETO", "risk_summary": [], "confidence": 0-100}
    
    Main governance endpoint that processes user actions through
    the complete Senate decision process following patent directive.
    
    Requirements: 14.2, 14.3
    """
    logger.info(f"Received governance request: {request.transaction_id}")
    
    try:
        # Create governance request (exact patent input format)
        gov_request = GovernanceRequest(
            user_prompt=request.user_prompt,
            transaction_id=request.transaction_id
        )
        
        # Process through governance engine (follows mandatory execution order)
        verdict = await orchestrator.evaluate_action(gov_request)
        
        # Create security session for audit
        security_manager = get_security_manager()
        session = security_manager.create_secure_session(
            request.transaction_id, 
            "[WIPED]"  # Raw prompt already wiped per patent requirement
        )
        
        # Log decision to audit trail (only hash + verdict, no raw prompts)
        await audit_logger.log_decision(
            transaction_id=request.transaction_id,
            input_hash=gov_request.generate_hash(),
            verdict=verdict,
            abstention_count=0,  # Would be calculated from senator responses
            metadata={"api_version": "v1", "endpoint": "evaluate"}
        )
        
        # Wipe sensitive data from security session
        security_manager.wipe_session(request.transaction_id)
        
        # Return response (exact patent output format)
        response = GovernanceResponseModel(
            final_decision=verdict.final_decision,
            decision_source=verdict.decision_source,
            risk_summary=verdict.risk_summary,
            confidence=verdict.confidence
        )
        
        logger.info(f"Governance request completed: {request.transaction_id} -> {verdict.final_decision}")
        return response
        
    except ValidationError as e:
        logger.warning(f"Validation error for {request.transaction_id}: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    
    except GovernanceError as e:
        logger.error(f"Governance error for {request.transaction_id}: {e.message}")
        raise HTTPException(status_code=500, detail="Governance processing failed")
    
    except Exception as e:
        logger.error(f"Unexpected error for {request.transaction_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@governance_router.get("/health")
async def governance_health_check() -> Dict[str, Any]:
    """
    Health check for governance system.
    
    Returns detailed health status of all governance components.
    
    Requirements: 14.5
    """
    try:
        health_status = await orchestrator.health_check()
        return health_status
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@governance_router.get("/status")
async def governance_status() -> Dict[str, Any]:
    """
    Detailed governance system status.
    
    Returns comprehensive status information including
    active transactions and system metrics.
    """
    try:
        active_transactions = orchestrator.get_active_transactions()
        
        return {
            "status": "operational",
            "active_transactions": len(active_transactions),
            "components": {
                "orchestrator": "healthy",
                "senators": "healthy", 
                "executive_secretary": "healthy",
                "judge": "healthy"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Veto Routes
@veto_router.post("/apply", response_model=VetoResponseModel)
async def apply_veto(request: VetoRequestModel) -> VetoResponseModel:
    """
    Apply human veto to governance decision.
    
    Allows human administrators to override any governance decision
    asynchronously with absolute authority.
    
    Requirements: 11.1, 11.2, 11.3
    """
    logger.info(f"Veto request for transaction {request.transaction_id}: {request.veto_reason}")
    
    try:
        # Apply veto through interface
        result = await veto_interface.veto_transaction(
            transaction_id=request.transaction_id,
            reason=request.veto_reason,
            new_decision=request.new_decision,
            admin_id=request.admin_id
        )
        
        # Convert to response model
        response = VetoResponseModel(**result)
        
        if result["success"]:
            logger.info(f"Veto applied successfully: {request.transaction_id}")
        else:
            logger.warning(f"Veto failed: {request.transaction_id} - {result.get('error')}")
        
        return response
        
    except Exception as e:
        logger.error(f"Veto application error: {e}")
        return VetoResponseModel(
            success=False,
            transaction_id=request.transaction_id,
            error=str(e)
        )


@veto_router.get("/eligibility/{transaction_id}")
async def check_veto_eligibility(transaction_id: str) -> Dict[str, Any]:
    """
    Check if transaction is eligible for veto.
    
    Returns eligibility information and transaction details.
    """
    try:
        eligibility = await veto_system.check_veto_eligibility(transaction_id)
        return eligibility
    
    except Exception as e:
        logger.error(f"Eligibility check failed for {transaction_id}: {e}")
        return {
            "eligible": False,
            "error": str(e),
            "transaction_id": transaction_id
        }


@veto_router.get("/history/{transaction_id}")
async def get_veto_history(transaction_id: str) -> Dict[str, Any]:
    """
    Get veto history for specific transaction.
    
    Returns all veto actions applied to the transaction.
    """
    try:
        history = await veto_system.get_veto_history(transaction_id)
        
        return {
            "transaction_id": transaction_id,
            "veto_count": len(history),
            "veto_history": [
                {
                    "original_decision": veto.original_decision,
                    "new_decision": veto.new_decision,
                    "veto_reason": veto.veto_reason,
                    "veto_timestamp": veto.veto_timestamp.isoformat(),
                    "success": veto.success
                }
                for veto in history
            ]
        }
    
    except Exception as e:
        logger.error(f"Veto history query failed for {transaction_id}: {e}")
        return {
            "transaction_id": transaction_id,
            "error": str(e)
        }


@veto_router.get("/dashboard")
async def get_veto_dashboard() -> Dict[str, Any]:
    """
    Get veto system dashboard information.
    
    Returns statistics and recent activity for monitoring.
    """
    try:
        dashboard = await veto_interface.get_veto_dashboard()
        return dashboard
    
    except Exception as e:
        logger.error(f"Veto dashboard query failed: {e}")
        return {
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Audit Routes
@audit_router.get("/transaction/{transaction_id}")
async def get_audit_record(transaction_id: str) -> Dict[str, Any]:
    """
    Get audit record for specific transaction.
    
    Returns comprehensive audit information without sensitive data.
    
    Requirements: 13.5
    """
    try:
        audit_record = await audit_logger.query_audit_trail(transaction_id)
        
        if not audit_record:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return {
            "transaction_id": audit_record.transaction_id,
            "input_hash": audit_record.input_hash,
            "final_decision": audit_record.final_verdict.final_decision,
            "decision_source": audit_record.final_verdict.decision_source,
            "confidence": audit_record.final_verdict.confidence,
            "risk_summary": audit_record.final_verdict.risk_summary,
            "abstention_count": audit_record.abstention_count,
            "veto_applied": audit_record.veto_applied,
            "created_at": audit_record.created_at.isoformat(),
            "updated_at": audit_record.updated_at.isoformat() if audit_record.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audit query failed for {transaction_id}: {e}")
        raise HTTPException(status_code=500, detail="Audit query failed")


@audit_router.get("/range")
async def get_audit_range(
    start_date: str = Query(..., description="Start date (ISO format)"),
    end_date: str = Query(..., description="End date (ISO format)"),
    limit: int = Query(100, description="Maximum number of records", le=1000)
) -> Dict[str, Any]:
    """
    Get audit records in time range.
    
    Returns audit entries within specified time range.
    
    Requirements: 13.5
    """
    try:
        # Parse dates
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        # Query audit records
        entries = await audit_logger.query_by_time_range(start_dt, end_dt, limit)
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "count": len(entries),
            "limit": limit,
            "entries": entries
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        logger.error(f"Audit range query failed: {e}")
        raise HTTPException(status_code=500, detail="Audit range query failed")


@audit_router.get("/statistics")
async def get_audit_statistics() -> Dict[str, Any]:
    """
    Get audit system statistics.
    
    Returns comprehensive statistics for monitoring and reporting.
    """
    try:
        stats = await audit_logger.get_audit_statistics()
        return {
            "statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Audit statistics query failed: {e}")
        return {
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Dependency for rate limiting (placeholder)
async def rate_limit_dependency():
    """Rate limiting dependency (to be implemented)."""
    pass


# Add rate limiting to sensitive endpoints
governance_router.dependencies.append(Depends(rate_limit_dependency))
veto_router.dependencies.append(Depends(rate_limit_dependency))