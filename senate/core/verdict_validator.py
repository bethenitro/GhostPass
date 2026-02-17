"""
Final verdict generation and validation for The Senate governance engine.

Ensures final verdicts contain all required fields and comply with
format specifications for client system integration.

Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from models.governance import GovernanceVerdict, SenatorResponse
from utils.errors import ValidationError
from utils.logging import get_logger


logger = get_logger("verdict")


class VerdictValidator:
    """
    Validates final verdict format compliance and completeness.
    
    Ensures all verdicts meet the required format specifications
    and contain appropriate decision information.
    """
    
    @staticmethod
    def validate_verdict_format(verdict: GovernanceVerdict) -> bool:
        """
        Validate that verdict meets format requirements.
        
        Args:
            verdict: Verdict to validate
            
        Returns:
            bool: True if verdict format is valid
            
        Raises:
            ValidationError: If verdict format is invalid
            
        Requirements: 12.1, 12.2, 12.3
        """
        try:
            # Validate final_decision field
            if not hasattr(verdict, 'final_decision') or verdict.final_decision is None:
                raise ValidationError("final_decision field is required")
            
            if verdict.final_decision not in ["APPROVE", "DENY"]:
                raise ValidationError(
                    f"final_decision must be 'APPROVE' or 'DENY', got: {verdict.final_decision}"
                )
            
            # Validate decision_source field
            if not hasattr(verdict, 'decision_source') or verdict.decision_source is None:
                raise ValidationError("decision_source field is required")
            
            if verdict.decision_source not in ["SENATE", "JUDGE", "VETO"]:
                raise ValidationError(
                    f"decision_source must be 'SENATE', 'JUDGE', or 'VETO', got: {verdict.decision_source}"
                )
            
            # Validate risk_summary field
            if not hasattr(verdict, 'risk_summary'):
                raise ValidationError("risk_summary field is required")
            
            if not isinstance(verdict.risk_summary, list):
                raise ValidationError(
                    f"risk_summary must be a list, got: {type(verdict.risk_summary)}"
                )
            
            # Validate confidence field
            if not hasattr(verdict, 'confidence') or verdict.confidence is None:
                raise ValidationError("confidence field is required")
            
            if not isinstance(verdict.confidence, int):
                raise ValidationError(
                    f"confidence must be an integer, got: {type(verdict.confidence)}"
                )
            
            if not 0 <= verdict.confidence <= 100:
                raise ValidationError(
                    f"confidence must be between 0-100, got: {verdict.confidence}"
                )
            
            # Validate transaction_id field
            if not hasattr(verdict, 'transaction_id') or not verdict.transaction_id:
                raise ValidationError("transaction_id field is required")
            
            if not isinstance(verdict.transaction_id, str):
                raise ValidationError(
                    f"transaction_id must be a string, got: {type(verdict.transaction_id)}"
                )
            
            # Validate timestamp field
            if not hasattr(verdict, 'timestamp') or verdict.timestamp is None:
                raise ValidationError("timestamp field is required")
            
            if not isinstance(verdict.timestamp, datetime):
                raise ValidationError(
                    f"timestamp must be a datetime, got: {type(verdict.timestamp)}"
                )
            
            logger.debug(f"Verdict format validation passed for {verdict.transaction_id}")
            return True
            
        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Verdict validation error: {str(e)}")
    
    @staticmethod
    def validate_risk_summary_content(verdict: GovernanceVerdict) -> bool:
        """
        Validate risk summary content quality.
        
        Args:
            verdict: Verdict to validate
            
        Returns:
            bool: True if risk summary is adequate
            
        Requirements: 12.4
        """
        try:
            risk_summary = verdict.risk_summary
            
            # Check that all risk summary items are strings
            for i, item in enumerate(risk_summary):
                if not isinstance(item, str):
                    raise ValidationError(f"Risk summary item {i} must be string, got: {type(item)}")
                
                if not item.strip():
                    raise ValidationError(f"Risk summary item {i} cannot be empty")
            
            # Check for reasonable length limits
            for i, item in enumerate(risk_summary):
                if len(item) > 500:
                    raise ValidationError(f"Risk summary item {i} too long (max 500 chars)")
            
            logger.debug(f"Risk summary validation passed: {len(risk_summary)} items")
            return True
            
        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Risk summary validation error: {str(e)}")
    
    @staticmethod
    def validate_confidence_calculation(
        verdict: GovernanceVerdict, 
        senator_responses: List[SenatorResponse]
    ) -> bool:
        """
        Validate that confidence calculation is reasonable.
        
        Args:
            verdict: Verdict to validate
            senator_responses: Senator responses used to calculate confidence
            
        Returns:
            bool: True if confidence calculation is reasonable
            
        Requirements: 12.5
        """
        try:
            confidence = verdict.confidence
            
            # Get valid responses
            valid_responses = [r for r in senator_responses if not r.is_abstention]
            
            # If no valid responses, confidence should be low
            if not valid_responses and confidence > 50:
                raise ValidationError(
                    f"Confidence too high ({confidence}) with no valid Senator responses"
                )
            
            # If all Senators abstained, confidence should be very low
            if len(valid_responses) == 0 and confidence > 20:
                raise ValidationError(
                    f"Confidence too high ({confidence}) with all Senator abstentions"
                )
            
            # If there are risk flags, confidence should be adjusted
            if verdict.risk_summary and confidence > 90:
                logger.warning(f"High confidence ({confidence}) despite risk flags present")
            
            # Check for veto decisions (should have specific confidence handling)
            if verdict.decision_source == "VETO":
                # Veto decisions can have any confidence as they override system decisions
                pass
            
            logger.debug(f"Confidence validation passed: {confidence}")
            return True
            
        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Confidence validation error: {str(e)}")


class VerdictGenerator:
    """
    Generates properly formatted verdicts from governance decisions.
    
    Ensures all generated verdicts comply with format requirements
    and contain complete decision information.
    """
    
    @staticmethod
    def create_senate_verdict(
        transaction_id: str,
        final_decision: str,
        risk_summary: List[str],
        confidence: int
    ) -> GovernanceVerdict:
        """
        Create verdict from Senate consensus.
        
        Args:
            transaction_id: Transaction identifier
            final_decision: APPROVE or DENY
            risk_summary: List of risk concerns
            confidence: Confidence score 0-100
            
        Returns:
            GovernanceVerdict: Properly formatted Senate verdict
        """
        verdict = GovernanceVerdict(
            final_decision=final_decision,
            decision_source="SENATE",
            risk_summary=risk_summary,
            confidence=confidence,
            transaction_id=transaction_id
        )
        
        # Validate before returning
        VerdictValidator.validate_verdict_format(verdict)
        
        logger.debug(f"Senate verdict created: {transaction_id} -> {final_decision}")
        return verdict
    
    @staticmethod
    def create_judge_verdict(
        transaction_id: str,
        final_decision: str,
        risk_summary: List[str],
        confidence: int,
        arbitration_reason: str
    ) -> GovernanceVerdict:
        """
        Create verdict from Judge arbitration.
        
        Args:
            transaction_id: Transaction identifier
            final_decision: APPROVE or DENY
            risk_summary: List of risk concerns
            confidence: Confidence score 0-100
            arbitration_reason: Reason for Judge intervention
            
        Returns:
            GovernanceVerdict: Properly formatted Judge verdict
        """
        # Add arbitration context to risk summary
        enhanced_risk_summary = [f"Judge arbitration: {arbitration_reason}"] + risk_summary
        
        verdict = GovernanceVerdict(
            final_decision=final_decision,
            decision_source="JUDGE",
            risk_summary=enhanced_risk_summary,
            confidence=confidence,
            transaction_id=transaction_id
        )
        
        # Validate before returning
        VerdictValidator.validate_verdict_format(verdict)
        
        logger.debug(f"Judge verdict created: {transaction_id} -> {final_decision}")
        return verdict
    
    @staticmethod
    def create_veto_verdict(
        original_verdict: GovernanceVerdict,
        new_decision: str,
        veto_reason: str
    ) -> GovernanceVerdict:
        """
        Create verdict from human veto.
        
        Args:
            original_verdict: Original verdict being vetoed
            new_decision: New decision after veto
            veto_reason: Reason for veto
            
        Returns:
            GovernanceVerdict: Properly formatted veto verdict
        """
        # Create new risk summary with veto information
        veto_risk_summary = [
            f"Human veto applied: {veto_reason}",
            f"Original decision: {original_verdict.final_decision}"
        ] + original_verdict.risk_summary
        
        verdict = GovernanceVerdict(
            final_decision=new_decision,
            decision_source="VETO",
            risk_summary=veto_risk_summary,
            confidence=100,  # Maximum confidence for human decisions
            transaction_id=original_verdict.transaction_id
        )
        
        # Validate before returning
        VerdictValidator.validate_verdict_format(verdict)
        
        logger.info(f"Veto verdict created: {original_verdict.transaction_id} -> {new_decision}")
        return verdict
    
    @staticmethod
    def create_error_verdict(
        transaction_id: str,
        error_message: str
    ) -> GovernanceVerdict:
        """
        Create safety-biased verdict for error conditions.
        
        Args:
            transaction_id: Transaction identifier
            error_message: Error that occurred
            
        Returns:
            GovernanceVerdict: Safety-biased DENY verdict
        """
        verdict = GovernanceVerdict(
            final_decision="DENY",
            decision_source="JUDGE",  # Treat as Judge decision for safety
            risk_summary=[
                "System error - safety bias applied",
                f"Error: {error_message}"
            ],
            confidence=100,  # Maximum confidence in safety decisions
            transaction_id=transaction_id
        )
        
        # Validate before returning
        VerdictValidator.validate_verdict_format(verdict)
        
        logger.warning(f"Error verdict created: {transaction_id} -> DENY (safety bias)")
        return verdict


class VerdictFormatter:
    """
    Formats verdicts for different output formats and client systems.
    
    Provides standardized formatting for API responses, audit logs,
    and client system integration.
    """
    
    @staticmethod
    def format_for_api_response(verdict: GovernanceVerdict) -> Dict[str, Any]:
        """
        Format verdict for API response.
        
        Args:
            verdict: Verdict to format
            
        Returns:
            Dict: API-formatted verdict
        """
        return {
            "final_decision": verdict.final_decision,
            "decision_source": verdict.decision_source,
            "risk_summary": verdict.risk_summary,
            "confidence": verdict.confidence,
            "transaction_id": verdict.transaction_id,
            "timestamp": verdict.timestamp.isoformat()
        }
    
    @staticmethod
    def format_for_audit_log(verdict: GovernanceVerdict, input_hash: str) -> Dict[str, Any]:
        """
        Format verdict for audit logging.
        
        Args:
            verdict: Verdict to format
            input_hash: SHA-256 hash of input
            
        Returns:
            Dict: Audit-formatted verdict
        """
        return {
            "transaction_id": verdict.transaction_id,
            "input_hash": input_hash,
            "final_decision": verdict.final_decision,
            "decision_source": verdict.decision_source,
            "confidence": verdict.confidence,
            "risk_summary": verdict.risk_summary,
            "timestamp": verdict.timestamp.isoformat()
        }
    
    @staticmethod
    def format_summary(verdict: GovernanceVerdict) -> str:
        """
        Format verdict as human-readable summary.
        
        Args:
            verdict: Verdict to format
            
        Returns:
            str: Human-readable summary
        """
        risk_text = f" (Risks: {', '.join(verdict.risk_summary)})" if verdict.risk_summary else ""
        
        return (
            f"Decision: {verdict.final_decision} "
            f"(Source: {verdict.decision_source}, "
            f"Confidence: {verdict.confidence}%)"
            f"{risk_text}"
        )