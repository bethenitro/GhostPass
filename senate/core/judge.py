"""
Judge arbitration system for The Senate governance engine.

Handles contested decisions and protected risk flag escalations with
safety bias preferring DENY over APPROVE when uncertain.

Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
"""

import logging
from typing import List, Dict, Any, Optional
from collections import Counter

from models.governance import SenatorResponse, GovernanceVerdict
from models.config import GovernanceConfig
from core.llm_provider import LLMProvider, LLMProviderFactory
from core.response_normalizer import ResponseValidator
from utils.errors import GovernanceError


logger = logging.getLogger(__name__)


class Judge:
    """
    Arbitrates contested governance decisions with safety bias.
    
    The Judge is invoked when:
    1. Senator votes are split between APPROVE and DENY
    2. Protected risk flags are present regardless of vote consensus
    3. All Senators abstained
    
    Applies safety bias preferring DENY over APPROVE when uncertain.
    """
    
    def __init__(self, config: GovernanceConfig):
        """
        Initialize Judge.
        
        Args:
            config: Governance configuration
        """
        self.config = config
        self.llm_provider = LLMProviderFactory.create_provider(config.judge)
        self.protected_risk_flags = set(flag.lower() for flag in config.protected_risk_flags)
        self.safety_bias_threshold = config.safety_bias_threshold
    
    async def arbitrate(
        self, 
        senator_responses: List[SenatorResponse],
        transaction_id: str,
        prompt_hash: str,
        escalation_reason: str
    ) -> GovernanceVerdict:
        """
        Arbitrate contested governance decision.
        
        Considers all Senator reasoning and risk flags to make final
        decision with safety bias applied when uncertain.
        
        Args:
            senator_responses: All Senator responses including abstentions
            transaction_id: Unique transaction identifier
            prompt_hash: SHA-256 hash of original prompt
            escalation_reason: Reason why Judge arbitration was required
            
        Returns:
            GovernanceVerdict: Final arbitrated decision
            
        Requirements: 10.1, 10.3, 10.4, 10.5
        """
        logger.info(f"Judge arbitrating decision for transaction {transaction_id}: {escalation_reason}")
        
        try:
            # Analyze Senator responses
            analysis = self._analyze_senator_responses(senator_responses)
            
            # Check for protected risk flags (automatic DENY)
            protected_flags = self._find_protected_risk_flags(senator_responses)
            if protected_flags:
                logger.info(f"Protected risk flags detected, applying automatic DENY: {protected_flags}")
                return self._create_protected_risk_verdict(
                    transaction_id, protected_flags, analysis
                )
            
            # Generate Judge reasoning using LLM
            judge_reasoning = await self._generate_judge_reasoning(
                senator_responses, escalation_reason, prompt_hash
            )
            
            # Apply safety bias to determine final decision
            final_decision = self._apply_safety_bias(analysis, judge_reasoning)
            
            # Calculate confidence based on analysis
            confidence = self._calculate_judge_confidence(analysis, final_decision)
            
            # Create comprehensive risk summary
            risk_summary = self._create_comprehensive_risk_summary(senator_responses, analysis)
            
            verdict = GovernanceVerdict(
                final_decision=final_decision,
                decision_source="JUDGE",
                risk_summary=risk_summary,
                confidence=confidence,
                transaction_id=transaction_id
            )
            
            logger.info(f"Judge decision: {final_decision} (confidence: {confidence})")
            return verdict
            
        except Exception as e:
            logger.error(f"Judge arbitration failed: {e}")
            # Apply maximum safety bias on error
            return self._create_error_fallback_verdict(transaction_id, str(e))
    
    def _analyze_senator_responses(self, responses: List[SenatorResponse]) -> Dict[str, Any]:
        """
        Analyze Senator responses for arbitration.
        
        Args:
            responses: All Senator responses
            
        Returns:
            Dict containing analysis results
        """
        valid_responses = ResponseValidator.get_valid_responses(responses)
        abstention_count = ResponseValidator.count_abstentions(responses)
        
        # Vote distribution
        votes = [r.vote for r in valid_responses if r.vote in ["APPROVE", "DENY", "ESCALATE"]]
        vote_counts = Counter(votes)
        
        # Confidence analysis
        confidence_scores = [
            r.confidence_score for r in valid_responses 
            if r.confidence_score is not None
        ]
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        
        # Risk analysis
        all_risk_flags = ResponseValidator.extract_risk_flags(valid_responses)
        risk_flag_count = len(all_risk_flags)
        
        # Reasoning analysis
        reasoning_texts = [
            r.reasoning for r in valid_responses 
            if r.reasoning and not r.is_abstention
        ]
        
        return {
            "total_senators": len(responses),
            "valid_responses": len(valid_responses),
            "abstention_count": abstention_count,
            "vote_counts": dict(vote_counts),
            "avg_confidence": avg_confidence,
            "risk_flag_count": risk_flag_count,
            "all_risk_flags": all_risk_flags,
            "reasoning_texts": reasoning_texts,
            "has_split_vote": len(set(votes)) > 1 if votes else False,
            "has_escalate_votes": "ESCALATE" in votes,
            "approve_count": vote_counts.get("APPROVE", 0),
            "deny_count": vote_counts.get("DENY", 0)
        }
    
    def _find_protected_risk_flags(self, responses: List[SenatorResponse]) -> List[str]:
        """
        Find protected risk flags that trigger automatic DENY.
        
        Args:
            responses: Senator responses to check
            
        Returns:
            List of protected risk flags found
            
        Requirements: 10.2
        """
        protected_flags_found = []
        
        for response in responses:
            if response.risk_flags:
                for flag in response.risk_flags:
                    if flag.lower() in self.protected_risk_flags:
                        if flag not in protected_flags_found:
                            protected_flags_found.append(flag)
        
        return protected_flags_found
    
    async def _generate_judge_reasoning(
        self, 
        responses: List[SenatorResponse], 
        escalation_reason: str,
        prompt_hash: str
    ) -> str:
        """
        Generate Judge reasoning using LLM analysis.
        
        Args:
            responses: Senator responses to analyze
            escalation_reason: Why Judge arbitration was needed
            prompt_hash: Hash of original prompt
            
        Returns:
            str: Judge's reasoning for the decision
        """
        try:
            prompt = self._create_judge_prompt(responses, escalation_reason, prompt_hash)
            context = {
                'role': 'judge',
                'transaction_id': responses[0].senator_id if responses else 'unknown'
            }
            
            reasoning = await self.llm_provider.generate_response_with_retry(prompt, context)
            return reasoning
            
        except Exception as e:
            logger.warning(f"Failed to generate Judge reasoning: {e}")
            return f"Judge arbitration required due to: {escalation_reason}. Applying safety bias."
    
    def _create_judge_prompt(
        self, 
        responses: List[SenatorResponse], 
        escalation_reason: str,
        prompt_hash: str
    ) -> str:
        """Create prompt for Judge reasoning."""
        valid_responses = ResponseValidator.get_valid_responses(responses)
        
        # Summarize Senator positions
        vote_summary = Counter(r.vote for r in valid_responses)
        risk_flags = ResponseValidator.extract_risk_flags(valid_responses)
        
        # Collect reasoning from Senators
        senator_reasoning = []
        for response in valid_responses:
            if response.reasoning:
                senator_reasoning.append(f"Senator {response.senator_id}: {response.reasoning}")
        
        return f"""You are the Judge in The Senate governance system. You have been called to arbitrate a contested decision.

ESCALATION REASON: {escalation_reason}

SENATOR ANALYSIS:
- Vote Distribution: {dict(vote_summary)}
- Risk Flags Identified: {risk_flags}
- Total Senators: {len(responses)}
- Valid Responses: {len(valid_responses)}
- Abstentions: {len(responses) - len(valid_responses)}

SENATOR REASONING:
{chr(10).join(senator_reasoning) if senator_reasoning else "No detailed reasoning provided"}

Input Hash: {prompt_hash}

As Judge, you must make the final decision considering:
1. All Senator reasoning and concerns
2. Identified risk flags and their severity
3. Safety bias - when uncertain, prefer DENY over APPROVE
4. The need to protect against potential harm

Provide your reasoning for the final decision. Consider the weight of evidence from all Senators and apply appropriate caution when risks are present."""
    
    def _apply_safety_bias(self, analysis: Dict[str, Any], judge_reasoning: str) -> str:
        """
        Apply safety bias to determine final decision.
        
        Patent requirement: DENY > APPROVE when uncertain
        Safety bias prefers DENY over APPROVE when:
        1. Evidence is unclear or conflicting
        2. Risk flags are present
        3. Confidence is low
        4. Judge reasoning indicates uncertainty
        
        Args:
            analysis: Analysis of Senator responses
            judge_reasoning: Judge's reasoning text
            
        Returns:
            str: "APPROVE" or "DENY"
            
        Requirements: 10.3
        """
        # Automatic DENY conditions (patent compliance)
        if analysis["risk_flag_count"] > 0:
            logger.debug("Applying safety bias: Risk flags present")
            return "DENY"
        
        if analysis["avg_confidence"] < (self.safety_bias_threshold * 100):
            logger.debug(f"Applying safety bias: Low confidence ({analysis['avg_confidence']})")
            return "DENY"
        
        # Check for uncertainty indicators in reasoning
        uncertainty_keywords = [
            "uncertain", "unclear", "conflicting", "ambiguous", 
            "insufficient", "questionable", "concerning", "risky"
        ]
        
        reasoning_lower = judge_reasoning.lower()
        if any(keyword in reasoning_lower for keyword in uncertainty_keywords):
            logger.debug("Applying safety bias: Uncertainty detected in reasoning")
            return "DENY"
        
        # Analyze vote distribution - patent requires DENY > APPROVE when uncertain
        approve_count = analysis["approve_count"]
        deny_count = analysis["deny_count"]
        
        # If more DENY votes or equal, apply safety bias (patent requirement)
        if deny_count >= approve_count:
            logger.debug(f"Applying safety bias: DENY votes ({deny_count}) >= APPROVE votes ({approve_count})")
            return "DENY"
        
        # Only allow APPROVE if significantly more APPROVE votes and high confidence
        if approve_count > deny_count * 2 and analysis["avg_confidence"] > 80:
            logger.debug("Strong APPROVE consensus with high confidence")
            return "APPROVE"
        
        # Default to safety bias (patent requirement: DENY > APPROVE when uncertain)
        logger.debug("Applying default safety bias")
        return "DENY"
    
    def _calculate_judge_confidence(self, analysis: Dict[str, Any], final_decision: str) -> int:
        """
        Calculate Judge confidence in the decision.
        
        Args:
            analysis: Analysis of Senator responses
            final_decision: Final decision made
            
        Returns:
            int: Confidence score 0-100
        """
        base_confidence = 50  # Start with moderate confidence
        
        # Adjust based on Senator agreement
        total_votes = analysis["approve_count"] + analysis["deny_count"]
        if total_votes > 0:
            if final_decision == "DENY":
                # Higher confidence if Senators also leaned DENY
                deny_ratio = analysis["deny_count"] / total_votes
                base_confidence += int(deny_ratio * 30)
            else:
                # Lower confidence for APPROVE against safety bias
                approve_ratio = analysis["approve_count"] / total_votes
                base_confidence += int(approve_ratio * 20)
        
        # Adjust for risk flags (lower confidence when risks present)
        risk_penalty = min(analysis["risk_flag_count"] * 10, 30)
        base_confidence -= risk_penalty
        
        # Adjust for abstentions (lower confidence with more abstentions)
        abstention_ratio = analysis["abstention_count"] / analysis["total_senators"]
        abstention_penalty = int(abstention_ratio * 20)
        base_confidence -= abstention_penalty
        
        # Adjust for Senator confidence
        if analysis["avg_confidence"] > 0:
            confidence_factor = analysis["avg_confidence"] / 100
            base_confidence = int(base_confidence * (0.5 + confidence_factor * 0.5))
        
        return max(0, min(100, base_confidence))
    
    def _create_comprehensive_risk_summary(
        self, 
        responses: List[SenatorResponse], 
        analysis: Dict[str, Any]
    ) -> List[str]:
        """
        Create comprehensive risk summary for Judge decision.
        
        Args:
            responses: All Senator responses
            analysis: Analysis results
            
        Returns:
            List of risk summary statements
        """
        risk_summary = []
        
        # Add vote distribution info
        if analysis["has_split_vote"]:
            risk_summary.append(f"Split Senate vote: {analysis['vote_counts']}")
        
        # Add abstention info if significant
        if analysis["abstention_count"] > 0:
            risk_summary.append(f"{analysis['abstention_count']} Senator abstentions")
        
        # Add risk flags
        if analysis["all_risk_flags"]:
            risk_summary.append(f"Risk flags: {', '.join(analysis['all_risk_flags'])}")
        
        # Add confidence info
        if analysis["avg_confidence"] < 70:
            risk_summary.append(f"Low Senator confidence: {analysis['avg_confidence']:.0f}%")
        
        return risk_summary
    
    def _create_protected_risk_verdict(
        self, 
        transaction_id: str, 
        protected_flags: List[str],
        analysis: Dict[str, Any]
    ) -> GovernanceVerdict:
        """
        Create verdict for protected risk flag escalation.
        
        Args:
            transaction_id: Transaction identifier
            protected_flags: Protected risk flags found
            analysis: Senator response analysis
            
        Returns:
            GovernanceVerdict: DENY verdict with protected risk explanation
        """
        risk_summary = [
            f"Protected risk flags detected: {', '.join(protected_flags)}",
            "Automatic DENY applied for protected risks"
        ]
        
        # Add additional context
        if analysis["vote_counts"]:
            risk_summary.append(f"Senate votes: {analysis['vote_counts']}")
        
        return GovernanceVerdict(
            final_decision="DENY",
            decision_source="JUDGE",
            risk_summary=risk_summary,
            confidence=95,  # High confidence in protected risk decisions
            transaction_id=transaction_id
        )
    
    def _create_error_fallback_verdict(self, transaction_id: str, error_msg: str) -> GovernanceVerdict:
        """
        Create fallback verdict when Judge arbitration fails.
        
        Args:
            transaction_id: Transaction identifier
            error_msg: Error message
            
        Returns:
            GovernanceVerdict: Maximum safety bias DENY verdict
        """
        logger.error(f"Judge arbitration failed, applying maximum safety bias: {error_msg}")
        
        return GovernanceVerdict(
            final_decision="DENY",
            decision_source="JUDGE",
            risk_summary=[
                "Judge arbitration failed - maximum safety bias applied",
                f"Error: {error_msg}"
            ],
            confidence=100,  # Maximum confidence in safety bias
            transaction_id=transaction_id
        )