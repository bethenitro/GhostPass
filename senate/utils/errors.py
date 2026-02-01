"""
Error handling infrastructure for The Senate governance engine.

Defines custom exception classes and error handling utilities for
comprehensive error management throughout the governance system.
"""

from typing import Optional, Any


class SenateError(Exception):
    """Base exception class for all Senate-related errors."""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        self.message = message
        self.details = details
        super().__init__(self.message)


class ValidationError(SenateError):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None, value: Optional[Any] = None):
        self.field = field
        self.value = value
        super().__init__(message, {"field": field, "value": value})


class ConfigurationError(SenateError):
    """Raised when configuration is invalid or missing."""
    
    def __init__(self, message: str, config_section: Optional[str] = None):
        self.config_section = config_section
        super().__init__(message, {"config_section": config_section})


class LLMProviderError(SenateError):
    """Raised when LLM provider operations fail."""
    
    def __init__(self, message: str, provider: Optional[str] = None, model: Optional[str] = None):
        self.provider = provider
        self.model = model
        super().__init__(message, {"provider": provider, "model": model})


class TimeoutError(SenateError):
    """Raised when operations exceed configured timeouts."""
    
    def __init__(self, message: str, timeout_seconds: Optional[float] = None, operation: Optional[str] = None):
        self.timeout_seconds = timeout_seconds
        self.operation = operation
        super().__init__(message, {"timeout_seconds": timeout_seconds, "operation": operation})


class GovernanceError(SenateError):
    """Raised when governance process encounters errors."""
    
    def __init__(self, message: str, transaction_id: Optional[str] = None, stage: Optional[str] = None):
        self.transaction_id = transaction_id
        self.stage = stage
        super().__init__(message, {"transaction_id": transaction_id, "stage": stage})


class AuditError(SenateError):
    """Raised when audit operations fail."""
    
    def __init__(self, message: str, transaction_id: Optional[str] = None):
        self.transaction_id = transaction_id
        super().__init__(message, {"transaction_id": transaction_id})


class VetoError(SenateError):
    """Raised when veto operations fail."""
    
    def __init__(self, message: str, transaction_id: Optional[str] = None):
        self.transaction_id = transaction_id
        super().__init__(message, {"transaction_id": transaction_id})


class SecurityError(SenateError):
    """Raised when security operations fail."""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        self.operation = operation
        super().__init__(message, {"operation": operation})


def handle_error(error: Exception, context: Optional[str] = None) -> SenateError:
    """
    Convert generic exceptions to appropriate Senate error types.
    
    Args:
        error: The original exception
        context: Additional context about where the error occurred
        
    Returns:
        SenateError: Appropriate Senate error type
    """
    if isinstance(error, SenateError):
        return error
    
    message = str(error)
    if context:
        message = f"{context}: {message}"
    
    # Map common exception types to Senate errors
    if isinstance(error, ValueError):
        return ValidationError(message)
    elif isinstance(error, KeyError):
        return ConfigurationError(message)
    elif isinstance(error, TimeoutError):
        return TimeoutError(message)
    else:
        return SenateError(message)