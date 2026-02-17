"""
LLM provider interface and implementations for The Senate governance engine.

Defines the abstract interface for LLM providers and includes mock implementations
for testing and development. Supports timeout handling, retry logic, and
provider flexibility.

Requirements: 1.1, 1.2, 1.3, 1.4
"""

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from models.config import LLMConfig
from utils.errors import LLMProviderError, TimeoutError


logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """
    Abstract base class for all LLM providers.
    
    Defines the standard interface that all LLM providers must implement
    to participate in The Senate governance process.
    
    Requirements: 1.1, 1.2
    """
    
    def __init__(self, config: LLMConfig):
        """
        Initialize LLM provider with configuration.
        
        Args:
            config: LLM configuration parameters
        """
        self.config = config
        self.provider_name = config.provider
        self.model_name = config.model_name
    
    @abstractmethod
    async def generate_response(self, prompt: str, context: Dict[str, Any]) -> str:
        """
        Generate response from LLM with timeout handling.
        
        Args:
            prompt: The input prompt for the LLM
            context: Additional context for the request
            
        Returns:
            str: Raw response from the LLM
            
        Raises:
            LLMProviderError: If the provider encounters an error
            TimeoutError: If the request exceeds timeout
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Return provider identifier.
        
        Returns:
            str: Unique identifier for this provider
        """
        pass
    
    async def generate_response_with_retry(self, prompt: str, context: Dict[str, Any]) -> str:
        """
        Generate response with retry logic and timeout enforcement.
        
        Args:
            prompt: The input prompt for the LLM
            context: Additional context for the request
            
        Returns:
            str: Raw response from the LLM
            
        Raises:
            LLMProviderError: If all retries fail
            TimeoutError: If request exceeds timeout
        """
        last_error = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                # Apply timeout to the request
                response = await asyncio.wait_for(
                    self.generate_response(prompt, context),
                    timeout=self.config.timeout_seconds
                )
                
                logger.debug(f"LLM response generated successfully on attempt {attempt + 1}")
                return response
                
            except asyncio.TimeoutError as e:
                error_msg = f"LLM request timed out after {self.config.timeout_seconds}s"
                logger.warning(f"{error_msg} (attempt {attempt + 1})")
                last_error = TimeoutError(error_msg, self.config.timeout_seconds, "llm_generation")
                
            except Exception as e:
                error_msg = f"LLM provider error: {str(e)}"
                logger.warning(f"{error_msg} (attempt {attempt + 1})")
                last_error = LLMProviderError(error_msg, self.provider_name, self.model_name)
            
            # Wait before retry (exponential backoff)
            if attempt < self.config.max_retries:
                wait_time = 2 ** attempt  # 1s, 2s, 4s, etc.
                await asyncio.sleep(wait_time)
        
        # All retries failed
        logger.error(f"All {self.config.max_retries + 1} attempts failed for {self.provider_name}")
        raise last_error


class MockLLMProvider(LLMProvider):
    """
    Mock LLM provider for testing and development.
    
    Provides controllable responses, timeouts, and failures for
    deterministic testing of the governance system.
    
    Requirements: 1.3
    """
    
    def __init__(self, config: LLMConfig, responses: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize mock LLM provider.
        
        Args:
            config: LLM configuration
            responses: Predefined responses for testing
        """
        super().__init__(config)
        self.responses = responses or []
        self.call_count = 0
        self.should_timeout = False
        self.should_fail = False
        self.failure_message = "Mock failure"
        self.response_delay = 0.0
    
    async def generate_response(self, prompt: str, context: Dict[str, Any]) -> str:
        """Generate mock response based on configuration."""
        # Simulate processing delay
        if self.response_delay > 0:
            await asyncio.sleep(self.response_delay)
        
        # Simulate timeout
        if self.should_timeout:
            await asyncio.sleep(self.config.timeout_seconds + 1)
        
        # Simulate failure
        if self.should_fail:
            raise LLMProviderError(self.failure_message, self.provider_name, self.model_name)
        
        # Return predefined response or generate default
        if self.call_count < len(self.responses):
            response_data = self.responses[self.call_count]
        else:
            # Generate default response based on role
            role = context.get('role', 'senator')
            response_data = self._generate_default_response(role, prompt)
        
        self.call_count += 1
        return json.dumps(response_data)
    
    def get_provider_name(self) -> str:
        """Return mock provider name."""
        return f"mock_{self.config.provider}"
    
    def set_timeout_behavior(self, should_timeout: bool):
        """Configure timeout behavior for testing."""
        self.should_timeout = should_timeout
    
    def set_failure_behavior(self, should_fail: bool, message: str = "Mock failure"):
        """Configure failure behavior for testing."""
        self.should_fail = should_fail
        self.failure_message = message
    
    def set_response_delay(self, delay_seconds: float):
        """Configure response delay for testing."""
        self.response_delay = delay_seconds
    
    def reset(self):
        """Reset mock state for new test."""
        self.call_count = 0
        self.should_timeout = False
        self.should_fail = False
        self.response_delay = 0.0
    
    def _generate_default_response(self, role: str, prompt: str) -> Dict[str, Any]:
        """Generate appropriate default response based on role."""
        if role == 'senator':
            return {
                "vote": "APPROVE",
                "confidence_score": 85,
                "risk_flags": [],
                "reasoning": f"Mock Senator response for: {prompt[:50]}..."
            }
        elif role == 'executive_secretary':
            return {
                "final_decision": "APPROVE",
                "decision_source": "SENATE",
                "risk_summary": [],
                "confidence": 85,
                "reasoning": f"Mock Executive Secretary synthesis for: {prompt[:50]}..."
            }
        elif role == 'judge':
            return {
                "final_decision": "DENY",
                "decision_source": "JUDGE", 
                "risk_summary": ["Safety bias applied"],
                "confidence": 75,
                "reasoning": f"Mock Judge arbitration for: {prompt[:50]}..."
            }
        else:
            return {
                "response": f"Mock response from {role} for: {prompt[:50]}..."
            }


class HallucinatingMockProvider(MockLLMProvider):
    """
    Mock provider that generates invalid responses for testing hallucination handling.
    
    Used to test the system's ability to handle malformed LLM outputs
    and convert them to abstentions.
    """
    
    def __init__(self, config: LLMConfig, hallucination_type: str = "invalid_json"):
        """
        Initialize hallucinating mock provider.
        
        Args:
            config: LLM configuration
            hallucination_type: Type of hallucination to simulate
        """
        super().__init__(config)
        self.hallucination_type = hallucination_type
    
    async def generate_response(self, prompt: str, context: Dict[str, Any]) -> str:
        """Generate hallucinated response based on type."""
        if self.hallucination_type == "invalid_json":
            return "This is not valid JSON at all!"
        
        elif self.hallucination_type == "missing_fields":
            return json.dumps({"some_field": "value", "but_missing": "required_fields"})
        
        elif self.hallucination_type == "invalid_vote":
            return json.dumps({
                "vote": "MAYBE_PERHAPS",
                "confidence_score": 85,
                "risk_flags": [],
                "reasoning": "I'm not sure about this decision"
            })
        
        elif self.hallucination_type == "invalid_confidence":
            return json.dumps({
                "vote": "APPROVE",
                "confidence_score": "very_confident",
                "risk_flags": [],
                "reasoning": "High confidence response"
            })
        
        elif self.hallucination_type == "invalid_risk_flags":
            return json.dumps({
                "vote": "DENY",
                "confidence_score": 75,
                "risk_flags": "security_issue",  # Should be array
                "reasoning": "Security concerns identified"
            })
        
        else:
            # Default to invalid JSON
            return "Completely malformed response that cannot be parsed"


class LLMProviderFactory:
    """
    Factory for creating LLM provider instances.
    
    Supports multiple provider types and handles provider registration
    and instantiation based on configuration.
    """
    
    _providers = {
        "mock": MockLLMProvider,
        "hallucinating_mock": HallucinatingMockProvider
    }
    
    @classmethod
    def create_provider(cls, config: LLMConfig, **kwargs) -> LLMProvider:
        """
        Create LLM provider instance based on configuration.
        
        Args:
            config: LLM configuration
            **kwargs: Additional provider-specific arguments
            
        Returns:
            LLMProvider: Configured provider instance
            
        Raises:
            LLMProviderError: If provider type is not supported
        """
        provider_class = cls._providers.get(config.provider)
        if not provider_class:
            raise LLMProviderError(
                f"Unsupported provider type: {config.provider}",
                config.provider,
                config.model_name
            )
        
        return provider_class(config, **kwargs)
    
    @classmethod
    def register_provider(cls, provider_name: str, provider_class: type):
        """
        Register a new provider type.
        
        Args:
            provider_name: Name of the provider
            provider_class: Provider class to register
        """
        cls._providers[provider_name] = provider_class
    
    @classmethod
    def get_supported_providers(cls) -> List[str]:
        """Get list of supported provider names."""
        return list(cls._providers.keys())