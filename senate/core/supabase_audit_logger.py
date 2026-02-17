"""
Supabase-backed audit logger for The Senate governance engine.

HARDENING REQUIREMENT 1: Deterministic Decision Logging
Implements immutable audit trail with Supabase persistence.

All decisions logged to database with:
- transaction_id
- input_hash (SHA-256 only, NO raw prompts)
- all_senator_votes (raw JSON)
- executive_secretary_decision
- judge_invoked (true/false)
- final_verdict
- confidence_score
- risk_flags
- timestamp

ZERO PERSISTENCE: Raw prompts are NEVER stored, only hashes.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from models.governance import GovernanceVerdict, SenatorResponse
from utils.errors import AuditError
from utils.logging import get_logger

logger = get_logger("supabase_audit")


class SupabaseAuditLogger:
    """
    Supabase-backed audit logger with deterministic decision logging.
    
    Implements HARDENING REQUIREMENT 1: All decisions logged to immutable
    database table with complete audit trail.
    """
    
    def __init__(self, supabase_client):
        """
        Initialize Supabase audit logger.
        
        Args:
            supabase_client: Supabase client instance (required)
        """
        if supabase_client is None:
            raise ValueError("Supabase client is required")
        
        self.supabase = supabase_client
        logger.info("Supabase audit logger initialized")
    
    async def log_decision(
        self,
        transaction_id: str,
        input_hash: str,
        senator_responses: List[SenatorResponse],
        executive_secretary_decision: Optional[str],
        executive_secretary_confidence: Optional[int],
        judge_invoked: bool,
        judge_decision: Optional[str],
        judge_confidence: Optional[int],
        escalation_reason: Optional[str],
        final_verdict: GovernanceVerdict,
        execution_time_ms: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log complete governance decision to Supabase.
        
        CRITICAL: This function ensures NO raw prompts are persisted.
        Only SHA-256 hashes and structured verdicts are stored.
        
        Args:
            transaction_id: Unique transaction identifier
            input_hash: SHA-256 hash of user prompt (NOT the raw prompt)
            senator_responses: All Senator responses including abstentions
            executive_secretary_decision: Executive Secretary decision
            executive_secretary_confidence: Executive Secretary confidence
            judge_invoked: Whether Judge was invoked
            judge_decision: Judge decision if invoked
            judge_confidence: Judge confidence if invoked
            escalation_reason: Reason for Judge escalation
            final_verdict: Final governance verdict
            execution_time_ms: Total execution time in milliseconds
            metadata: Additional metadata (optional)
        """
        try:
            # Validate no raw prompts in data
            self._validate_no_sensitive_data(senator_responses, metadata)
            
            # Prepare senator votes JSON
            all_senator_votes = self._serialize_senator_votes(senator_responses)
            senator_abstentions = sum(1 for r in senator_responses if r.is_abstention)
            
            # Extract risk flags
            risk_flags, protected_risk_flags = self._extract_risk_flags(
                senator_responses, final_verdict
            )
            
            # Prepare decision log entry
            decision_log = {
                "transaction_id": transaction_id,
                "input_hash": input_hash,  # SHA-256 hash only
                "all_senator_votes": all_senator_votes,
                "senator_abstentions": senator_abstentions,
                "executive_secretary_decision": executive_secretary_decision,
                "executive_secretary_confidence": executive_secretary_confidence,
                "judge_invoked": judge_invoked,
                "judge_decision": judge_decision,
                "judge_confidence": judge_confidence,
                "escalation_reason": escalation_reason,
                "final_verdict": final_verdict.final_decision,
                "decision_source": final_verdict.decision_source,
                "confidence_score": final_verdict.confidence,
                "risk_flags": json.dumps(risk_flags),
                "protected_risk_flags": json.dumps(protected_risk_flags),
                "created_at": datetime.utcnow().isoformat(),
                "veto_applied": False,
                "metadata": json.dumps(metadata or {})
            }
            
            # Insert into database
            await self._insert_decision_log(decision_log)
            
            # Log execution metrics
            await self._log_execution_metrics(
                transaction_id,
                execution_time_ms,
                senator_responses,
                judge_invoked,
                escalation_reason
            )
            
            logger.info(
                f"Decision logged to Supabase: {transaction_id} -> {final_verdict.final_decision} "
                f"(source: {final_verdict.decision_source}, judge: {judge_invoked})"
            )
            
        except Exception as e:
            logger.error(f"Failed to log decision to Supabase: {e}")
            raise AuditError(f"Supabase audit logging failed: {e}", transaction_id)
    
    async def log_veto(
        self,
        transaction_id: str,
        original_decision: str,
        new_decision: str,
        veto_reason: str,
        admin_id: str
    ) -> None:
        """
        Log veto action to Supabase.
        
        Args:
            transaction_id: Transaction that was vetoed
            original_decision: Original decision
            new_decision: New decision after veto
            veto_reason: Reason for veto
            admin_id: Administrator who applied veto
        """
        try:
            # Update decision log
            await self._update_decision_log_veto(
                transaction_id,
                new_decision,
                veto_reason
            )
            
            # Insert veto log entry
            veto_log = {
                "transaction_id": transaction_id,
                "original_decision": original_decision,
                "new_decision": new_decision,
                "veto_reason": veto_reason,
                "admin_id": admin_id,
                "veto_timestamp": datetime.utcnow().isoformat()
            }
            
            await self._insert_veto_log(veto_log)
            
            logger.info(f"Veto logged to Supabase: {transaction_id} ({original_decision} -> {new_decision})")
            
        except Exception as e:
            logger.error(f"Failed to log veto to Supabase: {e}")
            raise AuditError(f"Veto logging failed: {e}", transaction_id)
    
    async def query_decision(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Query decision log for specific transaction.
        
        Args:
            transaction_id: Transaction to query
            
        Returns:
            Dict with decision data or None if not found
        """
        try:
            result = self.supabase.table('senate_decision_log')\
                .select('*')\
                .eq('transaction_id', transaction_id)\
                .single()\
                .execute()
            return result.data if result.data else None
                
        except Exception as e:
            logger.error(f"Failed to query decision: {e}")
            return None
    
    async def get_metrics_summary(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Get metrics summary for time period.
        
        Args:
            start_date: Start of period
            end_date: End of period
            
        Returns:
            Dict with metrics summary
        """
        try:
            # Query decision log for time range
            result = self.supabase.table('senate_decision_log')\
                .select('*')\
                .gte('created_at', start_date.isoformat())\
                .lte('created_at', end_date.isoformat())\
                .execute()
            
            decisions = result.data if result.data else []
            
            if not decisions:
                return {}
            
            # Calculate metrics
            total_decisions = len(decisions)
            judge_invocations = sum(1 for d in decisions if d.get('judge_invoked'))
            avg_abstentions = sum(d.get('senator_abstentions', 0) for d in decisions) / total_decisions
            avg_confidence = sum(d.get('confidence_score', 0) for d in decisions) / total_decisions
            approvals = sum(1 for d in decisions if d.get('final_verdict') == 'APPROVE')
            denials = sum(1 for d in decisions if d.get('final_verdict') == 'DENY')
            vetos = sum(1 for d in decisions if d.get('veto_applied'))
            
            return {
                'total_decisions': total_decisions,
                'judge_invocations': judge_invocations,
                'avg_abstentions': avg_abstentions,
                'avg_confidence': avg_confidence,
                'approvals': approvals,
                'denials': denials,
                'vetos': vetos
            }
                
        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return {}
    
    def _validate_no_sensitive_data(
        self,
        senator_responses: List[SenatorResponse],
        metadata: Optional[Dict[str, Any]]
    ) -> None:
        """
        Validate that no sensitive data (raw prompts) is present.
        
        CRITICAL SECURITY CHECK: Ensures zero persistence of raw prompts.
        """
        # Check senator responses don't contain raw prompts
        for response in senator_responses:
            if response.reasoning and len(response.reasoning) > 1000:
                logger.warning(f"Senator {response.senator_id} reasoning is very long, may contain sensitive data")
        
        # Check metadata doesn't contain prohibited fields
        if metadata:
            prohibited_fields = ['user_prompt', 'raw_prompt', 'original_prompt']
            for field in prohibited_fields:
                if field in metadata:
                    raise AuditError(f"Metadata contains prohibited field: {field}")
    
    def _serialize_senator_votes(
        self,
        senator_responses: List[SenatorResponse]
    ) -> str:
        """
        Serialize senator votes to JSON.
        
        Args:
            senator_responses: List of senator responses
            
        Returns:
            JSON string of senator votes
        """
        votes = []
        for response in senator_responses:
            vote_data = {
                "senator_id": response.senator_id,
                "vote": response.vote,
                "confidence_score": response.confidence_score,
                "risk_flags": response.risk_flags,
                "is_abstention": response.is_abstention,
                "abstention_reason": response.abstention_reason
            }
            votes.append(vote_data)
        
        return json.dumps(votes)
    
    def _extract_risk_flags(
        self,
        senator_responses: List[SenatorResponse],
        final_verdict: GovernanceVerdict
    ) -> tuple[List[str], List[str]]:
        """
        Extract all risk flags and identify protected ones.
        
        Returns:
            Tuple of (all_risk_flags, protected_risk_flags)
        """
        all_flags = set()
        for response in senator_responses:
            if not response.is_abstention and response.risk_flags:
                all_flags.update(response.risk_flags)
        
        # Add flags from verdict
        if final_verdict.risk_summary:
            for summary in final_verdict.risk_summary:
                # Extract flag names from summary
                if ':' in summary:
                    flag = summary.split(':')[0].strip().lower().replace(' ', '_')
                    all_flags.add(flag)
        
        # Identify protected flags (would need config)
        protected_flags = [
            f for f in all_flags 
            if any(p in f.lower() for p in ['security', 'breach', 'regulatory', 'compliance', 'systemic'])
        ]
        
        return list(all_flags), protected_flags
    
    async def _insert_decision_log(self, decision_log: Dict[str, Any]) -> None:
        """Insert decision log entry into Supabase."""
        self.supabase.table('senate_decision_log').insert(decision_log).execute()
    
    async def _log_execution_metrics(
        self,
        transaction_id: str,
        execution_time_ms: int,
        senator_responses: List[SenatorResponse],
        judge_invoked: bool,
        escalation_reason: Optional[str]
    ) -> None:
        """Log execution metrics to Supabase."""
        senators_total = len(senator_responses)
        senators_abstained = sum(1 for r in senator_responses if r.is_abstention)
        senators_responded = senators_total - senators_abstained
        
        # Calculate variance
        valid_responses = [r for r in senator_responses if not r.is_abstention]
        vote_variance = self._calculate_vote_variance(valid_responses)
        confidence_variance = self._calculate_confidence_variance(valid_responses)
        
        metrics = {
            "transaction_id": transaction_id,
            "execution_time_ms": execution_time_ms,
            "senators_total": senators_total,
            "senators_responded": senators_responded,
            "senators_abstained": senators_abstained,
            "judge_invoked": judge_invoked,
            "escalation_trigger": escalation_reason,
            "vote_variance": vote_variance,
            "confidence_variance": confidence_variance,
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.supabase.table('senate_execution_metrics').insert(metrics).execute()
    
    async def _update_decision_log_veto(
        self,
        transaction_id: str,
        new_decision: str,
        veto_reason: str
    ) -> None:
        """Update decision log with veto information."""
        self.supabase.table('senate_decision_log')\
            .update({
                'veto_applied': True,
                'veto_timestamp': datetime.utcnow().isoformat(),
                'veto_reason': veto_reason,
                'final_verdict': new_decision
            })\
            .eq('transaction_id', transaction_id)\
            .execute()
    
    async def _insert_veto_log(self, veto_log: Dict[str, Any]) -> None:
        """Insert veto log entry."""
        self.supabase.table('senate_veto_log').insert(veto_log).execute()
    
    def _calculate_vote_variance(self, responses: List[SenatorResponse]) -> float:
        """Calculate variance in senator votes."""
        if not responses:
            return 0.0
        
        votes = [r.vote for r in responses if r.vote]
        if not votes:
            return 0.0
        
        # Calculate percentage of non-majority votes
        from collections import Counter
        vote_counts = Counter(votes)
        if not vote_counts:
            return 0.0
        
        majority_count = vote_counts.most_common(1)[0][1]
        total_votes = len(votes)
        variance = 1.0 - (majority_count / total_votes)
        
        return round(variance, 3)
    
    def _calculate_confidence_variance(self, responses: List[SenatorResponse]) -> float:
        """Calculate variance in confidence scores."""
        confidences = [r.confidence_score for r in responses if r.confidence_score is not None]
        if len(confidences) < 2:
            return 0.0
        
        mean = sum(confidences) / len(confidences)
        variance = sum((c - mean) ** 2 for c in confidences) / len(confidences)
        
        return round(variance, 2)
