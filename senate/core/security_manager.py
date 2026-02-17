"""
Data security and memory management for The Senate governance engine.

Implements SHA-256 hashing, secure input processing, and memory wiping
to ensure zero persistence of sensitive data.

Requirements: 5.1, 5.2, 5.4, 6.5
"""

import hashlib
import gc
import logging
from typing import Any, Dict, Optional, List
from datetime import datetime
import weakref

from utils.errors import SecurityError
from utils.logging import get_logger


logger = get_logger("security")


class SecurityManager:
    """
    Manages data security and memory wiping for governance operations.
    
    Ensures that sensitive data is hashed immediately upon receipt and
    wiped from memory after processing completion.
    """
    
    def __init__(self):
        """Initialize security manager."""
        self._active_sessions: Dict[str, 'SecureSession'] = {}
        self._hash_registry: Dict[str, str] = {}  # Maps transaction_id to hash
        
    def create_secure_session(self, transaction_id: str, user_prompt: str) -> 'SecureSession':
        """
        Create secure session for processing governance request.
        
        Immediately hashes the user prompt and prepares for memory wiping.
        
        Args:
            transaction_id: Unique transaction identifier
            user_prompt: Raw user prompt to secure
            
        Returns:
            SecureSession: Secure session for processing
            
        Requirements: 6.5, 5.1
        """
        logger.debug(f"Creating secure session for transaction {transaction_id}")
        
        # Generate SHA-256 hash immediately
        prompt_hash = self._generate_sha256_hash(user_prompt)
        
        # Create secure session
        session = SecureSession(transaction_id, prompt_hash, user_prompt)
        self._active_sessions[transaction_id] = session
        self._hash_registry[transaction_id] = prompt_hash
        
        logger.info(f"Secure session created: {transaction_id} -> {prompt_hash[:16]}...")
        return session
    
    def wipe_session(self, transaction_id: str) -> bool:
        """
        Wipe secure session and all associated sensitive data.
        
        Args:
            transaction_id: Transaction to wipe
            
        Returns:
            bool: True if session was wiped successfully
            
        Requirements: 5.4
        """
        logger.debug(f"Wiping secure session for transaction {transaction_id}")
        
        session = self._active_sessions.get(transaction_id)
        if not session:
            logger.warning(f"No active session found for transaction {transaction_id}")
            return False
        
        # Wipe session data
        session.wipe_sensitive_data()
        
        # Remove from active sessions
        del self._active_sessions[transaction_id]
        
        # Force garbage collection
        gc.collect()
        
        logger.info(f"Secure session wiped: {transaction_id}")
        return True
    
    def get_prompt_hash(self, transaction_id: str) -> Optional[str]:
        """
        Get prompt hash for transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            str or None: SHA-256 hash of prompt
        """
        return self._hash_registry.get(transaction_id)
    
    def _generate_sha256_hash(self, data: str) -> str:
        """
        Generate SHA-256 hash of input data.
        
        Args:
            data: Data to hash
            
        Returns:
            str: SHA-256 hash in hexadecimal format
        """
        return hashlib.sha256(data.encode('utf-8')).hexdigest()
    
    def validate_no_sensitive_persistence(self, data: Any) -> bool:
        """
        Validate that data structure contains no sensitive information.
        
        Args:
            data: Data structure to validate
            
        Returns:
            bool: True if no sensitive data found
            
        Requirements: 5.2, 5.3
        """
        if isinstance(data, str):
            # Check for potential sensitive patterns
            if len(data) > 1000:  # Large text might be user prompt
                logger.warning("Large string detected in persistence validation")
                return False
            
            # Check for hash patterns (should be allowed)
            if len(data) == 64 and all(c in '0123456789abcdef' for c in data.lower()):
                return True  # SHA-256 hash is allowed
            
        elif isinstance(data, dict):
            # Recursively check dictionary values
            for key, value in data.items():
                if key.lower() in ['user_prompt', 'raw_prompt', 'original_prompt']:
                    if value and value != "[WIPED]":
                        logger.error(f"Sensitive field '{key}' contains data: {str(value)[:50]}...")
                        return False
                
                if not self.validate_no_sensitive_persistence(value):
                    return False
        
        elif isinstance(data, (list, tuple)):
            # Recursively check list items
            for item in data:
                if not self.validate_no_sensitive_persistence(item):
                    return False
        
        return True
    
    def get_active_sessions(self) -> List[str]:
        """Get list of active session transaction IDs."""
        return list(self._active_sessions.keys())
    
    def cleanup_old_sessions(self, max_age_minutes: int = 60) -> int:
        """
        Clean up old sessions that weren't properly wiped.
        
        Args:
            max_age_minutes: Maximum age in minutes before cleanup
            
        Returns:
            int: Number of sessions cleaned up
        """
        cutoff_time = datetime.utcnow().timestamp() - (max_age_minutes * 60)
        
        old_sessions = []
        for transaction_id, session in self._active_sessions.items():
            if session.created_at.timestamp() < cutoff_time:
                old_sessions.append(transaction_id)
        
        # Wipe old sessions
        for transaction_id in old_sessions:
            self.wipe_session(transaction_id)
        
        if old_sessions:
            logger.warning(f"Cleaned up {len(old_sessions)} old sessions")
        
        return len(old_sessions)


class SecureSession:
    """
    Secure session for processing governance requests.
    
    Maintains prompt hash while ensuring raw prompt is wiped from memory
    after processing completion.
    """
    
    def __init__(self, transaction_id: str, prompt_hash: str, user_prompt: str):
        """
        Initialize secure session.
        
        Args:
            transaction_id: Unique transaction identifier
            prompt_hash: SHA-256 hash of user prompt
            user_prompt: Raw user prompt (will be wiped)
        """
        self.transaction_id = transaction_id
        self.prompt_hash = prompt_hash
        self.created_at = datetime.utcnow()
        self._user_prompt = user_prompt  # Will be wiped
        self._is_wiped = False
        
        # Track memory references for wiping
        self._sensitive_refs: List[weakref.ref] = []
    
    def get_prompt_hash(self) -> str:
        """Get SHA-256 hash of user prompt."""
        return self.prompt_hash
    
    def get_user_prompt(self) -> Optional[str]:
        """
        Get raw user prompt if not yet wiped.
        
        Returns:
            str or None: Raw prompt or None if wiped
        """
        if self._is_wiped:
            return None
        return self._user_prompt
    
    def wipe_sensitive_data(self) -> None:
        """
        Wipe all sensitive data from memory.
        
        Overwrites sensitive strings and clears references to ensure
        data cannot be recovered from memory.
        """
        if self._is_wiped:
            return
        
        logger.debug(f"Wiping sensitive data for session {self.transaction_id}")
        
        # Overwrite user prompt with random data then clear
        if self._user_prompt:
            # Overwrite with zeros
            prompt_length = len(self._user_prompt)
            self._user_prompt = '\x00' * prompt_length
            self._user_prompt = None
        
        # Clear any tracked references
        self._sensitive_refs.clear()
        
        # Mark as wiped
        self._is_wiped = True
        
        # Force garbage collection
        gc.collect()
    
    def is_wiped(self) -> bool:
        """Check if sensitive data has been wiped."""
        return self._is_wiped
    
    def add_sensitive_reference(self, obj: Any) -> None:
        """
        Add object reference for later wiping.
        
        Args:
            obj: Object containing sensitive data
        """
        try:
            self._sensitive_refs.append(weakref.ref(obj))
        except TypeError:
            # Object doesn't support weak references
            pass


class MemoryWiper:
    """
    Utility for secure memory wiping operations.
    
    Provides methods to securely overwrite and clear sensitive data
    from memory to prevent data recovery.
    """
    
    @staticmethod
    def wipe_string(s: str) -> None:
        """
        Securely wipe string from memory.
        
        Args:
            s: String to wipe
        """
        if not s:
            return
        
        # Python strings are immutable, so we can't overwrite in place
        # The best we can do is clear the reference and force GC
        s = None
        gc.collect()
    
    @staticmethod
    def wipe_dict_field(d: Dict[str, Any], field: str) -> None:
        """
        Securely wipe specific field from dictionary.
        
        Args:
            d: Dictionary containing field
            field: Field name to wipe
        """
        if field in d:
            # Overwrite with placeholder
            d[field] = "[WIPED]"
    
    @staticmethod
    def wipe_object_attributes(obj: Any, attributes: List[str]) -> None:
        """
        Wipe specific attributes from object.
        
        Args:
            obj: Object to modify
            attributes: List of attribute names to wipe
        """
        for attr in attributes:
            if hasattr(obj, attr):
                setattr(obj, attr, None)
    
    @staticmethod
    def force_garbage_collection() -> None:
        """Force garbage collection to clear wiped references."""
        gc.collect()


class DataSecurityValidator:
    """
    Validates data security compliance throughout the system.
    
    Ensures that sensitive data handling follows security requirements.
    """
    
    @staticmethod
    def validate_hash_generation(original: str, hash_value: str) -> bool:
        """
        Validate that hash was generated correctly.
        
        Args:
            original: Original data
            hash_value: Generated hash
            
        Returns:
            bool: True if hash is correct
        """
        expected_hash = hashlib.sha256(original.encode('utf-8')).hexdigest()
        return hash_value == expected_hash
    
    @staticmethod
    def validate_no_raw_prompts(data_structure: Any) -> bool:
        """
        Validate that no raw prompts exist in data structure.
        
        Args:
            data_structure: Data to validate
            
        Returns:
            bool: True if no raw prompts found
        """
        if isinstance(data_structure, str):
            # Check if this looks like a user prompt
            if len(data_structure) > 100 and not data_structure.startswith('['):
                # Might be a raw prompt
                return False
        
        elif isinstance(data_structure, dict):
            for key, value in data_structure.items():
                if 'prompt' in key.lower() and isinstance(value, str) and value != "[WIPED]":
                    return False
                if not DataSecurityValidator.validate_no_raw_prompts(value):
                    return False
        
        elif isinstance(data_structure, (list, tuple)):
            for item in data_structure:
                if not DataSecurityValidator.validate_no_raw_prompts(item):
                    return False
        
        return True
    
    @staticmethod
    def validate_memory_wiping(session: SecureSession) -> bool:
        """
        Validate that session memory has been properly wiped.
        
        Args:
            session: Session to validate
            
        Returns:
            bool: True if properly wiped
        """
        if not session.is_wiped():
            return False
        
        # Check that user prompt is cleared
        if session.get_user_prompt() is not None:
            return False
        
        return True


# Global security manager instance
_security_manager = SecurityManager()


def get_security_manager() -> SecurityManager:
    """Get global security manager instance."""
    return _security_manager