"""
Human veto system for The Senate governance engine.

Provides asynchronous human override capability with absolute authority
over any governance decision without blocking live operations.

Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from senate.models.governance import GovernanceVerdict, VetoResult
from senate.core.audit_logger import AuditLogger
from senate.utils.errors import VetoError, ValidationError
from senate.utils.logging import get_logger


logger = get_logger("veto")


class VetoSystem:
    """
    Human veto system with absolute override authority.
    
    Allows human administrators to asynchronously override any governance
    decision regardless of when it was made, maintaining complete audit
    trail of veto actions.
    """
    
    def __init__(self, audit_logger: AuditLogger):
        """
        Initialize veto system.
        
        Args:
            audit_logger: Audit logger for recording veto actions
        """
        self.audit_logger = audit_logger
        self._veto_history: Dict[str, List[VetoResult]] = {}
        
        logger.info("Veto system initialized")
    
    async def apply_veto(
        self, 
        transaction_id: str,
        veto_reason: str,
        new_decision: str = "DENY",
        veto_authority: str = "HUMAN_ADMIN"
    ) -> VetoResult:
        """
        Apply human veto to governance decision.
        
        Overrides any previous decision with absolute authority,
        regardless of original decision source or timing.
        
        Args:
            transaction_id: Transaction to veto
            veto_reason: Human-readable reason for veto
            new_decision: New decision (APPROVE or DENY)
            veto_authority: Authority applying veto
            
        Returns:
            VetoResult: Result of veto operation
            
        Requirements: 11.1, 11.2, 11.3
        """
        logger.info(f"Applying veto to transaction {transaction_id}: {veto_reason}")
        
        try:
            # Validate veto parameters
            self._validate_veto_request(transaction_id, veto_reason, new_decision)
            
            # Find original decision
            audit_record = await self.audit_logger.query_audit_trail(transaction_id)
            if not audit_record:
                raise VetoError(f"Transaction not found: {transaction_id}", transaction_id)
            
            original_decision = audit_record.final_verdict.final_decision
            original_source = audit_record.final_verdict.decision_source
            
            # Check if already vetoed
            if audit_record.veto_applied:
                logger.warning(f"Transaction {transaction_id} already vetoed, applying new veto")
            
            # Update verdict with veto
            audit_record.final_verdict.final_decision = new_decision
            audit_record.final_verdict.decision_source = "VETO"
            audit_record.final_verdict.timestamp = datetime.utcnow()
            
            # Add veto information to risk summary
            veto_info = f"Human veto by {veto_authority}: {veto_reason}"
            audit_record.final_verdict.risk_summary.insert(0, veto_info)
            
            # Mark as vetoed
            audit_record.apply_veto(new_decision, veto_reason)
            
            # Create veto result
            veto_result = VetoResult(
                transaction_id=transaction_id,
                original_decision=original_decision,
                new_decision=new_decision,
                veto_reason=veto_reason,
                success=True
            )
            
            # Log veto action
            await self.audit_logger.log_veto(
                transaction_id=transaction_id,
                original_decision=original_decision,
                new_decision=new_decision,
                veto_reason=veto_reason
            )
            
            # Track veto in history
            if transaction_id not in self._veto_history:
                self._veto_history[transaction_id] = []
            self._veto_history[transaction_id].append(veto_result)
            
            logger.info(f"Veto applied successfully: {transaction_id} {original_decision} -> {new_decision}")
            return veto_result
            
        except Exception as e:
            logger.error(f"Veto application failed for {transaction_id}: {e}")
            
            # Return failed veto result
            return VetoResult(
                transaction_id=transaction_id,
                original_decision="UNKNOWN",
                new_decision=new_decision,
                veto_reason=veto_reason,
                success=False
            )
    
    async def get_veto_history(self, transaction_id: str) -> List[VetoResult]:
        """
        Get veto history for specific transaction.
        
        Args:
            transaction_id: Transaction to query
            
        Returns:
            List of veto results for transaction
            
        Requirements: 11.4, 11.5
        """
        return self._veto_history.get(transaction_id, [])
    
    async def list_vetoed_transactions(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        List all vetoed transactions in time range.
        
        Args:
            start_date: Start of time range (optional)
            end_date: End of time range (optional)
            
        Returns:
            List of vetoed transaction summaries
        """
        try:
            vetoed_transactions = []
            
            for transaction_id, veto_list in self._veto_history.items():
                for veto in veto_list:
                    # Apply time filter if specified
                    if start_date and veto.veto_timestamp < start_date:
                        continue
                    if end_date and veto.veto_timestamp > end_date:
                        continue
                    
                    vetoed_transactions.append({
                        "transaction_id": transaction_id,
                        "original_decision": veto.original_decision,
                        "new_decision": veto.new_decision,
                        "veto_reason": veto.veto_reason,
                        "veto_timestamp": veto.veto_timestamp.isoformat(),
                        "success": veto.success
                    })
            
            # Sort by veto timestamp
            vetoed_transactions.sort(key=lambda x: x["veto_timestamp"], reverse=True)
            
            return vetoed_transactions
            
        except Exception as e:
            logger.error(f"Failed to list vetoed transactions: {e}")
            return []
    
    async def check_veto_eligibility(self, transaction_id: str) -> Dict[str, Any]:
        """
        Check if transaction is eligible for veto.
        
        Args:
            transaction_id: Transaction to check
            
        Returns:
            Dict containing eligibility information
        """
        try:
            # Find audit record
            audit_record = await self.audit_logger.query_audit_trail(transaction_id)
            
            if not audit_record:
                return {
                    "eligible": False,
                    "reason": "Transaction not found",
                    "transaction_exists": False
                }
            
            # Calculate age
            age = datetime.utcnow() - audit_record.created_at
            
            # Check if already vetoed
            already_vetoed = audit_record.veto_applied
            
            return {
                "eligible": True,  # All transactions are eligible for veto
                "transaction_exists": True,
                "original_decision": audit_record.final_verdict.final_decision,
                "decision_source": audit_record.final_verdict.decision_source,
                "created_at": audit_record.created_at.isoformat(),
                "age_hours": age.total_seconds() / 3600,
                "already_vetoed": already_vetoed,
                "veto_count": len(self._veto_history.get(transaction_id, []))
            }
            
        except Exception as e:
            logger.error(f"Failed to check veto eligibility for {transaction_id}: {e}")
            return {
                "eligible": False,
                "reason": f"Error checking eligibility: {e}",
                "transaction_exists": False
            }
    
    def _validate_veto_request(
        self, 
        transaction_id: str, 
        veto_reason: str, 
        new_decision: str
    ) -> None:
        """
        Validate veto request parameters.
        
        Args:
            transaction_id: Transaction ID to validate
            veto_reason: Veto reason to validate
            new_decision: New decision to validate
            
        Raises:
            ValidationError: If parameters are invalid
        """
        if not transaction_id or not isinstance(transaction_id, str):
            raise ValidationError("transaction_id must be non-empty string")
        
        if not veto_reason or not isinstance(veto_reason, str):
            raise ValidationError("veto_reason must be non-empty string")
        
        if new_decision not in ["APPROVE", "DENY"]:
            raise ValidationError(f"new_decision must be APPROVE or DENY, got: {new_decision}")
        
        if len(veto_reason) > 1000:
            raise ValidationError("veto_reason too long (max 1000 characters)")
    
    async def get_veto_statistics(self) -> Dict[str, Any]:
        """
        Get veto system statistics.
        
        Returns:
            Dict containing veto statistics
        """
        try:
            total_vetos = sum(len(veto_list) for veto_list in self._veto_history.values())
            vetoed_transactions = len(self._veto_history)
            
            # Count by decision change pattern
            patterns = {}
            for veto_list in self._veto_history.values():
                for veto in veto_list:
                    pattern = f"{veto.original_decision} -> {veto.new_decision}"
                    patterns[pattern] = patterns.get(pattern, 0) + 1
            
            # Recent veto activity (last 24 hours)
            recent_cutoff = datetime.utcnow() - timedelta(hours=24)
            recent_vetos = 0
            
            for veto_list in self._veto_history.values():
                for veto in veto_list:
                    if veto.veto_timestamp > recent_cutoff:
                        recent_vetos += 1
            
            return {
                "total_vetos": total_vetos,
                "vetoed_transactions": vetoed_transactions,
                "veto_patterns": patterns,
                "recent_vetos_24h": recent_vetos,
                "system_status": "operational"
            }
            
        except Exception as e:
            logger.error(f"Failed to get veto statistics: {e}")
            return {
                "error": str(e),
                "system_status": "error"
            }


class VetoInterface:
    """
    User interface for veto operations.
    
    Provides high-level interface for human administrators to
    interact with the veto system.
    """
    
    def __init__(self, veto_system: VetoSystem):
        """
        Initialize veto interface.
        
        Args:
            veto_system: Veto system instance
        """
        self.veto_system = veto_system
    
    async def veto_transaction(
        self, 
        transaction_id: str,
        reason: str,
        new_decision: str = "DENY",
        admin_id: str = "ADMIN"
    ) -> Dict[str, Any]:
        """
        High-level veto operation with validation and feedback.
        
        Args:
            transaction_id: Transaction to veto
            reason: Human-readable reason
            new_decision: New decision (default: DENY)
            admin_id: Administrator ID
            
        Returns:
            Dict containing operation result and feedback
        """
        try:
            # Check eligibility first
            eligibility = await self.veto_system.check_veto_eligibility(transaction_id)
            
            if not eligibility["eligible"]:
                return {
                    "success": False,
                    "error": eligibility["reason"],
                    "transaction_id": transaction_id
                }
            
            # Apply veto
            veto_result = await self.veto_system.apply_veto(
                transaction_id=transaction_id,
                veto_reason=reason,
                new_decision=new_decision,
                veto_authority=admin_id
            )
            
            if veto_result.success:
                return {
                    "success": True,
                    "transaction_id": transaction_id,
                    "original_decision": veto_result.original_decision,
                    "new_decision": veto_result.new_decision,
                    "veto_timestamp": veto_result.veto_timestamp.isoformat(),
                    "message": f"Veto applied successfully: {veto_result.original_decision} -> {veto_result.new_decision}"
                }
            else:
                return {
                    "success": False,
                    "error": "Veto application failed",
                    "transaction_id": transaction_id
                }
            
        except Exception as e:
            logger.error(f"Veto interface error for {transaction_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "transaction_id": transaction_id
            }
    
    async def list_recent_decisions(
        self, 
        hours: int = 24,
        include_vetoed: bool = True
    ) -> List[Dict[str, Any]]:
        """
        List recent decisions available for veto.
        
        Args:
            hours: Number of hours to look back
            include_vetoed: Whether to include already vetoed decisions
            
        Returns:
            List of recent decisions
        """
        try:
            # This would typically query the audit system
            # For now, return veto history as example
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)
            
            vetoed_transactions = await self.veto_system.list_vetoed_transactions(
                start_date=start_time,
                end_date=end_time
            )
            
            return vetoed_transactions
            
        except Exception as e:
            logger.error(f"Failed to list recent decisions: {e}")
            return []
    
    async def get_veto_dashboard(self) -> Dict[str, Any]:
        """
        Get veto system dashboard information.
        
        Returns:
            Dict containing dashboard data
        """
        try:
            stats = await self.veto_system.get_veto_statistics()
            recent_vetos = await self.list_recent_decisions(hours=24)
            
            return {
                "statistics": stats,
                "recent_activity": recent_vetos[:10],  # Last 10 vetos
                "system_status": "operational",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get veto dashboard: {e}")
            return {
                "error": str(e),
                "system_status": "error",
                "timestamp": datetime.utcnow().isoformat()
            }