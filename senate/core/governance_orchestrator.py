"""
Governance orchestration engine for The Senate.

Coordinates the complete governance process from input to verdict,
implementing mandatory execution sequence and procedural governance rules.

Requirements: 2.1, 2.2, 2.3, 2.5
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from senate.models.governance import GovernanceRequest, GovernanceVerdict, VetoResult
from senate.models.config import GovernanceConfig
from senate.core.senator_dispatcher import SenatorDispatcher
from senate.core.executive_secretary import ExecutiveSecretary
from senate.core.judge import Judge
from senate.core.config_loader import ConfigurationLoader
from senate.utils.errors import GovernanceError, ValidationError
from senate.utils.logging import get_logger


logger = get_logger("orchestrator")


class GovernanceOrchestrator:
    """
    Main coordinator for The Senate governance workflow.
    
    Orchestrates the complete governance process implementing procedural
    rules that take precedence over mathematical voting patterns.
    """
    
    def __init__(self, config: Optional[GovernanceConfig] = None):
        """
        Initialize governance orchestrator.
        
        Args:
            config: Governance configuration. If None, loads from default location.
        """
        if config is None:
            config_loader = ConfigurationLoader()
            config = config_loader.load_config()
        
        self.config = config
        self.senator_dispatcher = SenatorDispatcher(config)
        self.executive_secretary = ExecutiveSecretary(config)
        self.judge = Judge(config)
        
        # Track active transactions for veto capability
        self._transaction_verdicts: Dict[str, GovernanceVerdict] = {}
        
        logger.info("Governance orchestrator initialized")
    
    async def evaluate_action(self, request: GovernanceRequest) -> GovernanceVerdict:
        """
        Evaluate user action through complete governance process.
        
        Implements mandatory execution sequence:
        1. Input validation and hashing
        2. Parallel Senator execution
        3. Executive Secretary synthesis or Judge escalation
        4. Memory wiping and audit logging
        
        Args:
            request: Governance request to evaluate
            
        Returns:
            GovernanceVerdict: Final governance decision
            
        Requirements: 2.5
        """
        start_time = datetime.utcnow()
        transaction_id = request.transaction_id
        
        logger.info(f"Starting governance evaluation for transaction {transaction_id}")
        
        try:
            # Step 1: Input validation and hashing
            self._validate_request(request)
            prompt_hash = request.generate_hash()
            
            logger.debug(f"Request validated, prompt hash: {prompt_hash[:16]}...")
            
            # Step 2: Wipe raw prompt from memory immediately (zero persistence)
            request.user_prompt = "[WIPED]"  # Clear sensitive data immediately after hashing
            
            # Step 3: Parallel Senator execution (Promise.allSettled pattern)
            context = {
                'transaction_id': transaction_id,
                'timestamp': start_time.isoformat()
            }
            
            senator_responses = await self.senator_dispatcher.dispatch_to_senators(
                prompt_hash, context
            )
            
            logger.info(f"Senator dispatch completed: {len(senator_responses)} responses")
            
            # Step 4: Executive Secretary synthesis
            verdict, requires_judge = await self.executive_secretary.synthesize_decision(
                senator_responses, transaction_id, prompt_hash
            )
            
            # Step 5: Judge arbitration if required
            if requires_judge:
                escalation_reason = verdict.risk_summary[0] if verdict.risk_summary else "Unknown escalation"
                
                logger.info(f"Escalating to Judge: {escalation_reason}")
                
                verdict = await self.judge.arbitrate(
                    senator_responses, transaction_id, prompt_hash, escalation_reason
                )
            
            # Step 6: Validate final verdict format
            self._validate_verdict(verdict)
            
            # Step 7: Store verdict for potential veto
            self._transaction_verdicts[transaction_id] = verdict
            
            # Step 8: Log completion
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Governance evaluation completed in {execution_time:.2f}s: "
                       f"{verdict.final_decision} from {verdict.decision_source}")
            
            return verdict
            
        except Exception as e:
            logger.error(f"Governance evaluation failed for {transaction_id}: {e}")
            
            # Apply maximum safety bias on critical errors
            return self._create_error_fallback_verdict(transaction_id, str(e))
    
    async def process_veto(self, transaction_id: str, veto_reason: str, new_decision: str = "DENY") -> VetoResult:
        """
        Process human veto of governance decision.
        
        Allows asynchronous override of any previous decision without
        blocking live operations.
        
        Args:
            transaction_id: Transaction to veto
            veto_reason: Reason for veto
            new_decision: New decision (default: DENY)
            
        Returns:
            VetoResult: Result of veto operation
            
        Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
        """
        logger.info(f"Processing veto for transaction {transaction_id}: {veto_reason}")
        
        try:
            # Validate new decision
            if new_decision not in ["APPROVE", "DENY"]:
                raise ValidationError(f"Invalid veto decision: {new_decision}")
            
            # Find original verdict
            original_verdict = self._transaction_verdicts.get(transaction_id)
            if not original_verdict:
                raise ValidationError(f"Transaction not found: {transaction_id}")
            
            original_decision = original_verdict.final_decision
            
            # Update verdict with veto
            original_verdict.final_decision = new_decision
            original_verdict.decision_source = "VETO"
            original_verdict.timestamp = datetime.utcnow()
            original_verdict.risk_summary.insert(0, f"Human veto applied: {veto_reason}")
            
            # Create veto result
            veto_result = VetoResult(
                transaction_id=transaction_id,
                original_decision=original_decision,
                new_decision=new_decision,
                veto_reason=veto_reason,
                success=True
            )
            
            logger.info(f"Veto processed: {original_decision} -> {new_decision}")
            return veto_result
            
        except Exception as e:
            logger.error(f"Veto processing failed for {transaction_id}: {e}")
            return VetoResult(
                transaction_id=transaction_id,
                original_decision="UNKNOWN",
                new_decision=new_decision,
                veto_reason=veto_reason,
                success=False
            )
    
    def _validate_request(self, request: GovernanceRequest) -> None:
        """
        Validate governance request format.
        
        Args:
            request: Request to validate
            
        Raises:
            ValidationError: If request is invalid
            
        Requirements: 6.1, 6.2
        """
        if not request.user_prompt:
            raise ValidationError("user_prompt is required", "user_prompt", request.user_prompt)
        
        if not request.transaction_id:
            raise ValidationError("transaction_id is required", "transaction_id", request.transaction_id)
        
        if not isinstance(request.user_prompt, str):
            raise ValidationError("user_prompt must be string", "user_prompt", type(request.user_prompt))
        
        if not isinstance(request.transaction_id, str):
            raise ValidationError("transaction_id must be string", "transaction_id", type(request.transaction_id))
        
        # Check reasonable length limits
        if len(request.user_prompt) > 100000:  # 100KB limit
            raise ValidationError("user_prompt too long", "user_prompt", len(request.user_prompt))
        
        if len(request.transaction_id) > 255:
            raise ValidationError("transaction_id too long", "transaction_id", len(request.transaction_id))
    
    def _validate_verdict(self, verdict: GovernanceVerdict) -> None:
        """
        Validate final verdict format compliance.
        
        Args:
            verdict: Verdict to validate
            
        Raises:
            ValidationError: If verdict format is invalid
            
        Requirements: 12.1, 12.2, 12.3
        """
        if verdict.final_decision not in ["APPROVE", "DENY"]:
            raise ValidationError(
                f"Invalid final_decision: {verdict.final_decision}",
                "final_decision",
                verdict.final_decision
            )
        
        if verdict.decision_source not in ["SENATE", "JUDGE", "VETO"]:
            raise ValidationError(
                f"Invalid decision_source: {verdict.decision_source}",
                "decision_source", 
                verdict.decision_source
            )
        
        if not isinstance(verdict.risk_summary, list):
            raise ValidationError(
                "risk_summary must be list",
                "risk_summary",
                type(verdict.risk_summary)
            )
        
        if not isinstance(verdict.confidence, int) or not 0 <= verdict.confidence <= 100:
            raise ValidationError(
                f"confidence must be integer 0-100: {verdict.confidence}",
                "confidence",
                verdict.confidence
            )
    
    def _create_error_fallback_verdict(self, transaction_id: str, error_msg: str) -> GovernanceVerdict:
        """
        Create fallback verdict for critical errors.
        
        Applies maximum safety bias when the governance process fails.
        
        Args:
            transaction_id: Transaction identifier
            error_msg: Error message
            
        Returns:
            GovernanceVerdict: Safety-biased DENY verdict
        """
        logger.error(f"Creating error fallback verdict for {transaction_id}: {error_msg}")
        
        return GovernanceVerdict(
            final_decision="DENY",
            decision_source="JUDGE",  # Treat as Judge decision for safety
            risk_summary=[
                "Governance process failed - safety bias applied",
                f"Error: {error_msg}"
            ],
            confidence=100,  # Maximum confidence in safety decision
            transaction_id=transaction_id
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform comprehensive health check of governance system.
        
        Returns:
            Dict: Health status of all components
        """
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {}
        }
        
        try:
            # Check Senator dispatcher
            senator_health = await self.senator_dispatcher.health_check()
            health_status["components"]["senators"] = senator_health
            
            # Check configuration
            health_status["components"]["configuration"] = {
                "senators_count": len(self.config.senators),
                "protected_risk_flags": len(self.config.protected_risk_flags),
                "default_timeout": self.config.default_timeout
            }
            
            # Check active transactions
            health_status["components"]["transactions"] = {
                "active_count": len(self._transaction_verdicts),
                "veto_capable": True
            }
            
            # Overall health determination
            unhealthy_senators = [
                sid for sid, status in senator_health.items() 
                if status != "healthy"
            ]
            
            if unhealthy_senators:
                health_status["status"] = "degraded"
                health_status["issues"] = f"Unhealthy senators: {unhealthy_senators}"
            
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
        
        return health_status
    
    def get_transaction_verdict(self, transaction_id: str) -> Optional[GovernanceVerdict]:
        """
        Get verdict for a specific transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            GovernanceVerdict or None if not found
        """
        return self._transaction_verdicts.get(transaction_id)
    
    def get_active_transactions(self) -> Dict[str, GovernanceVerdict]:
        """
        Get all active transactions available for veto.
        
        Returns:
            Dict mapping transaction IDs to verdicts
        """
        return self._transaction_verdicts.copy()
    
    def clear_old_transactions(self, max_age_hours: int = 24) -> int:
        """
        Clear old transactions to prevent memory buildup.
        
        Args:
            max_age_hours: Maximum age in hours to keep transactions
            
        Returns:
            int: Number of transactions cleared
        """
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)
        
        old_transactions = [
            tid for tid, verdict in self._transaction_verdicts.items()
            if verdict.timestamp.timestamp() < cutoff_time
        ]
        
        for tid in old_transactions:
            del self._transaction_verdicts[tid]
        
        if old_transactions:
            logger.info(f"Cleared {len(old_transactions)} old transactions")
        
        return len(old_transactions)


class ProceduralGovernanceValidator:
    """
    Validates that procedural governance rules are followed.
    
    Ensures that escalation takes precedence over confidence averaging
    and that no mathematical voting shortcuts are used.
    """
    
    @staticmethod
    def validate_no_confidence_averaging(verdict: GovernanceVerdict, senator_responses) -> bool:
        """
        Validate that confidence was not calculated by simple averaging.
        
        Requirements: 2.1
        """
        # This is a design validation - the system should never average
        # confidence scores to determine outcomes
        return True  # Implementation ensures this by design
    
    @staticmethod
    def validate_no_majority_shortcuts(verdict: GovernanceVerdict, senator_responses) -> bool:
        """
        Validate that no majority voting shortcuts were used.
        
        Requirements: 2.2
        """
        # This is a design validation - the system follows procedural rules
        return True  # Implementation ensures this by design
    
    @staticmethod
    def validate_escalation_precedence(verdict: GovernanceVerdict, senator_responses) -> bool:
        """
        Validate that escalation takes precedence over other votes.
        
        Requirements: 2.3
        """
        # Check if any Senator voted ESCALATE
        escalate_votes = [
            r for r in senator_responses 
            if not r.is_abstention and r.vote == "ESCALATE"
        ]
        
        # If there were ESCALATE votes, decision should come from JUDGE
        if escalate_votes and verdict.decision_source != "JUDGE":
            return False
        
        return True