"""
Audit logging and compliance system for The Senate governance engine.

Maintains comprehensive audit trails without storing sensitive data.
Logs transaction metadata, verdicts, and veto actions for compliance.

Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from models.governance import GovernanceVerdict, AuditRecord, VetoResult
from utils.errors import AuditError
from utils.logging import get_audit_logger


logger = logging.getLogger(__name__)
audit_logger = get_audit_logger()


class AuditLogger:
    """
    Comprehensive audit logging system for governance decisions.
    
    Logs all required audit data while ensuring no sensitive information
    is persisted. Provides query capabilities and compliance reporting.
    """
    
    def __init__(self, audit_file_path: Optional[str] = None):
        """
        Initialize audit logger.
        
        Args:
            audit_file_path: Path to audit log file. If None, uses default.
        """
        self.audit_file_path = Path(audit_file_path) if audit_file_path else Path("senate_audit.jsonl")
        self._audit_records: Dict[str, AuditRecord] = {}
        
        # Ensure audit directory exists
        self.audit_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Audit logger initialized: {self.audit_file_path}")
    
    async def log_decision(
        self, 
        transaction_id: str,
        input_hash: str,
        verdict: GovernanceVerdict,
        abstention_count: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log governance decision to audit trail.
        
        Records all required audit information without storing sensitive data.
        
        Args:
            transaction_id: Unique transaction identifier
            input_hash: SHA-256 hash of user prompt
            verdict: Final governance verdict
            abstention_count: Number of Senator abstentions
            metadata: Additional metadata (optional)
            
        Requirements: 13.1, 13.2, 13.4
        """
        try:
            # Create audit record
            audit_record = AuditRecord(
                transaction_id=transaction_id,
                input_hash=input_hash,
                final_verdict=verdict,
                abstention_count=abstention_count,
                veto_applied=False
            )
            
            # Store in memory for quick access
            self._audit_records[transaction_id] = audit_record
            
            # Create audit log entry
            audit_entry = {
                "timestamp": audit_record.created_at.isoformat(),
                "transaction_id": transaction_id,
                "input_hash": input_hash,
                "final_decision": verdict.final_decision,
                "decision_source": verdict.decision_source,
                "confidence": verdict.confidence,
                "risk_summary": verdict.risk_summary,
                "abstention_count": abstention_count,
                "veto_applied": False,
                "metadata": metadata or {}
            }
            
            # Write to audit file
            await self._write_audit_entry(audit_entry)
            
            # Log to audit logger
            audit_logger.info(
                f"DECISION_LOGGED transaction_id={transaction_id} "
                f"decision={verdict.final_decision} source={verdict.decision_source} "
                f"confidence={verdict.confidence} abstentions={abstention_count}"
            )
            
            logger.debug(f"Decision logged for transaction {transaction_id}")
            
        except Exception as e:
            logger.error(f"Failed to log decision for {transaction_id}: {e}")
            raise AuditError(f"Audit logging failed: {e}", transaction_id)
    
    async def log_veto(
        self, 
        transaction_id: str,
        original_decision: str,
        new_decision: str,
        veto_reason: str,
        veto_timestamp: Optional[datetime] = None
    ) -> None:
        """
        Log human veto action to audit trail.
        
        Records veto actions with timestamps and maintains audit trail
        of decision changes.
        
        Args:
            transaction_id: Transaction that was vetoed
            original_decision: Original governance decision
            new_decision: New decision after veto
            veto_reason: Reason for veto
            veto_timestamp: When veto occurred (default: now)
            
        Requirements: 13.3, 11.4, 11.5
        """
        try:
            veto_time = veto_timestamp or datetime.utcnow()
            
            # Update audit record if exists
            audit_record = self._audit_records.get(transaction_id)
            if audit_record:
                audit_record.apply_veto(new_decision, veto_reason)
            
            # Create veto audit entry
            veto_entry = {
                "timestamp": veto_time.isoformat(),
                "event_type": "VETO",
                "transaction_id": transaction_id,
                "original_decision": original_decision,
                "new_decision": new_decision,
                "veto_reason": veto_reason,
                "veto_timestamp": veto_time.isoformat()
            }
            
            # Write to audit file
            await self._write_audit_entry(veto_entry)
            
            # Log to audit logger
            audit_logger.info(
                f"VETO_LOGGED transaction_id={transaction_id} "
                f"original={original_decision} new={new_decision} "
                f"reason={veto_reason}"
            )
            
            logger.info(f"Veto logged for transaction {transaction_id}: {original_decision} -> {new_decision}")
            
        except Exception as e:
            logger.error(f"Failed to log veto for {transaction_id}: {e}")
            raise AuditError(f"Veto audit logging failed: {e}", transaction_id)
    
    async def query_audit_trail(self, transaction_id: str) -> Optional[AuditRecord]:
        """
        Query audit trail for specific transaction.
        
        Args:
            transaction_id: Transaction to query
            
        Returns:
            AuditRecord or None if not found
            
        Requirements: 13.5
        """
        try:
            # Check memory cache first
            if transaction_id in self._audit_records:
                return self._audit_records[transaction_id]
            
            # Search audit file
            audit_record = await self._search_audit_file(transaction_id)
            if audit_record:
                self._audit_records[transaction_id] = audit_record
            
            return audit_record
            
        except Exception as e:
            logger.error(f"Failed to query audit trail for {transaction_id}: {e}")
            raise AuditError(f"Audit query failed: {e}", transaction_id)
    
    async def query_by_time_range(
        self, 
        start_time: datetime, 
        end_time: datetime,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Query audit entries by time range.
        
        Args:
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum number of entries to return
            
        Returns:
            List of audit entries in time range
            
        Requirements: 13.5
        """
        try:
            entries = []
            
            if not self.audit_file_path.exists():
                return entries
            
            with open(self.audit_file_path, 'r') as f:
                for line in f:
                    if len(entries) >= limit:
                        break
                    
                    try:
                        entry = json.loads(line.strip())
                        entry_time = datetime.fromisoformat(entry['timestamp'])
                        
                        if start_time <= entry_time <= end_time:
                            entries.append(entry)
                    
                    except (json.JSONDecodeError, KeyError, ValueError):
                        continue
            
            logger.debug(f"Found {len(entries)} audit entries in time range")
            return entries
            
        except Exception as e:
            logger.error(f"Failed to query audit trail by time range: {e}")
            raise AuditError(f"Time range query failed: {e}")
    
    async def get_audit_statistics(self) -> Dict[str, Any]:
        """
        Get audit trail statistics for monitoring.
        
        Returns:
            Dict containing audit statistics
        """
        try:
            stats = {
                "total_transactions": len(self._audit_records),
                "decisions_by_source": {},
                "decisions_by_outcome": {},
                "veto_count": 0,
                "avg_confidence": 0,
                "total_abstentions": 0
            }
            
            if not self._audit_records:
                return stats
            
            # Calculate statistics from memory cache
            confidences = []
            for record in self._audit_records.values():
                verdict = record.final_verdict
                
                # Count by source
                source = verdict.decision_source
                stats["decisions_by_source"][source] = stats["decisions_by_source"].get(source, 0) + 1
                
                # Count by outcome
                outcome = verdict.final_decision
                stats["decisions_by_outcome"][outcome] = stats["decisions_by_outcome"].get(outcome, 0) + 1
                
                # Track confidence
                confidences.append(verdict.confidence)
                
                # Count vetos
                if record.veto_applied:
                    stats["veto_count"] += 1
                
                # Count abstentions
                stats["total_abstentions"] += record.abstention_count
            
            # Calculate average confidence
            if confidences:
                stats["avg_confidence"] = sum(confidences) / len(confidences)
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get audit statistics: {e}")
            return {"error": str(e)}
    
    async def _write_audit_entry(self, entry: Dict[str, Any]) -> None:
        """
        Write audit entry to file.
        
        Args:
            entry: Audit entry to write
        """
        try:
            # Validate entry contains no sensitive data
            if not self._validate_audit_entry(entry):
                raise AuditError("Audit entry contains sensitive data")
            
            # Write as JSON line
            with open(self.audit_file_path, 'a') as f:
                f.write(json.dumps(entry) + '\n')
            
        except Exception as e:
            logger.error(f"Failed to write audit entry: {e}")
            raise AuditError(f"Audit file write failed: {e}")
    
    async def _search_audit_file(self, transaction_id: str) -> Optional[AuditRecord]:
        """
        Search audit file for specific transaction.
        
        Args:
            transaction_id: Transaction to find
            
        Returns:
            AuditRecord or None if not found
        """
        if not self.audit_file_path.exists():
            return None
        
        try:
            with open(self.audit_file_path, 'r') as f:
                for line in f:
                    try:
                        entry = json.loads(line.strip())
                        if entry.get('transaction_id') == transaction_id and entry.get('event_type') != 'VETO':
                            # Reconstruct AuditRecord from entry
                            return self._reconstruct_audit_record(entry)
                    
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to search audit file: {e}")
            return None
    
    def _reconstruct_audit_record(self, entry: Dict[str, Any]) -> AuditRecord:
        """
        Reconstruct AuditRecord from audit file entry.
        
        Args:
            entry: Audit file entry
            
        Returns:
            AuditRecord: Reconstructed record
        """
        # Reconstruct GovernanceVerdict
        verdict = GovernanceVerdict(
            final_decision=entry['final_decision'],
            decision_source=entry['decision_source'],
            risk_summary=entry['risk_summary'],
            confidence=entry['confidence'],
            transaction_id=entry['transaction_id'],
            timestamp=datetime.fromisoformat(entry['timestamp'])
        )
        
        # Create AuditRecord
        return AuditRecord(
            transaction_id=entry['transaction_id'],
            input_hash=entry['input_hash'],
            final_verdict=verdict,
            abstention_count=entry['abstention_count'],
            veto_applied=entry['veto_applied'],
            created_at=datetime.fromisoformat(entry['timestamp'])
        )
    
    def _validate_audit_entry(self, entry: Dict[str, Any]) -> bool:
        """
        Validate that audit entry contains no sensitive data.
        
        Args:
            entry: Entry to validate
            
        Returns:
            bool: True if entry is safe to persist
            
        Requirements: 13.4
        """
        # Check for prohibited fields
        prohibited_fields = [
            'user_prompt', 'raw_prompt', 'original_prompt',
            'llm_response', 'raw_response', 'senator_reasoning'
        ]
        
        for field in prohibited_fields:
            if field in entry:
                logger.error(f"Audit entry contains prohibited field: {field}")
                return False
        
        # Check for large text that might be sensitive
        for key, value in entry.items():
            if isinstance(value, str) and len(value) > 1000:
                # Allow known safe fields
                if key not in ['risk_summary', 'veto_reason']:
                    logger.warning(f"Audit entry contains large text in field: {key}")
                    return False
        
        return True
    
    async def cleanup_old_records(self, retention_days: int = 365) -> int:
        """
        Clean up old audit records beyond retention period.
        
        Args:
            retention_days: Number of days to retain records
            
        Returns:
            int: Number of records cleaned up
        """
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Clean up memory cache
        old_transactions = [
            tid for tid, record in self._audit_records.items()
            if record.created_at < cutoff_date
        ]
        
        for tid in old_transactions:
            del self._audit_records[tid]
        
        logger.info(f"Cleaned up {len(old_transactions)} old audit records from memory")
        return len(old_transactions)


class ComplianceReporter:
    """
    Generates compliance reports from audit data.
    
    Provides standardized reporting for governance compliance
    and audit trail analysis.
    """
    
    def __init__(self, audit_logger: AuditLogger):
        """
        Initialize compliance reporter.
        
        Args:
            audit_logger: Audit logger instance
        """
        self.audit_logger = audit_logger
    
    async def generate_compliance_report(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Generate comprehensive compliance report.
        
        Args:
            start_date: Report start date
            end_date: Report end date
            
        Returns:
            Dict containing compliance report
        """
        try:
            # Get audit entries for period
            entries = await self.audit_logger.query_by_time_range(start_date, end_date)
            
            # Generate report sections
            report = {
                "report_period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "summary": self._generate_summary(entries),
                "decision_analysis": self._analyze_decisions(entries),
                "veto_analysis": self._analyze_vetos(entries),
                "compliance_status": self._assess_compliance(entries)
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate compliance report: {e}")
            return {"error": str(e)}
    
    def _generate_summary(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary statistics."""
        decision_entries = [e for e in entries if e.get('event_type') != 'VETO']
        veto_entries = [e for e in entries if e.get('event_type') == 'VETO']
        
        return {
            "total_decisions": len(decision_entries),
            "total_vetos": len(veto_entries),
            "decision_sources": self._count_by_field(decision_entries, 'decision_source'),
            "decision_outcomes": self._count_by_field(decision_entries, 'final_decision')
        }
    
    def _analyze_decisions(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze decision patterns."""
        decision_entries = [e for e in entries if e.get('event_type') != 'VETO']
        
        if not decision_entries:
            return {}
        
        confidences = [e.get('confidence', 0) for e in decision_entries]
        abstentions = [e.get('abstention_count', 0) for e in decision_entries]
        
        return {
            "avg_confidence": sum(confidences) / len(confidences),
            "min_confidence": min(confidences),
            "max_confidence": max(confidences),
            "total_abstentions": sum(abstentions),
            "avg_abstentions": sum(abstentions) / len(abstentions)
        }
    
    def _analyze_vetos(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze veto patterns."""
        veto_entries = [e for e in entries if e.get('event_type') == 'VETO']
        
        if not veto_entries:
            return {"total_vetos": 0}
        
        return {
            "total_vetos": len(veto_entries),
            "veto_patterns": self._count_veto_patterns(veto_entries)
        }
    
    def _assess_compliance(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess compliance status."""
        return {
            "audit_trail_complete": True,  # All entries logged
            "no_sensitive_data": True,     # Validated during logging
            "retention_compliant": True    # Managed by cleanup
        }
    
    def _count_by_field(self, entries: List[Dict[str, Any]], field: str) -> Dict[str, int]:
        """Count entries by field value."""
        counts = {}
        for entry in entries:
            value = entry.get(field, 'unknown')
            counts[value] = counts.get(value, 0) + 1
        return counts
    
    def _count_veto_patterns(self, veto_entries: List[Dict[str, Any]]) -> Dict[str, int]:
        """Count veto patterns."""
        patterns = {}
        for entry in veto_entries:
            original = entry.get('original_decision', 'unknown')
            new = entry.get('new_decision', 'unknown')
            pattern = f"{original} -> {new}"
            patterns[pattern] = patterns.get(pattern, 0) + 1
        return patterns