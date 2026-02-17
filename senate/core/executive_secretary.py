"""
Executive Secretary decision synthesis for The Senate governance engine.

Synthesizes clean Senate decisions when there is unanimous agreement and
no protected risk flags. Determines when escalation to Judge is required.

Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
"""

import logging
from typing import List, Dict, Any, Set, Optional
from collections import Counter

from models.governance import SenatorResponse, GovernanceVerdict
from models.config import GovernanceConfig
from core.llm_provider import LLMProvider, LLMProviderFactory
from core.response_normalizer import ResponseValidator
from utils.errors import GovernanceError


logger = logging.getLogger(__name__)


class ExecutiveSecretary:
    """
    Synthesizes Senate decisions and determines escalation requirements.
    
    The Executive Secretary processes Senator responses to determine if
    there is unanimous agreement without protected risk flags, or if
    escalation to the Judge is required.
    """
    
    def __init__(self, config: GovernanceConfig):
        """
        Initialize Executive Secretary.
        
        Args:
            config: Governance configuration
        """
        self.config = config
        self.llm_provider = LLMProviderFactory.create_provider(config.executive_secretary)
        self.protected_risk_flags = set(flag.lower() for flag in config.protected_risk_flags)
    
    async def synthesize_decision(
        self, 
        senator_responses: List[SenatorResponse],
        transaction_id: str,
        prompt_hash: str
    ) -> tuple[GovernanceVerdict, bool]:
        """
        Synthesize final decision from Senator responses.
        
        Determines if the Senate has reached a clean decision or if
        escalation to Judge is required based on vote distribution
        and risk flag analysis.
        
        Args:
            senator_responses: List of all Senator responses
            transaction_id: Unique transaction identifier
            prompt_hash: SHA-256 hash of original prompt
            
        Returns:
            Tuple of (GovernanceVerdict, requires_judge_escalation)
            
        Requirements: 9.1, 9.2, 9.3, 9.5
        """
        logger.info(f"Executive Secretary synthesizing decision for transaction {transaction_id}")
        
        try:
            # Get valid (non-abstention) responses
            valid_responses = ResponseValidator.get_valid_responses(senator_responses)
            abstention_count = ResponseValidator.count_abstentions(senator_responses)
            
            logger.debug(f"Processing {len(valid_responses)} valid responses, {abstention_count} abstentions")
            
            # HARDENING: Check minimum quorum requirement
            if len(valid_responses) < self.config.minimum_quorum:
                logger.warning(f"Insufficient quorum: {len(valid_responses)} valid responses, minimum required: {self.config.minimum_quorum}")
                escalation_reason = f"INSUFFICIENT_QUORUM: Only {len(valid_responses)} valid responses, minimum {self.config.minimum_quorum} required"
                verdict = GovernanceVerdict(
                    final_decision="DENY",  # Safe default for insufficient quorum
                    decision_source="SENATE",
                    risk_summary=[escalation_reason],
                    confidence=0,
                    transaction_id=transaction_id
                )
                return verdict, True  # Escalate to Judge due to insufficient quorum
            
            # Check if escalation to Judge is required (existing logic)
            escalation_required, escalation_reason = self._requires_judge_escalation(valid_responses)
            
            if escalation_required:
                logger.info(f"Escalation to Judge required: {escalation_reason}")
                # Return placeholder verdict and escalation flag
                verdict = GovernanceVerdict(
                    final_decision="DENY",  # Placeholder, will be overridden by Judge
                    decision_source="SENATE",  # Will be updated by Judge
                    risk_summary=[escalation_reason],
                    confidence=0,
                    transaction_id=transaction_id
                )
                return verdict, True  # True indicates Judge escalation needed
            
            # Senate has reached clean decision - synthesize final verdict
            final_decision = self._determine_final_decision(valid_responses)
            risk_summary = self._synthesize_risk_summary(valid_responses)
            confidence = self._calculate_confidence(valid_responses)
            
            # HARDENING: Check minimum confidence threshold for APPROVE decisions
            if final_decision == "APPROVE" and confidence < self.config.min_approve_confidence:
                logger.warning(f"APPROVE decision below confidence threshold: {confidence} < {self.config.min_approve_confidence}")
                escalation_reason = f"LOW_CONFIDENCE_APPROVE: Confidence {confidence} below threshold {self.config.min_approve_confidence}"
                verdict = GovernanceVerdict(
                    final_decision="DENY",  # Safe default for low confidence APPROVE
                    decision_source="SENATE",
                    risk_summary=[escalation_reason] + risk_summary,
                    confidence=confidence,
                    transaction_id=transaction_id
                )
                return verdict, True  # Escalate to Judge due to low confidence
            
            verdict = GovernanceVerdict(
                final_decision=final_decision,
                decision_source="SENATE",
                risk_summary=risk_summary,
                confidence=confidence,
                transaction_id=transaction_id
            )
            
            logger.info(f"Senate decision synthesized: {final_decision} (confidence: {confidence})")
            return verdict, False  # False indicates no Judge escalation needed
            
        except Exception as e:
            logger.error(f"Executive Secretary synthesis failed: {e}")
            raise GovernanceError(
                f"Decision synthesis failed: {e}",
                transaction_id,
                "executive_secretary"
            )
    
    def _requires_judge_escalation(self, responses: List[SenatorResponse]) -> tuple[bool, str]:
        """
        Determine if Judge escalation is required.
        
        Escalation is required when:
        1. Any Senator votes ESCALATE
        2. Protected risk flags are present
        3. Votes are split between APPROVE and DENY
        4. All Senators abstained
        
        Args:
            responses: Valid Senator responses
            
        Returns:
            Tuple of (requires_escalation, reason)
            
        Requirements: 9.4
        """
        if not responses:
            return True, "All Senators abstained"
        
        # Check for explicit ESCALATE votes
        escalate_votes = [r for r in responses if r.vote == "ESCALATE"]
        if escalate_votes:
            senator_ids = [r.senator_id for r in escalate_votes]
            return True, f"ESCALATE vote from Senators: {', '.join(senator_ids)}"
        
        # Check for protected risk flags
        protected_flags = self._find_protected_risk_flags(responses)
        if protected_flags:
            return True, f"Protected risk flags detected: {', '.join(protected_flags)}"
        
        # Check for split votes between APPROVE and DENY
        votes = [r.vote for r in responses if r.vote in ["APPROVE", "DENY"]]
        unique_votes = set(votes)
        
        if len(unique_votes) > 1:
            vote_counts = Counter(votes)
            return True, f"Split vote: {dict(vote_counts)}"
        
        # No escalation required - unanimous decision
        return False, ""
    
    def _find_protected_risk_flags(self, responses: List[SenatorResponse]) -> List[str]:
        """
        Find any protected risk flags in Senator responses.
        
        Args:
            responses: Senator responses to check
            
        Returns:
            List of protected risk flags found
        """
        protected_flags_found = []
        
        for response in responses:
            if response.risk_flags:
                for flag in response.risk_flags:
                    if flag.lower() in self.protected_risk_flags:
                        if flag not in protected_flags_found:
                            protected_flags_found.append(flag)
        
        return protected_flags_found
    
    def _determine_final_decision(self, responses: List[SenatorResponse]) -> str:
        """
        Determine final decision from unanimous Senator responses.
        
        Args:
            responses: Valid Senator responses (should be unanimous)
            
        Returns:
            str: "APPROVE" or "DENY"
        """
        if not responses:
            # Should not happen as escalation check catches this
            return "DENY"
        
        # Get the unanimous vote (already validated by escalation check)
        votes = [r.vote for r in responses if r.vote in ["APPROVE", "DENY"]]
        
        if not votes:
            return "DENY"  # Default to deny if no clear votes
        
        # Return the unanimous decision
        return votes[0]
    
    def _synthesize_risk_summary(self, responses: List[SenatorResponse]) -> List[str]:
        """
        Synthesize risk summary from all Senator risk flags.
        
        Combines and categorizes risk concerns from all Senators
        into a comprehensive risk summary.
        
        Args:
            responses: Senator responses
            
        Returns:
            List of categorized risk concerns
            
        Requirements: 9.2
        """
        all_risk_flags = ResponseValidator.extract_risk_flags(responses)
        
        if not all_risk_flags:
            return []
        
        # Categorize and deduplicate risk flags
        risk_categories = self._categorize_risk_flags(all_risk_flags)
        
        # Create summary statements
        risk_summary = []
        for category, flags in risk_categories.items():
            if flags:
                flag_list = ", ".join(flags)
                risk_summary.append(f"{category}: {flag_list}")
        
        return risk_summary
    
    def _categorize_risk_flags(self, risk_flags: List[str]) -> Dict[str, List[str]]:
        """
        Categorize risk flags by type.
        
        Args:
            risk_flags: List of risk flags to categorize
            
        Returns:
            Dict mapping categories to risk flags
        """
        categories = {
            "Security": [],
            "Privacy": [],
            "Compliance": [],
            "Financial": [],
            "Operational": [],
            "Other": []
        }
        
        # Simple categorization based on keywords
        for flag in risk_flags:
            flag_lower = flag.lower()
            
            if any(keyword in flag_lower for keyword in ['security', 'vulnerability', 'breach', 'attack']):
                categories["Security"].append(flag)
            elif any(keyword in flag_lower for keyword in ['privacy', 'personal', 'data_protection']):
                categories["Privacy"].append(flag)
            elif any(keyword in flag_lower for keyword in ['compliance', 'regulation', 'legal', 'policy']):
                categories["Compliance"].append(flag)
            elif any(keyword in flag_lower for keyword in ['financial', 'fraud', 'money', 'payment']):
                categories["Financial"].append(flag)
            elif any(keyword in flag_lower for keyword in ['operational', 'system', 'performance']):
                categories["Operational"].append(flag)
            else:
                categories["Other"].append(flag)
        
        # Remove empty categories
        return {k: v for k, v in categories.items() if v}
    
    def _calculate_confidence(self, responses: List[SenatorResponse]) -> int:
        """
        Calculate overall confidence based on Senator agreement.
        
        Confidence is based on:
        1. Number of Senators in agreement
        2. Average confidence scores
        3. Presence of risk flags (reduces confidence)
        
        Args:
            responses: Valid Senator responses
            
        Returns:
            int: Confidence score 0-100
            
        Requirements: 9.3
        """
        if not responses:
            return 0
        
        # Get confidence scores from responses
        confidence_scores = [
            r.confidence_score for r in responses 
            if r.confidence_score is not None
        ]
        
        if not confidence_scores:
            # No confidence scores provided, use agreement-based calculation
            return self._calculate_agreement_confidence(responses)
        
        # Calculate base confidence from average scores
        avg_confidence = sum(confidence_scores) / len(confidence_scores)
        
        # Adjust for agreement level
        agreement_factor = len(responses) / len(self.config.senators)
        
        # Adjust for risk flags (reduce confidence if risks present)
        risk_flags = ResponseValidator.extract_risk_flags(responses)
        risk_penalty = min(len(risk_flags) * 5, 20)  # Max 20 point penalty
        
        # Calculate final confidence
        final_confidence = int(avg_confidence * agreement_factor - risk_penalty)
        
        # Ensure confidence is in valid range
        return max(0, min(100, final_confidence))
    
    def _calculate_agreement_confidence(self, responses: List[SenatorResponse]) -> int:
        """
        Calculate confidence based on agreement level when no scores provided.
        
        Args:
            responses: Valid Senator responses
            
        Returns:
            int: Confidence score based on agreement
        """
        total_senators = len(self.config.senators)
        agreeing_senators = len(responses)
        
        # Base confidence on percentage of Senators in agreement
        agreement_percentage = agreeing_senators / total_senators
        
        # Scale to confidence score
        base_confidence = int(agreement_percentage * 100)
        
        # Reduce confidence if there are risk flags
        risk_flags = ResponseValidator.extract_risk_flags(responses)
        risk_penalty = min(len(risk_flags) * 10, 30)
        
        final_confidence = base_confidence - risk_penalty
        return max(0, min(100, final_confidence))
    
    async def get_synthesis_explanation(
        self, 
        responses: List[SenatorResponse],
        verdict: GovernanceVerdict
    ) -> str:
        """
        Generate detailed explanation of synthesis decision.
        
        Uses the Executive Secretary LLM to provide human-readable
        explanation of how the decision was reached.
        
        Args:
            responses: Senator responses that were synthesized
            verdict: Final verdict produced
            
        Returns:
            str: Detailed explanation of synthesis process
        """
        try:
            # Create synthesis prompt
            prompt = self._create_synthesis_prompt(responses, verdict)
            context = {
                'role': 'executive_secretary',
                'transaction_id': verdict.transaction_id
            }
            
            # Generate explanation
            explanation = await self.llm_provider.generate_response_with_retry(prompt, context)
            return explanation
            
        except Exception as e:
            logger.warning(f"Failed to generate synthesis explanation: {e}")
            return f"Decision synthesized from {len(responses)} Senator responses: {verdict.final_decision}"
    
    def _create_synthesis_prompt(
        self, 
        responses: List[SenatorResponse], 
        verdict: GovernanceVerdict
    ) -> str:
        """Create prompt for synthesis explanation."""
        valid_responses = [r for r in responses if not r.is_abstention]
        abstention_count = len(responses) - len(valid_responses)
        
        votes_summary = Counter(r.vote for r in valid_responses)
        risk_flags = ResponseValidator.extract_risk_flags(valid_responses)
        
        return f"""As the Executive Secretary of The Senate, provide a brief explanation of how this governance decision was reached.

Senator Responses Summary:
- Total Senators: {len(responses)}
- Valid Responses: {len(valid_responses)}
- Abstentions: {abstention_count}
- Vote Distribution: {dict(votes_summary)}
- Risk Flags Identified: {risk_flags}

Final Decision: {verdict.final_decision}
Decision Source: {verdict.decision_source}
Confidence: {verdict.confidence}

Provide a concise explanation (2-3 sentences) of why this decision was reached and how the Senate process worked."""