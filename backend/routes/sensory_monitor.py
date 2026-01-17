"""
Sensory Cargo Monitor API

Provides endpoints for viewing incoming sensory signals in real-time.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging

# Import database layer
from sensory_database import SensorySignalStore

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sensory-monitor",
    tags=["sensory-monitor"],
    responses={404: {"description": "Not found"}}
)


def add_signal_to_history(signal_data: Dict[str, Any]):
    """Add a signal to the history (with database persistence)"""
    SensorySignalStore.add_signal(signal_data)


@router.get("/signals")
async def get_signals(limit: int = 50, offset: int = 0):
    """
    Get list of recent signals.
    
    Args:
        limit: Maximum number of signals to return
        offset: Number of signals to skip
        
    Returns:
        dict: List of signals with metadata
    """
    # Get signals from database
    signals = SensorySignalStore.get_signals(limit=limit, offset=offset)
    
    return {
        "signals": signals,
        "total": len(signals),
        "limit": limit,
        "offset": offset,
        "has_more": len(signals) == limit
    }


@router.get("/signals/{signal_id}")
async def get_signal_detail(signal_id: str):
    """
    Get detailed information about a specific signal.
    
    Args:
        signal_id: Unique identifier of the signal
        
    Returns:
        dict: Detailed signal information
    """
    # Get signal from database
    signal = SensorySignalStore.get_signal_by_id(signal_id)
    
    if signal:
        return signal
    
    raise HTTPException(status_code=404, detail="Signal not found")


@router.get("/stats")
async def get_stats():
    """
    Get statistics about signals.
    
    Returns:
        dict: Signal statistics
    """
    # Get stats from database
    stats = SensorySignalStore.get_stats()
    
    # Get recent activity
    recent_signals = SensorySignalStore.get_signals(limit=10, offset=0)
    
    return {
        "total_signals": stats.get("total_signals", 0),
        "by_type": stats.get("by_type", {}),
        "by_status": stats.get("by_status", {}),
        "recent_activity": recent_signals
    }


@router.get("/health")
async def monitor_health():
    """Health check for Sensory Monitor"""
    stats = SensorySignalStore.get_stats()
    
    return {
        "status": "operational",
        "signals_in_history": stats.get("total_signals", 0),
        "storage_type": "database" if SensorySignalStore.get_supabase_client() else "memory",
        "timestamp": datetime.utcnow().isoformat()
    }
