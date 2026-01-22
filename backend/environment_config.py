"""
Environment Configuration Module

Manages sandbox vs production mode behavior according to engineering spec.
This is a real flag, not inferred - must be set explicitly.
"""

import os
from enum import Enum
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class EnvironmentMode(str, Enum):
    """Environment modes - explicit flag, not inferred"""
    SANDBOX = "sandbox"
    PRODUCTION = "production"


class AuthorityPolicy:
    """Authority policy configuration for Sensory Types"""
    
    def __init__(self, sensory_type: str, required: bool = False, authority_token: Optional[str] = None):
        self.sensory_type = sensory_type
        self.required = required
        self.authority_token = authority_token
    
    def is_locked(self, environment_mode: EnvironmentMode) -> bool:
        """
        Determine if Sensory Type should be locked.
        
        Sandbox Mode: Never locked (full observability, zero friction)
        Production Mode: Locked only if authority policy requires it AND no authority token
        """
        if environment_mode == EnvironmentMode.SANDBOX:
            return False
        
        # Production mode: lock only if authority required and no token present
        return self.required and not self.authority_token


class EnvironmentConfig:
    """Central environment configuration"""
    
    def __init__(self):
        self._mode = self._get_environment_mode()
        self._authority_policies = self._load_authority_policies()
        logger.info(f"[ENVIRONMENT] Mode: {self._mode}")
    
    @property
    def mode(self) -> EnvironmentMode:
        """Get current environment mode"""
        return self._mode
    
    @property
    def is_sandbox(self) -> bool:
        """Check if running in sandbox mode"""
        return self._mode == EnvironmentMode.SANDBOX
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self._mode == EnvironmentMode.PRODUCTION
    
    def _get_environment_mode(self) -> EnvironmentMode:
        """Get environment mode from config - explicit flag required"""
        mode_str = os.getenv("ENVIRONMENT_MODE", "sandbox").lower()
        
        try:
            return EnvironmentMode(mode_str)
        except ValueError:
            logger.warning(f"[ENVIRONMENT] Invalid mode '{mode_str}', defaulting to sandbox")
            return EnvironmentMode.SANDBOX
    
    def _load_authority_policies(self) -> Dict[str, AuthorityPolicy]:
        """Load authority policies for Sensory Types"""
        # Default policies - can be extended with database/config file
        return {
            "VISION": AuthorityPolicy("VISION", required=True),
            "HEARING": AuthorityPolicy("HEARING", required=False),
            "TOUCH": AuthorityPolicy("TOUCH", required=True),
            "BALANCE": AuthorityPolicy("BALANCE", required=False),
            "SMELL": AuthorityPolicy("SMELL", required=True),
            "TASTE": AuthorityPolicy("TASTE", required=False),
        }
    
    def get_sensory_type_status(self, sensory_type: str) -> Dict[str, Any]:
        """
        Get status for a Sensory Type based on environment mode and authority policy.
        
        Returns:
            dict: Sensory Type status with availability, authority requirements, and lock status
        """
        policy = self._authority_policies.get(sensory_type)
        
        if not policy:
            # Unknown sensory type - default to available
            return {
                "sensory_type": sensory_type,
                "available": True,
                "authority_required": False,
                "locked": False,
                "environment_mode": self._mode.value
            }
        
        is_locked = policy.is_locked(self._mode)
        
        return {
            "sensory_type": sensory_type,
            "available": not is_locked,
            "authority_required": policy.required,
            "locked": is_locked,
            "environment_mode": self._mode.value,
            "authority_bypassed": self.is_sandbox and policy.required
        }
    
    def get_all_sensory_types(self) -> Dict[str, Dict[str, Any]]:
        """Get status for all 6 Sensory Types"""
        return {
            sensory_type: self.get_sensory_type_status(sensory_type)
            for sensory_type in self._authority_policies.keys()
        }
    
    def should_block_signal(self, sensory_type: str) -> bool:
        """
        Determine if a signal should be blocked based on environment and authority policy.
        
        Sandbox: Never block (zero friction)
        Production: Block only if channel is locked
        """
        if self.is_sandbox:
            return False
        
        status = self.get_sensory_type_status(sensory_type)
        return status["locked"]


# Global environment configuration instance
environment_config = EnvironmentConfig()