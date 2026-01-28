"""
Device-Bound Wallet System for Ghost Pass
Implements custody model where credentials never leave device.
"""

import hashlib
import secrets
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4
import logging

logger = logging.getLogger(__name__)

class InteractionMethod(str, Enum):
    QR = "QR"
    NFC = "NFC"

class ProofType(str, Enum):
    AGE_VERIFIED = "age_verified"
    MEDICAL_CREDENTIAL = "medical_credential"
    ACCESS_CLASS = "access_class"

class AccessClass(str, Enum):
    GA = "GA"  # General Admission
    VIP = "VIP"
    STAFF = "STAFF"

class DeviceWalletBinding:
    """
    Device-bound wallet that never stores sensitive credentials.
    Only handles cryptographic proofs and attestations.
    """
    
    def __init__(self, device_fingerprint: str, biometric_hash: str, user_id: str):
        self.device_fingerprint = device_fingerprint
        self.biometric_hash = biometric_hash
        self.user_id = user_id
        self.wallet_binding_id = self._generate_binding_id()
        self.ghost_pass_token = self._generate_ghost_pass_token()
        self.created_at = datetime.now(timezone.utc)
        
    def _generate_binding_id(self) -> str:
        """Generate device-bound wallet identifier"""
        # Combine device fingerprint + biometric hash + user_id for unique binding
        combined = f"{self.device_fingerprint}:{self.biometric_hash}:{self.user_id}"
        return hashlib.sha256(combined.encode()).hexdigest()[:32]
    
    def _generate_ghost_pass_token(self) -> str:
        """Generate Ghost Pass token bound to device"""
        # Token includes binding ID + random salt for security
        salt = secrets.token_hex(16)
        token_data = f"{self.wallet_binding_id}:{salt}:{self.created_at.isoformat()}"
        return hashlib.sha256(token_data.encode()).hexdigest()
    
    def verify_device_binding(self, device_fingerprint: str, biometric_hash: str) -> bool:
        """Verify that the request comes from the bound device"""
        return (self.device_fingerprint == device_fingerprint and 
                self.biometric_hash == biometric_hash)
    
    def generate_proof(self, proof_type: ProofType, value: Any) -> Dict[str, Any]:
        """
        Generate cryptographic proof without storing sensitive data.
        Returns attestation only - no raw credentials.
        """
        proof_id = str(uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create proof payload (no sensitive data stored)
        proof_payload = {
            "proof_id": proof_id,
            "proof_type": proof_type.value,
            "wallet_binding_id": self.wallet_binding_id,
            "ghost_pass_token": self.ghost_pass_token,
            "timestamp": timestamp,
            "device_fingerprint": self.device_fingerprint[:8],  # Partial for verification
        }
        
        # Generate different proof formats based on type
        if proof_type == ProofType.AGE_VERIFIED:
            proof_payload["verified"] = bool(value)  # true/false only
        elif proof_type == ProofType.MEDICAL_CREDENTIAL:
            proof_payload["present"] = bool(value)  # true/false only
        elif proof_type == ProofType.ACCESS_CLASS:
            if value not in [cls.value for cls in AccessClass]:
                raise ValueError(f"Invalid access class: {value}")
            proof_payload["access_class"] = value
        
        # Sign the proof (in production, use proper cryptographic signing)
        proof_signature = self._sign_proof(proof_payload)
        proof_payload["signature"] = proof_signature
        
        return proof_payload
    
    def _sign_proof(self, proof_payload: Dict[str, Any]) -> str:
        """Sign the proof payload (simplified for demo)"""
        # In production: use proper ECDSA or RSA signing
        payload_str = json.dumps(proof_payload, sort_keys=True)
        signature_data = f"{payload_str}:{self.ghost_pass_token}"
        return hashlib.sha256(signature_data.encode()).hexdigest()
    
    def verify_proof(self, proof: Dict[str, Any]) -> bool:
        """Verify a cryptographic proof"""
        try:
            # Extract signature
            signature = proof.pop("signature", None)
            if not signature:
                return False
            
            # Recreate signature
            expected_signature = self._sign_proof(proof)
            
            # Restore signature to proof
            proof["signature"] = signature
            
            return signature == expected_signature
        except Exception as e:
            logger.error(f"Proof verification failed: {e}")
            return False

def create_device_wallet_binding(device_fingerprint: str, biometric_hash: str, user_id: str) -> DeviceWalletBinding:
    """Factory function to create device-bound wallet"""
    return DeviceWalletBinding(device_fingerprint, biometric_hash, user_id)