"""
Sensory System Database Integration

Provides database persistence for the SCU system using Supabase.
Falls back to in-memory storage if database is not configured.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import os

# Configure logging
logger = logging.getLogger(__name__)

# Try to import Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("Supabase client not available. Using in-memory storage.")

# Database client
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """Get or create Supabase client"""
    global _supabase_client
    
    if not SUPABASE_AVAILABLE:
        return None
    
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if url and key:
            try:
                _supabase_client = create_client(url, key)
                logger.info("[DATABASE] Connected to Supabase")
            except Exception as e:
                logger.error(f"[DATABASE] Failed to connect to Supabase: {e}")
                return None
        else:
            logger.warning("[DATABASE] Supabase credentials not configured")
            return None
    
    return _supabase_client


class SensorySignalStore:
    """Store for sensory signals with database persistence"""
    
    # In-memory fallback
    _memory_store: List[Dict[str, Any]] = []
    _max_memory_size = 1000
    
    @staticmethod
    def get_supabase_client():
        """Get Supabase client (for checking connection status)"""
        return get_supabase_client()
    
    @classmethod
    def update_signal(cls, signal_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update a signal with new data (e.g., after Ghost Pass processing).
        
        Args:
            signal_id: Signal ID to update
            updates: Dictionary of fields to update
            
        Returns:
            bool: Success status
        """
        client = get_supabase_client()
        
        if client:
            try:
                # Convert datetime objects to ISO strings for JSON serialization
                updates_copy = cls._prepare_for_database(updates)
                
                # Update in database
                client.table('sensory_signals')\
                    .update(updates_copy)\
                    .eq('signal_id', signal_id)\
                    .execute()
                logger.info(f"[DATABASE] Updated signal {signal_id} in database")
                return True
            except Exception as e:
                logger.error(f"[DATABASE] Failed to update signal: {e}")
        
        # In-memory fallback
        for signal in cls._memory_store:
            if signal.get('signal_id') == signal_id:
                signal.update(updates)
                logger.info(f"[MEMORY] Updated signal {signal_id} in memory")
                return True
        
        logger.warning(f"[MEMORY] Signal {signal_id} not found for update")
        return False
    
    @classmethod
    def add_signal(cls, signal_data: Dict[str, Any]) -> bool:
        """
        Add a signal to storage.
        
        Args:
            signal_data: Signal data dictionary
            
        Returns:
            bool: Success status
        """
        client = get_supabase_client()
        
        if client:
            try:
                # Convert datetime objects to ISO strings for JSON serialization
                signal_data_copy = cls._prepare_for_database(signal_data)
                
                # Store in database
                client.table('sensory_signals').insert(signal_data_copy).execute()
                logger.info(f"[DATABASE] Stored signal {signal_data.get('signal_id')} in database")
                return True
            except Exception as e:
                logger.error(f"[DATABASE] Failed to store signal: {e}")
                # Fall back to memory
        
        # In-memory storage
        cls._memory_store.append(signal_data)
        if len(cls._memory_store) > cls._max_memory_size:
            cls._memory_store.pop(0)
        logger.info(f"[MEMORY] Stored signal {signal_data.get('signal_id')} in memory")
        return True
    
    @staticmethod
    def _prepare_for_database(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare data for database storage by converting datetime objects to ISO strings.
        
        Args:
            data: Dictionary that may contain datetime objects
            
        Returns:
            Dictionary with datetime objects converted to ISO strings
        """
        import copy
        from datetime import datetime
        
        # Deep copy to avoid modifying original
        data_copy = copy.deepcopy(data)
        
        def convert_datetimes(obj):
            """Recursively convert datetime objects to ISO strings"""
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_datetimes(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_datetimes(item) for item in obj]
            else:
                return obj
        
        return convert_datetimes(data_copy)
    
    @classmethod
    def get_signals(cls, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get signals from storage.
        
        Args:
            limit: Maximum number of signals
            offset: Number of signals to skip
            
        Returns:
            List of signals
        """
        client = get_supabase_client()
        
        if client:
            try:
                response = client.table('sensory_signals')\
                    .select('*')\
                    .order('received_at', desc=True)\
                    .range(offset, offset + limit - 1)\
                    .execute()
                return response.data
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch signals: {e}")
        
        # In-memory fallback
        signals = list(reversed(cls._memory_store))
        return signals[offset:offset + limit]
    
    @classmethod
    def get_signal_by_id(cls, signal_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific signal by ID"""
        client = get_supabase_client()
        
        if client:
            try:
                response = client.table('sensory_signals')\
                    .select('*')\
                    .eq('signal_id', signal_id)\
                    .single()\
                    .execute()
                return response.data
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch signal: {e}")
        
        # In-memory fallback
        for signal in cls._memory_store:
            if signal.get('signal_id') == signal_id:
                return signal
        return None
    
    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Get signal statistics"""
        client = get_supabase_client()
        
        if client:
            try:
                # Get total count
                total_response = client.table('sensory_signals').select('*', count='exact').execute()
                total = total_response.count
                
                # Get all signals for stats (could be optimized with aggregation queries)
                signals_response = client.table('sensory_signals').select('sensory_type, status').execute()
                signals = signals_response.data
                
                by_type = {}
                by_status = {}
                
                for signal in signals:
                    signal_type = signal.get('sensory_type', 'UNKNOWN')
                    if signal_type:
                        by_type[signal_type] = by_type.get(signal_type, 0) + 1
                    
                    status = signal.get('status', 'UNKNOWN')
                    by_status[status] = by_status.get(status, 0) + 1
                
                return {
                    'total_signals': total,
                    'by_type': by_type,
                    'by_status': by_status
                }
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch stats: {e}")
        
        # In-memory fallback
        if not cls._memory_store:
            return {'total_signals': 0, 'by_type': {}, 'by_status': {}}
        
        by_type = {}
        by_status = {}
        
        for signal in cls._memory_store:
            signal_type = signal.get('sensory_type', 'UNKNOWN')
            by_type[signal_type] = by_type.get(signal_type, 0) + 1
            
            status = signal.get('status', 'UNKNOWN')
            by_status[status] = by_status.get(status, 0) + 1
        
        return {
            'total_signals': len(cls._memory_store),
            'by_type': by_type,
            'by_status': by_status
        }
    
    @classmethod
    def add_audit_entry(cls, audit_entry: Dict[str, Any]) -> bool:
        """
        Add an immutable audit entry.
        
        Args:
            audit_entry: Audit entry data
            
        Returns:
            bool: Success status
        """
        client = get_supabase_client()
        
        if client:
            try:
                # Convert datetime objects to ISO strings for JSON serialization
                audit_entry_copy = cls._prepare_for_database(audit_entry)
                
                # Store in database (immutable table)
                client.table('signal_audit_log').insert(audit_entry_copy).execute()
                logger.info(f"[DATABASE] Stored audit entry {audit_entry.get('audit_id')} in database")
                return True
            except Exception as e:
                logger.error(f"[DATABASE] Failed to store audit entry: {e}")
        
        # In-memory fallback (for development)
        if not hasattr(cls, '_audit_entries'):
            cls._audit_entries = []
        cls._audit_entries.append(audit_entry)
        logger.info(f"[MEMORY] Stored audit entry {audit_entry.get('audit_id')} in memory")
        return True
    
    @classmethod
    def get_audit_entries(cls, signal_id: str) -> List[Dict[str, Any]]:
        """
        Get audit entries for a specific signal.
        
        Args:
            signal_id: Signal identifier
            
        Returns:
            List of audit entries
        """
        client = get_supabase_client()
        
        if client:
            try:
                response = client.table('signal_audit_log')\
                    .select('*')\
                    .eq('signal_id', signal_id)\
                    .order('created_at', desc=False)\
                    .execute()
                return response.data
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch audit entries: {e}")
        
        # In-memory fallback
        if not hasattr(cls, '_audit_entries'):
            cls._audit_entries = []
        return [entry for entry in cls._audit_entries if entry.get('signal_id') == signal_id]


class SenateEvaluationStore:
    """Store for Senate evaluations with database persistence"""
    
    # In-memory fallback
    _pending_evaluations: List[Dict[str, Any]] = []
    _evaluation_history: List[Dict[str, Any]] = []
    
    @staticmethod
    def get_supabase_client():
        """Get Supabase client (for checking connection status)"""
        return get_supabase_client()
    
    @classmethod
    def add_pending(cls, evaluation_data: Dict[str, Any]) -> bool:
        """Add evaluation to pending queue"""
        client = get_supabase_client()
        
        if client:
            try:
                # Convert datetime objects to ISO strings for JSON serialization
                evaluation_data_copy = SensorySignalStore._prepare_for_database(evaluation_data)
                
                client.table('senate_evaluations').insert(evaluation_data_copy).execute()
                logger.info(f"[DATABASE] Added evaluation {evaluation_data.get('evaluation_id')} to database")
                return True
            except Exception as e:
                logger.error(f"[DATABASE] Failed to add evaluation: {e}")
        
        # In-memory fallback
        cls._pending_evaluations.append(evaluation_data)
        logger.info(f"[MEMORY] Added evaluation {evaluation_data.get('evaluation_id')} to memory")
        return True
    
    @classmethod
    def get_pending(cls, limit: int = 50, priority: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get pending evaluations"""
        client = get_supabase_client()
        
        if client:
            try:
                query = client.table('senate_evaluations')\
                    .select('*')\
                    .eq('status', 'pending')\
                    .order('received_at', desc=False)\
                    .limit(limit)
                
                if priority:
                    query = query.eq('priority', priority)
                
                response = query.execute()
                return response.data
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch pending evaluations: {e}")
        
        # In-memory fallback
        filtered = cls._pending_evaluations
        if priority:
            filtered = [e for e in filtered if e.get('priority') == priority]
        return filtered[:limit]
    
    @classmethod
    def get_evaluation_by_id(cls, evaluation_id: str) -> Optional[Dict[str, Any]]:
        """Get specific evaluation"""
        client = get_supabase_client()
        
        if client:
            try:
                response = client.table('senate_evaluations')\
                    .select('*')\
                    .eq('evaluation_id', evaluation_id)\
                    .execute()
                
                if response.data and len(response.data) > 0:
                    return response.data[0]
                else:
                    return None
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch evaluation: {e}")
        
        # In-memory fallback
        for evaluation in cls._pending_evaluations:
            if evaluation.get('evaluation_id') == evaluation_id:
                return evaluation
        return None
    
    @classmethod
    def remove_pending(cls, evaluation_id: str) -> Optional[Dict[str, Any]]:
        """Remove evaluation from pending queue"""
        client = get_supabase_client()
        
        if client:
            try:
                # Just return the evaluation, don't delete (it will be updated by trigger)
                return cls.get_evaluation_by_id(evaluation_id)
            except Exception as e:
                logger.error(f"[DATABASE] Failed to remove evaluation: {e}")
        
        # In-memory fallback
        for idx, evaluation in enumerate(cls._pending_evaluations):
            if evaluation.get('evaluation_id') == evaluation_id:
                return cls._pending_evaluations.pop(idx)
        return None
    
    @classmethod
    def add_decision(cls, decision_data: Dict[str, Any]) -> bool:
        """Add Senate decision"""
        client = get_supabase_client()
        
        if client:
            try:
                # Convert datetime objects to ISO strings for JSON serialization
                decision_data_copy = SensorySignalStore._prepare_for_database(decision_data)
                
                client.table('senate_decisions').insert(decision_data_copy).execute()
                logger.info(f"[DATABASE] Added decision {decision_data.get('decision_id')} to database")
                return True
            except Exception as e:
                logger.error(f"[DATABASE] Failed to add decision: {e}")
        
        # In-memory fallback
        cls._evaluation_history.append(decision_data)
        logger.info(f"[MEMORY] Added decision {decision_data.get('decision_id')} to memory")
        return True
    
    @classmethod
    def get_decision_history(cls, limit: int = 50, decision_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get decision history"""
        client = get_supabase_client()
        
        if client:
            try:
                query = client.table('senate_decisions')\
                    .select('*')\
                    .order('timestamp', desc=True)\
                    .limit(limit)
                
                if decision_filter:
                    query = query.eq('decision', decision_filter)
                
                response = query.execute()
                return response.data
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch decision history: {e}")
        
        # In-memory fallback
        filtered = cls._evaluation_history
        if decision_filter:
            filtered = [d for d in filtered if d.get('decision') == decision_filter]
        return sorted(filtered, key=lambda x: x.get('timestamp', ''), reverse=True)[:limit]
    
    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Get Senate statistics"""
        client = get_supabase_client()
        
        if client:
            try:
                # Use the view for statistics
                stats_response = client.table('v_senate_statistics').select('*').single().execute()
                decision_stats_response = client.table('v_decision_statistics').select('*').single().execute()
                
                return {
                    'pending_count': stats_response.data.get('pending_count', 0),
                    'by_priority': {
                        'high': stats_response.data.get('high_priority_count', 0),
                        'medium': stats_response.data.get('medium_priority_count', 0),
                        'normal': stats_response.data.get('normal_priority_count', 0)
                    },
                    'by_decision': {
                        'approved': decision_stats_response.data.get('approved_count', 0),
                        'rejected': decision_stats_response.data.get('rejected_count', 0),
                        'escalated': decision_stats_response.data.get('escalated_count', 0),
                        'request_more_data': decision_stats_response.data.get('request_more_data_count', 0)
                    },
                    'total_decisions': decision_stats_response.data.get('total_decisions', 0)
                }
            except Exception as e:
                logger.error(f"[DATABASE] Failed to fetch Senate stats: {e}")
        
        # In-memory fallback
        return {
            'pending_count': len(cls._pending_evaluations),
            'by_priority': {
                'high': len([e for e in cls._pending_evaluations if e.get('priority') == 'high']),
                'medium': len([e for e in cls._pending_evaluations if e.get('priority') == 'medium']),
                'normal': len([e for e in cls._pending_evaluations if e.get('priority') == 'normal'])
            },
            'by_decision': {
                'approved': len([d for d in cls._evaluation_history if d.get('decision') == 'approved']),
                'rejected': len([d for d in cls._evaluation_history if d.get('decision') == 'rejected']),
                'escalated': len([d for d in cls._evaluation_history if d.get('decision') == 'escalated']),
                'request_more_data': len([d for d in cls._evaluation_history if d.get('decision') == 'request_more_data'])
            },
            'total_decisions': len(cls._evaluation_history)
        }
