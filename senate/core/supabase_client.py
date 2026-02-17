"""
Supabase client initialization for The Senate governance engine.

Manages Supabase connection with proper configuration and error handling.
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class SupabaseConnection:
    """
    Manages Supabase client connection.
    
    Handles initialization, connection pooling, and error recovery.
    """
    
    _instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """
        Get Supabase client instance (singleton pattern).
        
        Returns:
            Supabase client
            
        Raises:
            ValueError: If Supabase credentials not configured
        """
        if cls._instance is None:
            cls._instance = cls._initialize_client()
        
        return cls._instance
    
    @classmethod
    def _initialize_client(cls) -> Client:
        """
        Initialize Supabase client from environment variables.
        
        Required environment variables:
        - SUPABASE_URL: Supabase project URL
        - SUPABASE_KEY: Supabase service role key (for server-side operations)
        
        Returns:
            Initialized Supabase client
        """
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        if not supabase_url:
            raise ValueError(
                "SUPABASE_URL environment variable not set. "
                "Please set it to your Supabase project URL."
            )
        
        if not supabase_key:
            raise ValueError(
                "SUPABASE_KEY environment variable not set. "
                "Please set it to your Supabase service role key."
            )
        
        try:
            client = create_client(supabase_url, supabase_key)
            logger.info(f"Supabase client initialized: {supabase_url}")
            return client
            
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise
    
    @classmethod
    def reset_connection(cls) -> None:
        """Reset connection (useful for testing or reconnection)."""
        cls._instance = None
        logger.info("Supabase connection reset")


def get_supabase_client() -> Client:
    """
    Get Supabase client instance.
    
    Convenience function for getting the Supabase client.
    
    Returns:
        Supabase client
    """
    return SupabaseConnection.get_client()
