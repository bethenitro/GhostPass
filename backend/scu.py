"""
Sensory Cargo Unit (SCU) Data Structure

A standardized format for receiving external sensory signals.
Each SCU is a standalone, auditable package of information.
"""

from typing import Any, Dict, Optional
from datetime import datetime
from enum import Enum
import hashlib
import json
from pydantic import BaseModel, Field, validator


class SensoryType(str, Enum):
    """Extensible sensory signal categories"""
    VISION = "VISION"
    HEARING = "HEARING"
    TOUCH = "TOUCH"
    BALANCE = "BALANCE"
    SMELL = "SMELL"
    TASTE = "TASTE"
    # Extensible: new types can be added without breaking existing SCUs


class SCUMetadata(BaseModel):
    """Metadata for signal traceability and integrity"""
    timestamp: datetime = Field(
        description="When the signal was generated"
    )
    source_id: str = Field(
        min_length=1,
        description="Identifier of the signal generator"
    )
    integrity_hash: str = Field(
        min_length=64,
        max_length=64,
        description="SHA-256 hash to verify signal integrity"
    )

    @validator('integrity_hash')
    def validate_hash_format(cls, v):
        """Ensure integrity_hash is valid hex string"""
        try:
            int(v, 16)
        except ValueError:
            raise ValueError("integrity_hash must be a valid hexadecimal string")
        return v


class SensoryCargonUnit(BaseModel):
    """
    Standardized container for sensory signals.
    
    Each SCU is independent, auditable, and carries its own validation.
    """
    schema_version: str = Field(
        default="1.0.0",
        description="SCU schema version for future compatibility"
    )
    sensory_type: SensoryType = Field(
        description="Category of sensory signal"
    )
    signal_data: Dict[str, Any] = Field(
        description="The actual signal information (flexible format)"
    )
    metadata: SCUMetadata = Field(
        description="Traceability and integrity information"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    def verify_integrity(self) -> bool:
        """
        Verify that the signal hasn't been tampered with.
        
        Returns:
            bool: True if integrity hash matches computed hash
        """
        computed_hash = self._compute_integrity_hash()
        return computed_hash == self.metadata.integrity_hash

    def _compute_integrity_hash(self) -> str:
        """
        Compute SHA-256 hash of signal data for integrity verification.
        
        Returns:
            str: Hexadecimal hash string
        """
        # Create deterministic JSON representation
        signal_json = json.dumps(
            self.signal_data,
            sort_keys=True,
            separators=(',', ':')
        )
        
        # Combine with sensory type and source for uniqueness
        hash_input = f"{self.sensory_type.value}:{self.metadata.source_id}:{signal_json}"
        
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

    @classmethod
    def create(
        cls,
        sensory_type: SensoryType,
        signal_data: Dict[str, Any],
        source_id: str,
        timestamp: Optional[datetime] = None
    ) -> "SensoryCargonUnit":
        """
        Factory method to create a new SCU with automatic integrity hash.
        
        Args:
            sensory_type: Category of sensory signal
            signal_data: The actual signal information
            source_id: Identifier of the signal generator
            timestamp: When signal was generated (defaults to now)
            
        Returns:
            SensoryCargonUnit: Validated SCU with integrity hash
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Create temporary SCU to compute hash
        temp_scu = cls(
            sensory_type=sensory_type,
            signal_data=signal_data,
            metadata=SCUMetadata(
                timestamp=timestamp,
                source_id=source_id,
                integrity_hash="0" * 64  # Placeholder
            )
        )
        
        # Compute actual integrity hash
        integrity_hash = temp_scu._compute_integrity_hash()
        
        # Create final SCU with correct hash
        return cls(
            sensory_type=sensory_type,
            signal_data=signal_data,
            metadata=SCUMetadata(
                timestamp=timestamp,
                source_id=source_id,
                integrity_hash=integrity_hash
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert SCU to dictionary representation"""
        return self.dict()

    def to_json(self) -> str:
        """Convert SCU to JSON string"""
        return self.json()


class SensoryCapsule(BaseModel):
    """
    Container for multiple SCUs grouped together.
    
    Allows external systems to send multiple sensory signals in one payload.
    """
    capsule_id: str = Field(
        description="Unique identifier for this capsule"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the capsule was created"
    )
    source_id: str = Field(
        min_length=1,
        description="Identifier of the system sending this capsule"
    )
    scus: list[SensoryCargonUnit] = Field(
        min_items=1,
        description="List of SCUs contained in this capsule"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def validate_all_scus(self) -> tuple[bool, list[str]]:
        """
        Validate all SCUs in the capsule.
        
        Returns:
            tuple: (all_valid, list_of_errors)
        """
        errors = []
        
        for idx, scu in enumerate(self.scus):
            if not scu.verify_integrity():
                errors.append(f"SCU {idx}: Integrity verification failed")
        
        return len(errors) == 0, errors
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert capsule to dictionary representation"""
        return self.dict()
    
    def to_json(self) -> str:
        """Convert capsule to JSON string"""
        return self.json()


class SCUValidator:
    """Validates incoming SCUs without interpreting signal data"""
    
    @staticmethod
    def validate_structure(scu_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate SCU structure without business logic.
        
        Args:
            scu_data: Dictionary representation of SCU
            
        Returns:
            tuple: (is_valid, error_message)
        """
        try:
            scu = SensoryCargonUnit(**scu_data)
            
            # Verify integrity
            if not scu.verify_integrity():
                return False, "Integrity hash verification failed"
            
            return True, None
            
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def validate_batch(scu_batch: list[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate multiple SCUs and return results.
        
        Args:
            scu_batch: List of SCU dictionaries
            
        Returns:
            dict: Validation results with counts and errors
        """
        results = {
            "total": len(scu_batch),
            "valid": 0,
            "invalid": 0,
            "errors": []
        }
        
        for idx, scu_data in enumerate(scu_batch):
            is_valid, error = SCUValidator.validate_structure(scu_data)
            
            if is_valid:
                results["valid"] += 1
            else:
                results["invalid"] += 1
                results["errors"].append({
                    "index": idx,
                    "error": error
                })
        
        return results
