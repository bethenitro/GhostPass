"""
Conduit API Endpoint

Entry point for external systems to send sensory signals.
Accepts either single SCUs or Sensory Capsules (multiple SCUs).
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, Union
from datetime import datetime
import logging

from scu import SensoryCargonUnit, SensoryCapsule, SCUValidator
from ghost_pass import GhostPass, SenateForwarder
from routes.sensory_monitor import add_signal_to_history
import uuid

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conduit",
    tags=["conduit"],
    responses={404: {"description": "Not found"}}
)


class ConduitLogger:
    """Audit trail logger for all received signals"""
    
    @staticmethod
    def log_received(payload_type: str, source_id: str, scu_count: int, success: bool, error: str = None):
        """Log every received signal for audit trail"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "payload_type": payload_type,
            "source_id": source_id,
            "scu_count": scu_count,
            "success": success,
            "error": error
        }
        
        if success:
            logger.info(f"[CONDUIT] Received and validated: {log_entry}")
        else:
            logger.warning(f"[CONDUIT] Validation failed: {log_entry}")
        
        return log_entry


class GhostPassForwarder:
    """Forwards validated signals to Ghost Pass pipeline"""
    
    @staticmethod
    async def forward_single_scu(scu: SensoryCargonUnit, signal_id: str = None) -> Dict[str, Any]:
        """
        Forward a single SCU to Ghost Pass.
        
        Args:
            scu: Validated SCU
            signal_id: Unique signal identifier from conduit
            
        Returns:
            dict: Forwarding result
        """
        logger.info(f"[CONDUIT->GHOSTPASS] Forwarding single SCU: {scu.sensory_type} from {scu.metadata.source_id}")
        
        # Process through Ghost Pass
        ghost_pass = GhostPass()
        result = ghost_pass.process_from_conduit(scu.to_dict())
        
        # Add signal_id to result
        if signal_id:
            result["signal_id"] = signal_id
        
        # If approved, forward to Senate
        if result["status"] == "approved":
            senate_result = await SenateForwarder.forward_to_senate(result)
            result["senate_forwarding"] = senate_result
        
        return result
    
    @staticmethod
    async def forward_capsule(capsule: SensoryCapsule, signal_id: str = None) -> Dict[str, Any]:
        """
        Forward a Sensory Capsule to Ghost Pass.
        
        Args:
            capsule: Validated capsule with multiple SCUs
            signal_id: Unique signal identifier from conduit
            
        Returns:
            dict: Forwarding result
        """
        logger.info(f"[CONDUIT->GHOSTPASS] Forwarding capsule: {len(capsule.scus)} SCUs from {capsule.source_id}")
        
        # Process through Ghost Pass
        ghost_pass = GhostPass()
        result = ghost_pass.process_from_conduit(capsule.to_dict())
        
        # Add signal_id to result
        if signal_id:
            result["signal_id"] = signal_id
        
        # If approved, forward to Senate
        if result["status"] == "approved":
            senate_result = await SenateForwarder.forward_to_senate(result)
            result["senate_forwarding"] = senate_result
        
        return result


def detect_payload_type(payload: Dict[str, Any]) -> str:
    """
    Detect if payload is a single SCU or a Sensory Capsule.
    
    Args:
        payload: Incoming payload dictionary
        
    Returns:
        str: "scu" or "capsule"
    """
    # Capsule has 'capsule_id' and 'scus' fields
    if "capsule_id" in payload and "scus" in payload:
        return "capsule"
    
    # SCU has 'sensory_type' and 'signal_data' fields
    if "sensory_type" in payload and "signal_data" in payload:
        return "scu"
    
    raise ValueError("Payload does not match SCU or Capsule format")


@router.post("/receive")
async def receive_signal(request: Request):
    """
    Conduit endpoint: Receive and validate sensory signals.
    
    Accepts:
    - Single SCU (one sensory signal)
    - Sensory Capsule (multiple SCUs grouped together)
    
    Steps:
    1. Receive payload
    2. Detect if single SCU or capsule
    3. Validate structure
    4. Verify integrity
    5. Forward to Ghost Pass
    6. Log for audit trail
    
    Returns:
        dict: Validation and forwarding result
    """
    try:
        # Step 1: Receive payload
        payload = await request.json()
        
        # Step 2: Detect payload type
        try:
            payload_type = detect_payload_type(payload)
        except ValueError as e:
            ConduitLogger.log_received(
                payload_type="unknown",
                source_id="unknown",
                scu_count=0,
                success=False,
                error=str(e)
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid payload format",
                    "message": str(e),
                    "expected": "Either a single SCU or a Sensory Capsule"
                }
            )
        
        # Step 3 & 4: Validate based on type
        if payload_type == "scu":
            return await handle_single_scu(payload)
        else:  # capsule
            return await handle_capsule(payload)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONDUIT] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "message": str(e)
            }
        )


async def handle_single_scu(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a single SCU payload.
    
    Args:
        payload: SCU dictionary
        
    Returns:
        dict: Validation and forwarding result
    """
    # Step 3: Validate structure
    is_valid, error = SCUValidator.validate_structure(payload)
    
    if not is_valid:
        # Log failure
        source_id = payload.get("metadata", {}).get("source_id", "unknown")
        ConduitLogger.log_received(
            payload_type="scu",
            source_id=source_id,
            scu_count=1,
            success=False,
            error=error
        )
        
        raise HTTPException(
            status_code=422,
            detail={
                "error": "SCU validation failed",
                "message": error,
                "payload_type": "scu"
            }
        )
    
    # Create validated SCU object
    scu = SensoryCargonUnit(**payload)
    
    # Step 4: Verify integrity (already done in validate_structure, but explicit check)
    if not scu.verify_integrity():
        ConduitLogger.log_received(
            payload_type="scu",
            source_id=scu.metadata.source_id,
            scu_count=1,
            success=False,
            error="Integrity hash verification failed"
        )
        
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Integrity verification failed",
                "message": "Signal may have been tampered with during transport",
                "payload_type": "scu"
            }
        )
    
    # Step 5: Store signal first (before Ghost Pass forwarding)
    signal_id = str(uuid.uuid4())
    
    # Add to monitor history BEFORE forwarding to ensure signal exists for foreign key
    add_signal_to_history({
        "signal_id": signal_id,
        "payload_type": "scu",
        "sensory_type": scu.sensory_type.value,
        "source_id": scu.metadata.source_id,
        "timestamp": scu.metadata.timestamp.isoformat(),
        "received_at": datetime.utcnow().isoformat(),
        "status": "unknown",  # Valid status value, will be updated after Ghost Pass
        "ghost_pass_approved": False,  # Will be updated after Ghost Pass
        "signal_data": scu.signal_data,
        "metadata": scu.metadata.dict(),
        "validation_result": {}  # Will be updated after Ghost Pass
    })
    
    # Step 6: Forward to Ghost Pass (now that signal exists in database)
    forward_result = await GhostPassForwarder.forward_single_scu(scu, signal_id)
    
    # Step 7: Update signal with Ghost Pass results
    from sensory_database import SensorySignalStore
    SensorySignalStore.update_signal(signal_id, {
        "status": forward_result.get("status", "unknown"),
        "ghost_pass_approved": forward_result.get("ready_for_senate", False),
        "validation_result": forward_result
    })
    
    # Step 8: Log success
    # Step 8: Log success
    log_entry = ConduitLogger.log_received(
        payload_type="scu",
        source_id=scu.metadata.source_id,
        scu_count=1,
        success=True
    )
    
    return {
        "status": "success",
        "message": "Single SCU received, validated, and forwarded",
        "payload_type": "scu",
        "signal_id": signal_id,
        "sensory_type": scu.sensory_type,
        "source_id": scu.metadata.source_id,
        "timestamp": scu.metadata.timestamp.isoformat(),
        "forwarding": forward_result,
        "audit_log": log_entry
    }


async def handle_capsule(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a Sensory Capsule payload (multiple SCUs).
    
    Args:
        payload: Capsule dictionary
        
    Returns:
        dict: Validation and forwarding result
    """
    try:
        # Step 3: Validate structure
        capsule = SensoryCapsule(**payload)
    except Exception as e:
        # Log failure
        source_id = payload.get("source_id", "unknown")
        ConduitLogger.log_received(
            payload_type="capsule",
            source_id=source_id,
            scu_count=len(payload.get("scus", [])),
            success=False,
            error=str(e)
        )
        
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Capsule validation failed",
                "message": str(e),
                "payload_type": "capsule"
            }
        )
    
    # Step 4: Verify integrity of all SCUs
    all_valid, errors = capsule.validate_all_scus()
    
    if not all_valid:
        ConduitLogger.log_received(
            payload_type="capsule",
            source_id=capsule.source_id,
            scu_count=len(capsule.scus),
            success=False,
            error="; ".join(errors)
        )
        
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Capsule integrity verification failed",
                "message": "One or more SCUs failed integrity check",
                "payload_type": "capsule",
                "errors": errors
            }
        )
    
    # Step 5: Store signal first (before Ghost Pass forwarding)
    capsule_id = capsule.capsule_id
    
    # Add to monitor history BEFORE forwarding to ensure signal exists for foreign key
    add_signal_to_history({
        "signal_id": capsule_id,
        "payload_type": "capsule",
        "capsule_id": capsule_id,
        "source_id": capsule.source_id,
        "timestamp": capsule.timestamp.isoformat(),
        "received_at": datetime.utcnow().isoformat(),
        "status": "unknown",  # Valid status value, will be updated after Ghost Pass
        "ghost_pass_approved": False,  # Will be updated after Ghost Pass
        "scu_count": len(capsule.scus),
        "sensory_types": [scu.sensory_type.value for scu in capsule.scus],
        "scus": [
            {
                "sensory_type": scu.sensory_type.value,
                "source_id": scu.metadata.source_id,
                "timestamp": scu.metadata.timestamp.isoformat(),
                "signal_data": scu.signal_data,
                "metadata": scu.metadata.dict()
            }
            for scu in capsule.scus
        ],
        "validation_result": {}  # Will be updated after Ghost Pass
    })
    
    # Step 6: Forward to Ghost Pass (now that signal exists in database)
    forward_result = await GhostPassForwarder.forward_capsule(capsule, capsule_id)
    
    # Step 7: Update signal with Ghost Pass results
    from sensory_database import SensorySignalStore
    SensorySignalStore.update_signal(capsule_id, {
        "status": forward_result.get("status", "unknown"),
        "ghost_pass_approved": forward_result.get("ready_for_senate", False),
        "validation_result": forward_result
    })
    
    # Step 8: Log success
    # Step 7: Log success
    log_entry = ConduitLogger.log_received(
        payload_type="capsule",
        source_id=capsule.source_id,
        scu_count=len(capsule.scus),
        success=True
    )
    
    return {
        "status": "success",
        "message": "Sensory Capsule received, validated, and forwarded",
        "payload_type": "capsule",
        "capsule_id": capsule.capsule_id,
        "source_id": capsule.source_id,
        "scu_count": len(capsule.scus),
        "sensory_types": [scu.sensory_type for scu in capsule.scus],
        "timestamp": capsule.timestamp.isoformat(),
        "forwarding": forward_result,
        "audit_log": log_entry
    }


@router.get("/health")
async def conduit_health():
    """Health check for Conduit endpoint"""
    return {
        "status": "operational",
        "endpoint": "/conduit/receive",
        "accepts": ["single_scu", "sensory_capsule"],
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/info")
async def conduit_info():
    """Information about the Conduit endpoint"""
    return {
        "name": "Conduit",
        "description": "Entry point for external sensory signals",
        "version": "1.0.0",
        "capabilities": {
            "accepts_single_scu": True,
            "accepts_capsule": True,
            "validates_structure": True,
            "verifies_integrity": True,
            "forwards_to_ghost_pass": True,
            "audit_logging": True
        },
        "payload_types": {
            "scu": {
                "description": "Single Sensory Cargo Unit",
                "required_fields": ["sensory_type", "signal_data", "metadata", "schema_version"]
            },
            "capsule": {
                "description": "Multiple SCUs grouped together",
                "required_fields": ["capsule_id", "timestamp", "source_id", "scus"]
            }
        }
    }
