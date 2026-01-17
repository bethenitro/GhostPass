"""
Senate Evaluation API

Provides endpoints for Senate governance decisions on validated signals.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

# Import database layer
from sensory_database import SenateEvaluationStore

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/senate",
    tags=["senate"],
    responses={404: {"description": "Not found"}}
)


class EvaluationDecision(BaseModel):
    """Model for Senate evaluation decision"""
    signal_id: str
    decision: str  # "approved", "rejected", "escalated", "request_more_data"
    reason: str
    reviewer_id: str
    trust_score: Optional[float] = None


def add_to_pending(signal_data: Dict[str, Any]):
    """Add a validated signal to pending evaluations (with database persistence)"""
    evaluation = {
        "evaluation_id": f"eval_{int(datetime.utcnow().timestamp() * 1000)}",
        "signal_id": signal_data.get("signal_id"),
        "signal_data": signal_data,
        "status": "pending",
        "priority": calculate_priority(signal_data),
        "received_at": datetime.utcnow().isoformat(),
        "context": extract_context(signal_data)
    }
    SenateEvaluationStore.add_pending(evaluation)
    logger.info(f"[SENATE] Added signal {signal_data.get('signal_id')} to pending evaluations")


def calculate_priority(signal_data: Dict[str, Any]) -> str:
    """Calculate priority level based on signal characteristics"""
    # Simple priority logic (can be enhanced)
    payload_type = signal_data.get("payload_type")
    
    if payload_type == "capsule":
        scu_count = signal_data.get("scu_count", 0)
        if scu_count >= 4:
            return "high"
        elif scu_count >= 2:
            return "medium"
    
    return "normal"


def extract_context(signal_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract context information from signal"""
    # Get sensory types and filter out None values
    sensory_types = signal_data.get("sensory_types") or [signal_data.get("sensory_type")]
    sensory_types = [str(st) for st in sensory_types if st is not None]
    
    return {
        "source_id": signal_data.get("source_id"),
        "payload_type": signal_data.get("payload_type"),
        "sensory_types": sensory_types,
        "timestamp": signal_data.get("timestamp")
    }


@router.get("/pending")
async def get_pending_evaluations(limit: int = 50, priority: Optional[str] = None):
    """
    Get list of signals pending Senate evaluation.
    
    Args:
        limit: Maximum number of evaluations to return
        priority: Filter by priority level (high, medium, normal)
        
    Returns:
        dict: List of pending evaluations
    """
    # Get from database
    evaluations = SenateEvaluationStore.get_pending(limit=limit, priority=priority)
    
    # Sort by priority (high > medium > normal) and timestamp
    priority_order = {"high": 0, "medium": 1, "normal": 2}
    sorted_evals = sorted(
        evaluations,
        key=lambda x: (priority_order.get(x.get("priority", "normal"), 2), x.get("received_at"))
    )
    
    # Count by priority
    by_priority = {
        "high": len([e for e in evaluations if e.get("priority") == "high"]),
        "medium": len([e for e in evaluations if e.get("priority") == "medium"]),
        "normal": len([e for e in evaluations if e.get("priority") == "normal"])
    }
    
    return {
        "evaluations": sorted_evals,
        "total": len(sorted_evals),
        "by_priority": by_priority
    }


@router.get("/pending/{evaluation_id}")
async def get_evaluation_detail(evaluation_id: str):
    """
    Get detailed information about a pending evaluation.
    
    Args:
        evaluation_id: Unique identifier of the evaluation
        
    Returns:
        dict: Detailed evaluation information
    """
    # Get from database
    evaluation = SenateEvaluationStore.get_evaluation_by_id(evaluation_id)
    
    if evaluation:
        # Add policy rules that apply
        evaluation["applicable_policies"] = get_applicable_policies(evaluation)
        return evaluation
    
    raise HTTPException(status_code=404, detail="Evaluation not found")


def get_applicable_policies(evaluation: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Get policy rules that apply to this evaluation"""
    # Placeholder for policy rules
    policies = []
    
    context = evaluation.get("context", {})
    sensory_types = context.get("sensory_types", [])
    
    # Filter out None values and ensure we have strings
    sensory_types = [str(st) for st in sensory_types if st is not None]
    
    # Individual sensory type policies
    if "VISION" in sensory_types:
        policies.append({
            "policy_id": "POL_001",
            "name": "Vision Data Privacy",
            "description": "Vision signals must not contain identifiable faces or license plates",
            "severity": "high"
        })
    
    if "HEARING" in sensory_types:
        policies.append({
            "policy_id": "POL_002",
            "name": "Audio Recording Consent",
            "description": "Audio signals require user consent and must not contain private conversations",
            "severity": "medium"
        })
    
    if "TOUCH" in sensory_types:
        policies.append({
            "policy_id": "POL_003",
            "name": "Tactile Data Limits",
            "description": "Touch sensors must not exceed safe pressure thresholds",
            "severity": "medium"
        })
    
    if "BALANCE" in sensory_types:
        policies.append({
            "policy_id": "POL_004",
            "name": "Motion Tracking Privacy",
            "description": "Balance/motion data must not enable individual identification",
            "severity": "medium"
        })
    
    if "SMELL" in sensory_types:
        policies.append({
            "policy_id": "POL_005",
            "name": "Chemical Detection Safety",
            "description": "Olfactory sensors must report hazardous substances immediately",
            "severity": "high"
        })
    
    if "TASTE" in sensory_types:
        policies.append({
            "policy_id": "POL_006",
            "name": "Gustatory Quality Control",
            "description": "Taste sensors must maintain calibration for food safety",
            "severity": "medium"
        })
    
    # Multi-sensory combination policies
    if len(sensory_types) >= 3:
        policies.append({
            "policy_id": "POL_100",
            "name": "Multi-Sensory Review Required",
            "description": "Signals with 3+ sensory types require enhanced Senate review",
            "severity": "high"
        })
    
    if "VISION" in sensory_types and "HEARING" in sensory_types:
        policies.append({
            "policy_id": "POL_101",
            "name": "Audio-Visual Privacy Protection",
            "description": "Combined audio-visual data requires strict privacy safeguards",
            "severity": "high"
        })
    
    if "SMELL" in sensory_types and "TASTE" in sensory_types:
        policies.append({
            "policy_id": "POL_102",
            "name": "Chemical Analysis Protocol",
            "description": "Combined chemical sensors require cross-validation",
            "severity": "medium"
        })
    
    # Payload type specific policies
    payload_type = context.get("payload_type")
    if payload_type == "capsule":
        policies.append({
            "policy_id": "POL_200",
            "name": "Capsule Integrity Verification",
            "description": "Multi-SCU capsules require additional integrity checks",
            "severity": "medium"
        })
    
    return policies


@router.post("/evaluate")
async def submit_evaluation(decision: EvaluationDecision):
    """
    Submit a Senate evaluation decision.
    
    Args:
        decision: Evaluation decision with reasoning
        
    Returns:
        dict: Confirmation of decision
    """
    # First, find the evaluation by signal_id to get the evaluation_id
    pending_evaluations = SenateEvaluationStore.get_pending()
    evaluation = None
    
    for eval_item in pending_evaluations:
        if eval_item.get("signal_id") == decision.signal_id:
            evaluation = eval_item
            break
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Now remove it using the correct evaluation_id
    removed_evaluation = SenateEvaluationStore.remove_pending(evaluation.get("evaluation_id"))
    
    if not removed_evaluation:
        # Use the found evaluation if remove failed (database might handle it differently)
        removed_evaluation = evaluation
    
    # Create decision record
    decision_record = {
        "decision_id": f"dec_{int(datetime.utcnow().timestamp() * 1000)}",
        "evaluation_id": evaluation.get("evaluation_id"),
        "signal_id": decision.signal_id,
        "decision": decision.decision,
        "reason": decision.reason,
        "reviewer_id": decision.reviewer_id,
        "trust_score": decision.trust_score,
        "timestamp": datetime.utcnow().isoformat(),
        "signal_data": evaluation.get("signal_data"),
        "context": evaluation.get("context")
    }
    
    # Add to database
    SenateEvaluationStore.add_decision(decision_record)
    
    logger.info(f"[SENATE] Decision made: {decision.decision} for signal {decision.signal_id}")
    
    return {
        "status": "success",
        "message": f"Decision '{decision.decision}' recorded",
        "decision_id": decision_record["decision_id"],
        "decision_record": decision_record
    }


@router.get("/history")
async def get_evaluation_history(limit: int = 50, decision_filter: Optional[str] = None):
    """
    Get history of Senate evaluation decisions.
    
    Args:
        limit: Maximum number of decisions to return
        decision_filter: Filter by decision type
        
    Returns:
        dict: List of past decisions
    """
    # Get from database
    decisions = SenateEvaluationStore.get_decision_history(limit=limit, decision_filter=decision_filter)
    
    # Count by decision type
    by_decision = {
        "approved": len([d for d in decisions if d.get("decision") == "approved"]),
        "rejected": len([d for d in decisions if d.get("decision") == "rejected"]),
        "escalated": len([d for d in decisions if d.get("decision") == "escalated"]),
        "request_more_data": len([d for d in decisions if d.get("decision") == "request_more_data"])
    }
    
    return {
        "decisions": decisions,
        "total": len(decisions),
        "by_decision": by_decision
    }


@router.get("/stats")
async def get_senate_stats():
    """Get statistics about Senate evaluations"""
    # Get from database
    stats = SenateEvaluationStore.get_stats()
    
    return stats


@router.get("/health")
async def senate_health():
    """Health check for Senate endpoint"""
    stats = SenateEvaluationStore.get_stats()
    
    return {
        "status": "operational",
        "pending_evaluations": stats.get("pending_count", 0),
        "total_decisions": stats.get("total_decisions", 0),
        "storage_type": "database" if SenateEvaluationStore.get_supabase_client() else "memory",
        "timestamp": datetime.utcnow().isoformat()
    }
