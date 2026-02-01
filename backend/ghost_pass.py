"""
Ghost Pass Validation Layer

Security checkpoint that validates and normalizes sensory signals
before they reach the Senate. Implements device-bound wallet system
with cryptographic proofs and zero-custody credential management.
"""

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from enum import Enum
import logging
import hashlib
import hmac
import secrets
import json
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

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


class ProofType(Enum):
    """Cryptographic proof types"""
    AGE_VERIFIED = "age_verified"
    MEDICAL_CREDENTIAL = "medical_credential"
    ACCESS_CLASS = "access_class"


class AccessClass(Enum):
    """Access class levels"""
    GA = "GA"  # General Admission
    VIP = "VIP"  # VIP Access
    STAFF = "STAFF"  # Staff Access


class CryptographicProofEngine:
    """
    REQUIRED BUILD ITEM - Cryptographic Proof System
    Handles device-bound credential proofs without storing sensitive data.
    """
    
    def __init__(self):
        self.proof_secret = secrets.token_hex(32)  # Should be from env in production
    
    def generate_proof_signature(self, proof_data: Dict[str, Any], device_fingerprint: str) -> str:
        """Generate cryptographic signature for proof"""
        # Create deterministic proof payload
        proof_payload = json.dumps(proof_data, sort_keys=True)
        
        # Combine with device fingerprint for device binding
        combined_data = f"{proof_payload}:{device_fingerprint}"
        
        # Generate HMAC signature
        signature = hmac.new(
            self.proof_secret.encode(),
            combined_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_proof_signature(self, proof_data: Dict[str, Any], device_fingerprint: str, signature: str) -> bool:
        """Verify cryptographic signature for proof"""
        expected_signature = self.generate_proof_signature(proof_data, device_fingerprint)
        return hmac.compare_digest(signature, expected_signature)
    
    def create_age_verification_proof(self, is_verified: bool, device_fingerprint: str) -> Dict[str, Any]:
        """Create age verification proof (true/false only)"""
        proof_data = {
            "proof_type": ProofType.AGE_VERIFIED.value,
            "verified": is_verified,
            "timestamp": datetime.utcnow().isoformat(),
            "proof_id": secrets.token_hex(16)
        }
        
        signature = self.generate_proof_signature(proof_data, device_fingerprint)
        
        return {
            "proof_data": proof_data,
            "signature": signature,
            "device_fingerprint": device_fingerprint
        }
    
    def create_medical_credential_proof(self, has_credential: bool, device_fingerprint: str) -> Dict[str, Any]:
        """Create medical credential proof (present/not present only)"""
        proof_data = {
            "proof_type": ProofType.MEDICAL_CREDENTIAL.value,
            "credential_present": has_credential,
            "timestamp": datetime.utcnow().isoformat(),
            "proof_id": secrets.token_hex(16)
        }
        
        signature = self.generate_proof_signature(proof_data, device_fingerprint)
        
        return {
            "proof_data": proof_data,
            "signature": signature,
            "device_fingerprint": device_fingerprint
        }
    
    def create_access_class_proof(self, access_class: AccessClass, device_fingerprint: str) -> Dict[str, Any]:
        """Create access class proof (GA/VIP/STAFF)"""
        proof_data = {
            "proof_type": ProofType.ACCESS_CLASS.value,
            "access_class": access_class.value,
            "timestamp": datetime.utcnow().isoformat(),
            "proof_id": secrets.token_hex(16)
        }
        
        signature = self.generate_proof_signature(proof_data, device_fingerprint)
        
        return {
            "proof_data": proof_data,
            "signature": signature,
            "device_fingerprint": device_fingerprint
        }


class BiometricVerificationEngine:
    """
    REQUIRED BUILD ITEM - Biometric Verification
    Handles device-bound biometric verification without storing biometric data.
    """
    
    def __init__(self):
        self.verification_secret = secrets.token_hex(32)  # Should be from env in production
    
    def generate_biometric_challenge(self, device_fingerprint: str) -> str:
        """Generate biometric challenge for device"""
        challenge_data = f"{device_fingerprint}:{datetime.utcnow().isoformat()}:{secrets.token_hex(8)}"
        return base64.b64encode(challenge_data.encode()).decode()
    
    def verify_biometric_response(self, challenge: str, biometric_hash: str, device_fingerprint: str) -> bool:
        """Verify biometric response against challenge"""
        try:
            # Decode challenge
            challenge_data = base64.b64decode(challenge.encode()).decode()
            challenge_parts = challenge_data.split(':')
            
            if len(challenge_parts) != 3:
                return False
            
            challenge_device, challenge_timestamp, challenge_nonce = challenge_parts
            
            # Verify device fingerprint matches
            if challenge_device != device_fingerprint:
                return False
            
            # Verify challenge is fresh (within 5 minutes)
            challenge_time = datetime.fromisoformat(challenge_timestamp)
            if datetime.utcnow() - challenge_time > timedelta(minutes=5):
                return False
            
            # Verify biometric hash format (should be SHA256)
            if len(biometric_hash) != 64:
                return False
            
            # In production, this would verify against secure enclave/biometric hardware
            # For now, we validate the hash format and freshness
            return True
            
        except Exception as e:
            logger.error(f"Biometric verification error: {e}")
            return False
    
    def generate_device_attestation(self, device_fingerprint: str, biometric_hash: str) -> str:
        """Generate device attestation token"""
        attestation_data = {
            "device_fingerprint": device_fingerprint,
            "biometric_bound": True,
            "timestamp": datetime.utcnow().isoformat(),
            "attestation_id": secrets.token_hex(16)
        }
        
        # Generate attestation signature
        attestation_payload = json.dumps(attestation_data, sort_keys=True)
        signature = hmac.new(
            self.verification_secret.encode(),
            attestation_payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{base64.b64encode(attestation_payload.encode()).decode()}.{signature}"


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
    
    # GHOST PASS MODE CONFIGURATION
    # Controls whether Ghost Pass purchase is required or pay-per-scan
    CONTEXT_MODES: Dict[str, Dict[str, Any]] = {
        # Default contexts - can be overridden per venue/context
        "default": {
            "pass_required": False,  # Pay-per-scan mode
            "per_scan_fee_cents": 25,  # $0.25 per scan
            "pass_options": []
        },
        "club": {
            "pass_required": False,  # Pay-per-scan for clubs/bars
            "per_scan_fee_cents": 50,  # $0.50 per scan
            "pass_options": []
        },
        "bar": {
            "pass_required": False,  # Pay-per-scan for bars
            "per_scan_fee_cents": 25,  # $0.25 per scan
            "pass_options": []
        },
        "event": {
            "pass_required": True,   # Event mode - pass required
            "per_scan_fee_cents": 0,  # No per-scan fee when pass required
            "pass_options": [
                {
                    "id": "1day",
                    "name": "1-Day Pass",
                    "price_cents": 2500,  # $25.00
                    "duration_hours": 24,
                    "includes": ["entry", "vendors"]
                },
                {
                    "id": "3day",
                    "name": "3-Day Pass", 
                    "price_cents": 6000,  # $60.00
                    "duration_hours": 72,
                    "includes": ["entry", "vendors", "vip_areas"]
                },
                {
                    "id": "weekend",
                    "name": "Weekend Pass",
                    "price_cents": 4500,  # $45.00
                    "duration_hours": 48,
                    "includes": ["entry", "vendors"]
                }
            ]
        },
        "festival": {
            "pass_required": True,   # Festival mode - pass required
            "per_scan_fee_cents": 0,
            "pass_options": [
                {
                    "id": "single_day",
                    "name": "Single Day",
                    "price_cents": 7500,  # $75.00
                    "duration_hours": 16,
                    "includes": ["entry", "vendors", "stages"]
                },
                {
                    "id": "full_festival",
                    "name": "Full Festival Pass",
                    "price_cents": 20000,  # $200.00
                    "duration_hours": 96,
                    "includes": ["entry", "vendors", "stages", "vip_areas", "camping"]
                }
            ]
        }
    }


# Global instances
cryptographic_proof_engine = CryptographicProofEngine()
biometric_verification_engine = BiometricVerificationEngine()


class GhostPass:
    """
    Main Ghost Pass validation layer.
    
    Validates and normalizes sensory signals before Senate processing.
    Supports two modes:
    1. Pay-per-scan: Users can scan/tap immediately, charged per interaction
    2. Event mode: Users must purchase a pass first, then scan/tap for entry
    """
    
    def __init__(self, context: str = "default"):
        self.context = context
        self.validation_timestamp = datetime.utcnow()
        self.mode_config = self._get_context_mode_config(context)
    
    def _get_context_mode_config(self, context: str) -> Dict[str, Any]:
        """Get mode configuration for the given context."""
        return GhostPassConfig.CONTEXT_MODES.get(context, GhostPassConfig.CONTEXT_MODES["default"])
    
    def get_context_info(self) -> Dict[str, Any]:
        """
        Get context information including mode and pricing.
        
        Returns:
            dict: Context configuration including pass requirements and pricing
        """
        return {
            "context": self.context,
            "pass_required": self.mode_config["pass_required"],
            "per_scan_fee_cents": self.mode_config["per_scan_fee_cents"],
            "pass_options": self.mode_config["pass_options"],
            "mode": "event" if self.mode_config["pass_required"] else "pay_per_scan"
        }
    
    def check_access_requirements(self, wallet_binding_id: str, ghost_pass_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if user meets access requirements for this context.
        
        Args:
            wallet_binding_id: User's wallet binding ID
            ghost_pass_token: Optional Ghost Pass token (for event mode)
            
        Returns:
            dict: Access check result with requirements and pricing
        """
        context_info = self.get_context_info()
        
        if not self.mode_config["pass_required"]:
            # Pay-per-scan mode - always allowed, just charge per scan
            return {
                "access_granted": True,
                "mode": "pay_per_scan",
                "requires_payment": True,
                "payment_amount_cents": self.mode_config["per_scan_fee_cents"],
                "payment_description": f"Per-scan fee for {self.context}",
                "context_info": context_info
            }
        else:
            # Event mode - check for valid pass
            if not ghost_pass_token:
                return {
                    "access_granted": False,
                    "mode": "event",
                    "requires_pass_purchase": True,
                    "pass_options": self.mode_config["pass_options"],
                    "message": "Ghost Pass required for this venue",
                    "context_info": context_info
                }
            
            # Validate the Ghost Pass token
            pass_validation = self._validate_ghost_pass_token(ghost_pass_token, wallet_binding_id)
            
            if pass_validation["valid"]:
                return {
                    "access_granted": True,
                    "mode": "event",
                    "requires_payment": False,
                    "pass_info": pass_validation["pass_info"],
                    "context_info": context_info
                }
            else:
                return {
                    "access_granted": False,
                    "mode": "event",
                    "requires_pass_purchase": True,
                    "pass_options": self.mode_config["pass_options"],
                    "message": pass_validation["error"],
                    "context_info": context_info
                }
    
    def _validate_ghost_pass_token(self, ghost_pass_token: str, wallet_binding_id: str) -> Dict[str, Any]:
        """
        Validate a Ghost Pass token for event mode.
        
        Args:
            ghost_pass_token: The Ghost Pass token to validate
            wallet_binding_id: User's wallet binding ID
            
        Returns:
            dict: Validation result
        """
        try:
            # In production, this would query the database for the pass
            # For now, we'll simulate pass validation
            
            # Check if pass is revoked (this would be a real DB call)
            # if is_ghost_pass_revoked(ghost_pass_token):
            #     return {"valid": False, "error": "Ghost Pass has been revoked"}
            
            # Simulate pass validation - in production this would be a proper DB lookup
            # For demo purposes, we'll accept any token that looks like a valid format
            if len(ghost_pass_token) >= 16:  # Basic format check
                return {
                    "valid": True,
                    "pass_info": {
                        "token": ghost_pass_token,
                        "type": "event_pass",
                        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
                        "includes": ["entry", "vendors"],
                        "wallet_binding_id": wallet_binding_id
                    }
                }
            else:
                return {"valid": False, "error": "Invalid Ghost Pass token format"}
                
        except Exception as e:
            logger.error(f"Ghost Pass token validation error: {e}")
            return {"valid": False, "error": "Ghost Pass validation failed"}
    
    def create_interaction_context(self, wallet_binding_id: str, interaction_method: str, 
                                 ghost_pass_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Create interaction context for processing.
        
        Args:
            wallet_binding_id: User's wallet binding ID
            interaction_method: 'QR' or 'NFC'
            ghost_pass_token: Optional Ghost Pass token
            
        Returns:
            dict: Interaction context with pricing and requirements
        """
        access_check = self.check_access_requirements(wallet_binding_id, ghost_pass_token)
        
        return {
            "context": self.context,
            "wallet_binding_id": wallet_binding_id,
            "interaction_method": interaction_method,
            "ghost_pass_token": ghost_pass_token,
            "access_check": access_check,
            "timestamp": self.validation_timestamp.isoformat(),
            "interaction_id": secrets.token_hex(16)
        }
    
    def validate_single_scu(self, scu: SensoryCargonUnit) -> Tuple[ValidationResult, Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate a single SCU through all checks.
        
        Args:
            scu: SCU to validate
            
        Returns:
            tuple: (result, normalized_scu, errors)
        """
        errors = []
        
        # Basic validation - in production this would be more comprehensive
        try:
            # Check if SCU has required fields
            if not hasattr(scu, 'sensory_type') or not scu.sensory_type:
                errors.append({"rule": "SENSORY_TYPE_REQUIRED", "message": "Missing sensory_type"})
            
            if not hasattr(scu, 'signal_data') or not scu.signal_data:
                errors.append({"rule": "SIGNAL_DATA_REQUIRED", "message": "Missing signal_data"})
            
            if not hasattr(scu, 'metadata') or not scu.metadata:
                errors.append({"rule": "METADATA_REQUIRED", "message": "Missing metadata"})
            
            # Check timestamp freshness if metadata exists
            if hasattr(scu, 'metadata') and scu.metadata and hasattr(scu.metadata, 'timestamp'):
                timestamp = scu.metadata.timestamp
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                
                age = (datetime.utcnow() - timestamp.replace(tzinfo=None)).total_seconds()
                if age > GhostPassConfig.MAX_SIGNAL_AGE_SECONDS:
                    errors.append({
                        "rule": "TIMESTAMP_FRESH", 
                        "message": f"Signal too old: {age:.0f}s (max: {GhostPassConfig.MAX_SIGNAL_AGE_SECONDS}s)"
                    })
        
        except Exception as e:
            errors.append({"rule": "VALIDATION_ERROR", "message": f"Validation error: {str(e)}"})
        
        # Determine result
        if errors:
            logger.warning(f"[GHOST PASS] SCU validation failed: {len(errors)} errors")
            return ValidationResult.FAILED, None, errors
        
        # Create normalized SCU
        normalized = {
            "scu": {
                "sensory_type": scu.sensory_type.value if hasattr(scu.sensory_type, 'value') else str(scu.sensory_type),
                "signal_data": scu.signal_data,
                "metadata": {
                    "timestamp": scu.metadata.timestamp.isoformat() if hasattr(scu.metadata.timestamp, 'isoformat') else str(scu.metadata.timestamp),
                    "source_id": scu.metadata.source_id if hasattr(scu.metadata, 'source_id') else "unknown"
                }
            },
            "ghost_pass_metadata": {
                "validation_timestamp": self.validation_timestamp.isoformat(),
                "approved": True,
                "validator": "ghost_pass_v1"
            }
        }
        
        logger.info(f"[GHOST PASS] SCU validated: {scu.sensory_type}")
        return ValidationResult.PASSED, normalized, []
    
    def validate_capsule(self, capsule: SensoryCapsule) -> Tuple[ValidationResult, List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate a Sensory Capsule (multiple SCUs).
        
        Args:
            capsule: Capsule to validate
            
        Returns:
            tuple: (result, normalized_scus, errors)
        """
        normalized_scus = []
        all_errors = []
        
        logger.info(f"[GHOST PASS] Validating capsule: {len(capsule.scus)} SCUs")
        
        # Validate each SCU independently
        for idx, scu in enumerate(capsule.scus):
            result, normalized, errors = self.validate_single_scu(scu)
            
            if result == ValidationResult.PASSED:
                normalized_scus.append(normalized)
            else:
                # Add index to errors
                for error in errors:
                    error["scu_index"] = idx
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
        try:
            # Detect payload type
            if "capsule_id" in payload and "scus" in payload:
                # It's a capsule
                capsule = SensoryCapsule(**payload)
                result, normalized_scus, errors = self.validate_capsule(capsule)
                
                if result == ValidationResult.PASSED:
                    return {
                        "status": "approved",
                        "payload_type": "capsule",
                        "capsule_id": capsule.capsule_id,
                        "source_id": getattr(capsule, 'source_id', 'unknown'),
                        "scu_count": len(normalized_scus),
                        "normalized_scus": normalized_scus,
                        "validation_timestamp": self.validation_timestamp.isoformat(),
                        "ready_for_senate": True
                    }
                else:
                    return {
                        "status": "rejected",
                        "payload_type": "capsule",
                        "capsule_id": capsule.capsule_id,
                        "source_id": getattr(capsule, 'source_id', 'unknown'),
                        "scu_count": len(capsule.scus),
                        "errors": errors,
                        "validation_timestamp": self.validation_timestamp.isoformat(),
                        "ready_for_senate": False
                    }
            else:
                # It's a single SCU
                scu = SensoryCargonUnit(**payload)
                result, normalized, errors = self.validate_single_scu(scu)
                
                if result == ValidationResult.PASSED:
                    return {
                        "status": "approved",
                        "payload_type": "scu",
                        "sensory_type": scu.sensory_type.value if hasattr(scu.sensory_type, 'value') else str(scu.sensory_type),
                        "source_id": getattr(scu.metadata, 'source_id', 'unknown') if hasattr(scu, 'metadata') else 'unknown',
                        "normalized_scu": normalized,
                        "validation_timestamp": self.validation_timestamp.isoformat(),
                        "ready_for_senate": True
                    }
                else:
                    return {
                        "status": "rejected",
                        "payload_type": "scu",
                        "sensory_type": scu.sensory_type.value if hasattr(scu.sensory_type, 'value') else str(scu.sensory_type),
                        "source_id": getattr(scu.metadata, 'source_id', 'unknown') if hasattr(scu, 'metadata') else 'unknown',
                        "errors": errors,
                        "validation_timestamp": self.validation_timestamp.isoformat(),
                        "ready_for_senate": False
                    }
        
        except Exception as e:
            logger.error(f"[GHOST PASS] Processing error: {e}")
            return {
                "status": "rejected",
                "payload_type": "unknown",
                "errors": [{"rule": "PROCESSING_ERROR", "message": str(e)}],
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
        
        try:
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
                        sensory_types.append(str(sensory_type))
                else:
                    # For single SCU, use the sensory_type field
                    sensory_type = normalized_data.get("sensory_type")
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
        
        except Exception as e:
            logger.error(f"[GHOST PASS->SENATE] Forwarding error: {e}")
            return {
                "forwarded": False,
                "destination": "senate",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }