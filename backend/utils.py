"""
Utility functions for the backend
"""
from datetime import datetime
import logging
import re

logger = logging.getLogger(__name__)

def parse_supabase_timestamp(timestamp_str: str) -> datetime:
    """
    Parse Supabase timestamp, handling microseconds with more than 6 digits
    
    Supabase sometimes returns timestamps with microseconds that have more than 6 digits,
    which Python's datetime.fromisoformat() cannot handle. This function truncates
    microseconds to 6 digits and handles timezone conversion.
    
    Args:
        timestamp_str: Timestamp string from Supabase (e.g., '2026-01-15T18:11:08.34254+00:00')
        
    Returns:
        datetime: Parsed datetime object
        
    Raises:
        Exception: If timestamp cannot be parsed
    """
    try:
        # Remove 'Z' and replace with '+00:00' for timezone
        timestamp_str = timestamp_str.replace('Z', '+00:00')
        
        # Handle microseconds with more than 6 digits
        # Find the microseconds part and truncate to 6 digits
        if '.' in timestamp_str and '+' in timestamp_str:
            date_part, time_tz_part = timestamp_str.split('.')
            microseconds_tz = time_tz_part
            if '+' in microseconds_tz:
                microseconds, tz = microseconds_tz.split('+')
                # Truncate microseconds to 6 digits
                microseconds = microseconds[:6].ljust(6, '0')
                timestamp_str = f"{date_part}.{microseconds}+{tz}"
        
        return datetime.fromisoformat(timestamp_str)
    except Exception as e:
        logger.error(f"Error parsing timestamp '{timestamp_str}': {e}")
        # Fallback: try without microseconds
        try:
            # Remove microseconds entirely
            timestamp_str = re.sub(r'\.\d+', '', timestamp_str.replace('Z', '+00:00'))
            return datetime.fromisoformat(timestamp_str)
        except Exception as e2:
            logger.error(f"Fallback timestamp parsing also failed: {e2}")
            raise e