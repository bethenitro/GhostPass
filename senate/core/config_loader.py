"""
Configuration loader and validation for The Senate governance engine.

Loads configuration from external YAML/JSON files and validates all
configuration parameters on startup with clear error reporting.

Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
"""

import yaml
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Union

from senate.models.config import GovernanceConfig, SenatorConfig, LLMConfig
from senate.utils.errors import ConfigurationError


logger = logging.getLogger(__name__)


class ConfigurationLoader:
    """
    Loads and validates governance configuration from external files.
    
    Supports both YAML and JSON configuration formats with comprehensive
    validation and clear error reporting.
    """
    
    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        """
        Initialize configuration loader.
        
        Args:
            config_path: Path to configuration file. If None, uses default locations.
        """
        self.config_path = Path(config_path) if config_path else None
        self._config: Optional[GovernanceConfig] = None
    
    def load_config(self) -> GovernanceConfig:
        """
        Load and validate governance configuration.
        
        Returns:
            GovernanceConfig: Validated configuration object
            
        Raises:
            ConfigurationError: If configuration is invalid or missing
        """
        try:
            # Find configuration file
            config_file = self._find_config_file()
            logger.info(f"Loading configuration from: {config_file}")
            
            # Load raw configuration data
            raw_config = self._load_config_file(config_file)
            
            # Validate and create configuration objects
            config = self._create_governance_config(raw_config)
            
            # Perform additional validation
            self._validate_configuration(config)
            
            self._config = config
            logger.info("Configuration loaded and validated successfully")
            return config
            
        except Exception as e:
            error_msg = f"Failed to load configuration: {str(e)}"
            logger.error(error_msg)
            raise ConfigurationError(error_msg) from e
    
    def get_config(self) -> GovernanceConfig:
        """
        Get the loaded configuration.
        
        Returns:
            GovernanceConfig: The loaded configuration
            
        Raises:
            ConfigurationError: If configuration hasn't been loaded
        """
        if self._config is None:
            raise ConfigurationError("Configuration not loaded. Call load_config() first.")
        return self._config
    
    def _find_config_file(self) -> Path:
        """Find the configuration file to load."""
        if self.config_path and self.config_path.exists():
            return self.config_path
        
        # Default search locations
        search_paths = [
            Path("config.yaml"),
            Path("config.yml"),
            Path("config.json"),
            Path("senate/config.yaml"),
            Path("senate/config.yml"),
            Path("senate/config.json"),
            Path.home() / ".senate" / "config.yaml",
            Path("/etc/senate/config.yaml")
        ]
        
        for path in search_paths:
            if path.exists():
                return path
        
        raise ConfigurationError(
            f"Configuration file not found. Searched: {[str(p) for p in search_paths]}"
        )
    
    def _load_config_file(self, config_file: Path) -> Dict[str, Any]:
        """Load configuration data from file."""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                if config_file.suffix.lower() in ['.yaml', '.yml']:
                    return yaml.safe_load(f)
                elif config_file.suffix.lower() == '.json':
                    return json.load(f)
                else:
                    raise ConfigurationError(f"Unsupported config file format: {config_file.suffix}")
        except yaml.YAMLError as e:
            raise ConfigurationError(f"Invalid YAML in config file: {e}")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in config file: {e}")
        except IOError as e:
            raise ConfigurationError(f"Cannot read config file: {e}")
    
    def _create_governance_config(self, raw_config: Dict[str, Any]) -> GovernanceConfig:
        """Create GovernanceConfig from raw configuration data."""
        try:
            # Parse senators
            senators_data = raw_config.get('senators', [])
            if not senators_data:
                raise ConfigurationError("No senators configured")
            
            senators = []
            for i, senator_data in enumerate(senators_data):
                try:
                    llm_config = self._create_llm_config(senator_data.get('llm', {}))
                    senator = SenatorConfig(
                        role_id=senator_data.get('role_id', f"senator_{i}"),
                        llm_config=llm_config,
                        timeout_seconds=senator_data.get('timeout_seconds', 30),
                        max_retries=senator_data.get('max_retries', 2)
                    )
                    senators.append(senator)
                except Exception as e:
                    raise ConfigurationError(f"Invalid senator configuration at index {i}: {e}")
            
            # Parse executive secretary
            exec_sec_data = raw_config.get('executive_secretary', {})
            if not exec_sec_data:
                raise ConfigurationError("Executive secretary configuration missing")
            executive_secretary = self._create_llm_config(exec_sec_data)
            
            # Parse judge
            judge_data = raw_config.get('judge', {})
            if not judge_data:
                raise ConfigurationError("Judge configuration missing")
            judge = self._create_llm_config(judge_data)
            
            # Create governance config
            config = GovernanceConfig(
                senators=senators,
                executive_secretary=executive_secretary,
                judge=judge,
                protected_risk_flags=raw_config.get('protected_risk_flags', []),
                default_timeout=raw_config.get('default_timeout', 30),
                safety_bias_threshold=raw_config.get('safety_bias_threshold', 0.5),
                max_concurrent_requests=raw_config.get('max_concurrent_requests', 100),
                audit_retention_days=raw_config.get('audit_retention_days', 365),
                # HARDENING PARAMETERS
                minimum_quorum=raw_config.get('minimum_quorum', 2),
                min_approve_confidence=raw_config.get('min_approve_confidence', 60)
            )
            
            return config
            
        except Exception as e:
            if isinstance(e, ConfigurationError):
                raise
            raise ConfigurationError(f"Invalid configuration structure: {e}")
    
    def _create_llm_config(self, llm_data: Dict[str, Any]) -> LLMConfig:
        """Create LLMConfig from raw LLM configuration data."""
        if not llm_data:
            raise ConfigurationError("LLM configuration is empty")
        
        return LLMConfig(
            provider=llm_data.get('provider', ''),
            model_name=llm_data.get('model_name', ''),
            timeout_seconds=llm_data.get('timeout_seconds', 30),
            max_retries=llm_data.get('max_retries', 2),
            api_key=llm_data.get('api_key'),
            base_url=llm_data.get('base_url'),
            additional_params=llm_data.get('additional_params', {})
        )
    
    def _validate_configuration(self, config: GovernanceConfig) -> None:
        """Perform additional configuration validation."""
        # Validate minimum senators
        if len(config.senators) < 3:
            raise ConfigurationError("Minimum 3 senators required for proper governance")
        
        # Validate unique senator IDs
        role_ids = [senator.role_id for senator in config.senators]
        if len(role_ids) != len(set(role_ids)):
            duplicates = [rid for rid in role_ids if role_ids.count(rid) > 1]
            raise ConfigurationError(f"Duplicate senator role IDs found: {duplicates}")
        
        # Validate LLM configurations
        for senator in config.senators:
            self._validate_llm_config(senator.llm_config, f"Senator {senator.role_id}")
        
        self._validate_llm_config(config.executive_secretary, "Executive Secretary")
        self._validate_llm_config(config.judge, "Judge")
        
        # Validate protected risk flags
        if not isinstance(config.protected_risk_flags, list):
            raise ConfigurationError("protected_risk_flags must be a list")
        
        # Validate numeric parameters
        if config.default_timeout <= 0:
            raise ConfigurationError("default_timeout must be positive")
        
        if not 0.0 <= config.safety_bias_threshold <= 1.0:
            raise ConfigurationError("safety_bias_threshold must be between 0.0 and 1.0")
        
        logger.info(f"Configuration validated: {len(config.senators)} senators, "
                   f"{len(config.protected_risk_flags)} protected risk flags")
    
    def _validate_llm_config(self, llm_config: LLMConfig, context: str) -> None:
        """Validate individual LLM configuration."""
        if not llm_config.provider:
            raise ConfigurationError(f"{context}: provider cannot be empty")
        
        if not llm_config.model_name:
            raise ConfigurationError(f"{context}: model_name cannot be empty")
        
        if llm_config.timeout_seconds <= 0:
            raise ConfigurationError(f"{context}: timeout_seconds must be positive")
        
        if llm_config.max_retries < 0:
            raise ConfigurationError(f"{context}: max_retries cannot be negative")


def load_default_config() -> GovernanceConfig:
    """
    Load configuration using default search paths.
    
    Returns:
        GovernanceConfig: Loaded and validated configuration
    """
    loader = ConfigurationLoader()
    return loader.load_config()


def create_sample_config() -> Dict[str, Any]:
    """
    Create a sample configuration for reference.
    
    Returns:
        Dict: Sample configuration structure
    """
    return {
        "senators": [
            {
                "role_id": "senator_1",
                "llm": {
                    "provider": "openai",
                    "model_name": "gpt-4",
                    "timeout_seconds": 30,
                    "max_retries": 2,
                    "api_key": "${OPENAI_API_KEY}"
                },
                "timeout_seconds": 30,
                "max_retries": 2
            },
            {
                "role_id": "senator_2", 
                "llm": {
                    "provider": "anthropic",
                    "model_name": "claude-3-sonnet",
                    "timeout_seconds": 30,
                    "max_retries": 2,
                    "api_key": "${ANTHROPIC_API_KEY}"
                },
                "timeout_seconds": 30,
                "max_retries": 2
            },
            {
                "role_id": "senator_3",
                "llm": {
                    "provider": "openai",
                    "model_name": "gpt-4",
                    "timeout_seconds": 30,
                    "max_retries": 2,
                    "api_key": "${OPENAI_API_KEY}"
                },
                "timeout_seconds": 30,
                "max_retries": 2
            }
        ],
        "executive_secretary": {
            "provider": "openai",
            "model_name": "gpt-4",
            "timeout_seconds": 45,
            "max_retries": 2,
            "api_key": "${OPENAI_API_KEY}"
        },
        "judge": {
            "provider": "anthropic",
            "model_name": "claude-3-opus",
            "timeout_seconds": 60,
            "max_retries": 3,
            "api_key": "${ANTHROPIC_API_KEY}"
        },
        "protected_risk_flags": [
            "security_vulnerability",
            "data_breach_risk",
            "compliance_violation",
            "financial_fraud",
            "privacy_violation"
        ],
        "default_timeout": 30,
        "safety_bias_threshold": 0.5,
        "max_concurrent_requests": 100,
        "audit_retention_days": 365
    }