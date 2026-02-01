"""
Configuration data models for The Senate governance engine.

These models define the structure for system configuration including
LLM provider settings, governance role assignments, and system parameters.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class LLMConfig:
    """
    Configuration for an LLM provider.
    
    Defines the connection and behavior parameters for a specific LLM
    provider instance used in governance roles.
    
    Requirements: 1.1, 1.2, 1.3
    """
    provider: str  # e.g., "openai", "anthropic", "local"
    model_name: str  # e.g., "gpt-4", "claude-3", "llama-2"
    timeout_seconds: int = 30
    max_retries: int = 2
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    additional_params: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate configuration parameters."""
        if not self.provider:
            raise ValueError("provider cannot be empty")
        if not self.model_name:
            raise ValueError("model_name cannot be empty")
        if self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        if self.max_retries < 0:
            raise ValueError("max_retries cannot be negative")


@dataclass
class SenatorConfig:
    """
    Configuration for a Senator governance role.
    
    Defines the LLM assignment and behavior parameters for a specific
    Senator seat in the governance process.
    
    Requirements: 1.4, 15.1, 15.2
    """
    role_id: str  # Unique identifier for this Senator seat
    llm_config: LLMConfig
    timeout_seconds: int = 30
    max_retries: int = 2
    
    def __post_init__(self):
        """Validate Senator configuration."""
        if not self.role_id:
            raise ValueError("role_id cannot be empty")
        if self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        if self.max_retries < 0:
            raise ValueError("max_retries cannot be negative")


@dataclass
class GovernanceConfig:
    """
    Complete configuration for The Senate governance engine.
    
    Contains all configuration parameters including Senator assignments,
    Executive Secretary and Judge LLM configurations, protected risk flags,
    system behavior parameters, and hardening settings.
    
    Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
    """
    senators: List[SenatorConfig]
    executive_secretary: LLMConfig
    judge: LLMConfig
    protected_risk_flags: List[str] = field(default_factory=list)
    default_timeout: int = 30
    safety_bias_threshold: float = 0.5
    max_concurrent_requests: int = 100
    audit_retention_days: int = 365
    
    # HARDENING PARAMETERS
    minimum_quorum: int = 2  # Minimum valid senators required for Senate decision
    min_approve_confidence: int = 60  # Minimum confidence required for APPROVE decisions
    
    def __post_init__(self):
        """Validate complete governance configuration."""
        if not self.senators:
            raise ValueError("At least one Senator must be configured")
        
        if len(self.senators) < 3:
            raise ValueError("Minimum 3 Senators required for proper governance")
            
        # Validate unique Senator role IDs
        role_ids = [senator.role_id for senator in self.senators]
        if len(role_ids) != len(set(role_ids)):
            raise ValueError("Senator role_ids must be unique")
            
        if self.default_timeout <= 0:
            raise ValueError("default_timeout must be positive")
            
        if not 0.0 <= self.safety_bias_threshold <= 1.0:
            raise ValueError("safety_bias_threshold must be between 0.0 and 1.0")
            
        if self.max_concurrent_requests <= 0:
            raise ValueError("max_concurrent_requests must be positive")
            
        if self.audit_retention_days <= 0:
            raise ValueError("audit_retention_days must be positive")
        
        # Validate hardening parameters
        if self.minimum_quorum < 1:
            raise ValueError("minimum_quorum must be at least 1")
        
        if self.minimum_quorum > len(self.senators):
            raise ValueError("minimum_quorum cannot exceed number of senators")
            
        if not 0 <= self.min_approve_confidence <= 100:
            raise ValueError("min_approve_confidence must be between 0 and 100")
    
    def get_senator_by_id(self, role_id: str) -> Optional[SenatorConfig]:
        """Get Senator configuration by role ID."""
        for senator in self.senators:
            if senator.role_id == role_id:
                return senator
        return None
    
    def is_protected_risk_flag(self, risk_flag: str) -> bool:
        """Check if a risk flag is in the protected category."""
        return risk_flag.lower() in [flag.lower() for flag in self.protected_risk_flags]