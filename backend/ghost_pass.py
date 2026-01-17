"""
Ghost Pass Validation Layer

Security checkpoint that validates and normalizes sensory signals
before they reach the Senate.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum
import logging

from scu import SensoryCargonUnit, SensoryCapsule, SensoryType

# Configure logging
logger = logging.getLogger(__name__)


class ValidationResult(Enum):
    """Validation result status"""
    PASSED = "PASSED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"


class PolicyRule(Enum):
    """Policy enforcement rules"""
    SENSORY_TYPE_ALLOWED = "sensory_type_allowed"
    SOURCE_AUTHORIZED = "source_authorized"
    TIMESTAMP_FRESH = "timestamp_fresh"
    SIGNAL_RANGE_VALID = "signal_range_valid"


class GhostPassConfig:
    """Configuration for Ghost Pass validation"""
    
    # Schema version requirements
    SUPPORTED_SCHEMA_VERSIONS = ["1.0.0"]
    
    # Timestamp freshness (signals older than this are rejected)
    MAX_SIGNAL_AGE_SECONDS = 300  # 5 minutes
    
    # Authorized source IDs (empty list = all allowed)
    AUTHORIZED_SOURCES: List[str] = []
    
    # Blocked source IDs
    BLOCKED_SOURCES: List[str] = []
    
    # Allowed sensory types per context (empty = all allowed)
    ALLOWED_SENSORY_TYPES: Dict[str, List[SensoryType]] = {}
    
    @classmethod
    def is_source_authorized(cls, source_id: str) -> bool:
        """Check if source is authorized"""
        # If in blocked list, reject
        if source_id in cls.BLOCKED_SOURCES:
            return False
        
        # If authorized list is empty, allow all (except blocked)
        if not cls.AUTHORIZED_SOURCES:
            return True
        
        # Otherwise, must be in authorized list
        return source_id in cls.AUTHORIZED_SOURCES
    
    @classmethod
    def is_sensory_type_allowed(cls, sensory_type: SensoryType, context: str = "default") -> bool:
        """Check if sensory type is allowed for this context"""
        # If no restrictions defined, allow all
        if context not in cls.ALLOWED_SENSORY_TYPES:
            return True
        
        return sensory_type in cls.ALLOWED_SENSORY_TYPES[context]
    
    @classmethod
    def is_timestamp_fresh(cls, timestamp: datetime) -> bool:
        """Check if timestamp is recent (not replayed)"""
        now = datetime.utcnow()
        
        # Handle timezone-aware timestamps by converting to naive UTC
        if timestamp.tzinfo is not None:
            timestamp = timestamp.replace(tzinfo=None)
        
        age = (now - timestamp).total_seconds()
        return age <= cls.MAX_SIGNAL_AGE_SECONDS


class NormalizedSCU:
    """
    Normalized SCU format for internal processing.
    
    Adds Ghost Pass validation metadata to the original SCU.
    """
    
    def __init__(self, original_scu: SensoryCargonUnit, validation_timestamp: datetime):
        self.original_scu = original_scu
        self.validation_timestamp = validation_timestamp
        self.ghost_pass_approved = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Senate processing"""
        return {
            "scu": self.original_scu.to_dict(),
            "ghost_pass_metadata": {
                "validation_timestamp": self.validation_timestamp.isoformat(),
                "approved": self.ghost_pass_approved,
                "validator": "ghost_pass_v1"
            }
        }


class ValidationError:
    """Represents a validation failure"""
    
    def __init__(self, rule: PolicyRule, message: str, scu_index: Optional[int] = None):
        self.rule = rule
        self.message = message
        self.scu_index = scu_index
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule.value,
            "message": self.message,
            "scu_index": self.scu_index,
            "timestamp": self.timestamp.isoformat()
        }


class SchemaValidator:
    """Validates SCU schema compliance"""
    
    @staticmethod
    def validate_schema_version(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Verify SCU schema version is supported.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if scu.schema_version not in GhostPassConfig.SUPPORTED_SCHEMA_VERSIONS:
            return False, f"Unsupported schema version: {scu.schema_version}"
        return True, None
    
    @staticmethod
    def validate_required_fields(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Check if all required fields are present.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        # Check top-level fields
        if not scu.sensory_type:
            return False, "Missing sensory_type"
        
        if not scu.signal_data:
            return False, "Missing signal_data"
        
        if not scu.metadata:
            return False, "Missing metadata"
        
        # Check metadata fields
        if not scu.metadata.timestamp:
            return False, "Missing metadata.timestamp"
        
        if not scu.metadata.source_id:
            return False, "Missing metadata.source_id"
        
        if not scu.metadata.integrity_hash:
            return False, "Missing metadata.integrity_hash"
        
        return True, None
    
    @staticmethod
    def validate_data_types(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Confirm data types are correct.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        # Check sensory_type is valid enum
        if not isinstance(scu.sensory_type, SensoryType):
            return False, f"Invalid sensory_type: {scu.sensory_type}"
        
        # Check signal_data is dict
        if not isinstance(scu.signal_data, dict):
            return False, "signal_data must be a dictionary"
        
        # Check timestamp is datetime
        if not isinstance(scu.metadata.timestamp, datetime):
            return False, "metadata.timestamp must be datetime"
        
        # Check source_id is string
        if not isinstance(scu.metadata.source_id, str):
            return False, "metadata.source_id must be string"
        
        # Check integrity_hash is string
        if not isinstance(scu.metadata.integrity_hash, str):
            return False, "metadata.integrity_hash must be string"
        
        return True, None


class IntegrityValidator:
    """Second-layer integrity verification"""
    
    @staticmethod
    def verify_integrity_hash(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Re-verify integrity hash.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not scu.verify_integrity():
            return False, "Integrity hash verification failed"
        return True, None
    
    @staticmethod
    def check_timestamp_freshness(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Check timestamp is recent (not replayed).
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not GhostPassConfig.is_timestamp_fresh(scu.metadata.timestamp):
            now = datetime.utcnow()
            timestamp = scu.metadata.timestamp
            
            # Handle timezone-aware timestamps
            if timestamp.tzinfo is not None:
                timestamp = timestamp.replace(tzinfo=None)
            
            age = (now - timestamp).total_seconds()
            return False, f"Signal too old: {age:.0f}s (max: {GhostPassConfig.MAX_SIGNAL_AGE_SECONDS}s)"
        return True, None
    
    @staticmethod
    def verify_source_authorization(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Confirm source_id is authorized.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not GhostPassConfig.is_source_authorized(scu.metadata.source_id):
            return False, f"Unauthorized source: {scu.metadata.source_id}"
        return True, None


class PolicyEnforcer:
    """Enforces policy rules on signals"""
    
    @staticmethod
    def check_sensory_type_allowed(scu: SensoryCargonUnit, context: str = "default") -> tuple[bool, Optional[str]]:
        """
        Check if sensory type is allowed for this context.
        
        Args:
            scu: SCU to validate
            context: Context identifier (e.g., venue_id, user_id)
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not GhostPassConfig.is_sensory_type_allowed(scu.sensory_type, context):
            return False, f"Sensory type {scu.sensory_type} not allowed in context {context}"
        return True, None
    
    @staticmethod
    def check_signal_ranges(scu: SensoryCargonUnit) -> tuple[bool, Optional[str]]:
        """
        Check if signals are within expected ranges (if defined).
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        # Placeholder for future range validation
        # Could check things like:
        # - Confidence scores between 0 and 1
        # - Pressure values within physical limits
        # - Timestamps not in the future
        # etc.
        
        return True, None


class GhostPass:
    """
    Main Ghost Pass validation layer.
    
    Validates and normalizes sensory signals before Senate processing.
    """
    
    def __init__(self, context: str = "default"):
        self.context = context
        self.validation_timestamp = datetime.utcnow()
    
    def validate_single_scu(self, scu: SensoryCargonUnit) -> tuple[ValidationResult, Optional[NormalizedSCU], List[ValidationError]]:
        """
        Validate a single SCU through all checks.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (result, normalized_scu, errors)
        """
        errors = []
        
        # Step 2: Schema Validation
        is_valid, error = SchemaValidator.validate_schema_version(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SENSORY_TYPE_ALLOWED, error))
        
        is_valid, error = SchemaValidator.validate_required_fields(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SENSORY_TYPE_ALLOWED, error))
        
        is_valid, error = SchemaValidator.validate_data_types(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SENSORY_TYPE_ALLOWED, error))
        
        # Step 3: Integrity Check (Second Layer)
        is_valid, error = IntegrityValidator.verify_integrity_hash(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SIGNAL_RANGE_VALID, error))
        
        is_valid, error = IntegrityValidator.check_timestamp_freshness(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.TIMESTAMP_FRESH, error))
        
        is_valid, error = IntegrityValidator.verify_source_authorization(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SOURCE_AUTHORIZED, error))
        
        # Step 4: Policy Enforcement
        is_valid, error = PolicyEnforcer.check_sensory_type_allowed(scu, self.context)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SENSORY_TYPE_ALLOWED, error))
        
        is_valid, error = PolicyEnforcer.check_signal_ranges(scu)
        if not is_valid:
            errors.append(ValidationError(PolicyRule.SIGNAL_RANGE_VALID, error))
        
        # Determine result
        if errors:
            logger.warning(f"[GHOST PASS] SCU validation failed: {len(errors)} errors")
            return ValidationResult.FAILED, None, errors
        
        # Step 5: Normalize Format
        normalized = NormalizedSCU(scu, self.validation_timestamp)
        
        logger.info(f"[GHOST PASS] SCU validated: {scu.sensory_type} from {scu.metadata.source_id}")
        return ValidationResult.PASSED, normalized, []
    
    def validate_capsule(self, capsule: SensoryCapsule) -> tuple[ValidationResult, List[NormalizedSCU], List[ValidationError]]:
        """
        Validate a Sensory Capsule (multiple SCUs).
        
        Args:
            capsule: Capsule to validate
            
        Returns:
            tuple: (result, normalized_scus, errors)
        """
        normalized_scus = []
        all_errors = []
        
        logger.info(f"[GHOST PASS] Validating capsule: {len(capsule.scus)} SCUs from {capsule.source_id}")
        
        # Validate each SCU independently
        for idx, scu in enumerate(capsule.scus):
            result, normalized, errors = self.validate_single_scu(scu)
            
            if result == ValidationResult.PASSED:
                normalized_scus.append(normalized)
            else:
                # Add index to errors
                for error in errors:
                    error.scu_index = idx
                all_errors.extend(errors)
        
        # Determine overall result
        if all_errors:
            logger.warning(f"[GHOST PASS] Capsule validation failed: {len(all_errors)} errors across {len(capsule.scus)} SCUs")
            return ValidationResult.FAILED, normalized_scus, all_errors
        
        logger.info(f"[GHOST PASS] Capsule validated: {len(normalized_scus)} SCUs approved")
        return ValidationResult.PASSED, normalized_scus, []
    
    def process_from_conduit(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process payload received from Conduit.
        
        Args:
            payload: Either single SCU dict or Capsule dict
            
        Returns:
            dict: Processing result with normalized data or errors
        """
        # Step 1: Receive from Conduit
        # Detect payload type
        if "capsule_id" in payload and "scus" in payload:
            # It's a capsule
            capsule = SensoryCapsule(**payload)
            result, normalized_scus, errors = self.validate_capsule(capsule)
            
            if result == ValidationResult.PASSED:
                # Step 6: Forward to Senate
                return {
                    "status": "approved",
                    "payload_type": "capsule",
                    "capsule_id": capsule.capsule_id,
                    "source_id": capsule.source_id,
                    "scu_count": len(normalized_scus),
                    "normalized_scus": [scu.to_dict() for scu in normalized_scus],
                    "validation_timestamp": self.validation_timestamp.isoformat(),
                    "ready_for_senate": True
                }
            else:
                return {
                    "status": "rejected",
                    "payload_type": "capsule",
                    "capsule_id": capsule.capsule_id,
                    "source_id": capsule.source_id,
                    "scu_count": len(capsule.scus),
                    "errors": [error.to_dict() for error in errors],
                    "validation_timestamp": self.validation_timestamp.isoformat(),
                    "ready_for_senate": False
                }
        else:
            # It's a single SCU
            scu = SensoryCargonUnit(**payload)
            result, normalized, errors = self.validate_single_scu(scu)
            
            if result == ValidationResult.PASSED:
                # Step 6: Forward to Senate
                return {
                    "status": "approved",
                    "payload_type": "scu",
                    "sensory_type": scu.sensory_type.value,
                    "source_id": scu.metadata.source_id,
                    "normalized_scu": normalized.to_dict(),
                    "validation_timestamp": self.validation_timestamp.isoformat(),
                    "ready_for_senate": True
                }
            else:
                return {
                    "status": "rejected",
                    "payload_type": "scu",
                    "sensory_type": scu.sensory_type.value,
                    "source_id": scu.metadata.source_id,
                    "errors": [error.to_dict() for error in errors],
                    "validation_timestamp": self.validation_timestamp.isoformat(),
                    "ready_for_senate": False
                }


class SenateForwarder:
    """Forwards validated signals to Senate"""
    
    @staticmethod
    async def forward_to_senate(normalized_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Forward normalized signals to Senate for governance decisions.
        
        Args:
            normalized_data: Validated and normalized signal data
            
        Returns:
            dict: Forwarding result
        """
        logger.info(f"[GHOST PASS->SENATE] Forwarding validated signals")
        
        # Add to Senate pending evaluations
        from routes.senate import add_to_pending
        
        if normalized_data.get("status") == "approved":
            # Extract sensory types based on payload type
            if normalized_data.get("payload_type") == "capsule":
                # For capsules, extract sensory_type from each normalized SCU
                normalized_scus = normalized_data.get("normalized_scus", [])
                sensory_types = []
                for scu_dict in normalized_scus:
                    sensory_type = scu_dict.get("scu", {}).get("sensory_type")
                    # Handle both enum objects and string values
                    if hasattr(sensory_type, 'value'):
                        sensory_types.append(sensory_type.value)
                    else:
                        sensory_types.append(str(sensory_type))
            else:
                # For single SCU, use the sensory_type field
                sensory_type = normalized_data.get("sensory_type")
                if hasattr(sensory_type, 'value'):
                    sensory_types = [sensory_type.value]
                else:
                    sensory_types = [str(sensory_type)]
            
            # Use the signal_id passed from conduit, or generate one
            signal_id = normalized_data.get("signal_id", f"sig_{int(datetime.utcnow().timestamp())}")
            
            # Extract signal data for Senate
            signal_data = {
                "signal_id": signal_id,
                "payload_type": normalized_data.get("payload_type"),
                "source_id": normalized_data.get("source_id"),
                "timestamp": normalized_data.get("validation_timestamp"),
                "sensory_type": normalized_data.get("sensory_type"),
                "sensory_types": sensory_types,
                "scu_count": normalized_data.get("scu_count", 1),
                "normalized_data": normalized_data
            }
            
            add_to_pending(signal_data)
        
        return {
            "forwarded": True,
            "destination": "senate",
            "timestamp": datetime.utcnow().isoformat()
        }
