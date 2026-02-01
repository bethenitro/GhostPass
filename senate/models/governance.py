"""
Core governance data models for The Senate.

These models define the structure for governance requests, responses, verdicts,
and audit records. They implement the zero-persistence principle for sensitive
data while maintaining comprehensive audit trails.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
import hashlib


@dataclass
class GovernanceRequest:
    """
    Input request for governance evaluation.
    
    Contains the user prompt and transaction ID. The user_prompt will be
    hashed immediately upon receipt and the raw content wiped from memory
    after processing to ensure zero persistence of sensitive data.
    
    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
    """
    user_prompt: str
    transaction_id: str
    
    def generate_hash(self) -> str:
        """Generate SHA-256 hash of user_prompt for audit purposes."""
        return hashlib.sha256(self.user_prompt.encode('utf-8')).hexdigest()


@dataclass
class SenatorResponse:
    """
    Response from a Senator LLM evaluation.
    
    Represents the structured output from a Senator, including vote decision,
    confidence score, identified risk flags, and reasoning. Invalid responses
    are converted to abstentions with clear reasoning.
    
    Requirements: 8.1, 4.1, 4.2, 4.3, 4.4, 4.5
    """
    senator_id: str
    vote: Optional[str] = None  # "APPROVE" | "DENY" | "ESCALATE" | None (abstention)
    confidence_score: Optional[int] = None  # 0-100 or None (abstention)
    risk_flags: List[str] = field(default_factory=list)
    reasoning: Optional[str] = None
    is_abstention: bool = False
    abstention_reason: Optional[str] = None
    
    def __post_init__(self):
        """Validate response format and convert invalid responses to abstentions."""
        if self.is_abstention:
            return
            
        # Validate vote format
        if self.vote not in ["APPROVE", "DENY", "ESCALATE"]:
            self._convert_to_abstention(f"Invalid vote value: {self.vote}")
            return
            
        # Validate confidence score
        if (self.confidence_score is not None and 
            (not isinstance(self.confidence_score, int) or 
             not 0 <= self.confidence_score <= 100)):
            self._convert_to_abstention(f"Invalid confidence score: {self.confidence_score}")
            return
            
        # Validate risk_flags is a list
        if not isinstance(self.risk_flags, list):
            self._convert_to_abstention(f"Invalid risk_flags format: {type(self.risk_flags)}")
            return
            
        # Validate reasoning is a string if provided
        if self.reasoning is not None and not isinstance(self.reasoning, str):
            self._convert_to_abstention(f"Invalid reasoning format: {type(self.reasoning)}")
            return
    
    def _convert_to_abstention(self, reason: str):
        """Convert this response to an abstention with the given reason."""
        self.vote = None
        self.confidence_score = None
        self.risk_flags = []
        self.reasoning = None
        self.is_abstention = True
        self.abstention_reason = reason


@dataclass
class GovernanceVerdict:
    """
    Final governance decision output.
    
    Contains the authoritative decision, source of decision, risk summary,
    confidence level, and metadata. This is the final output returned to
    client systems for action.
    
    Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
    """
    final_decision: str  # "APPROVE" | "DENY"
    decision_source: str  # "SENATE" | "JUDGE" | "VETO"
    risk_summary: List[str]
    confidence: int
    transaction_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """Validate verdict format compliance."""
        if self.final_decision not in ["APPROVE", "DENY"]:
            raise ValueError(f"Invalid final_decision: {self.final_decision}")
            
        if self.decision_source not in ["SENATE", "JUDGE", "VETO"]:
            raise ValueError(f"Invalid decision_source: {self.decision_source}")
            
        if not isinstance(self.risk_summary, list):
            raise ValueError(f"risk_summary must be a list, got {type(self.risk_summary)}")
            
        if not isinstance(self.confidence, int) or not 0 <= self.confidence <= 100:
            raise ValueError(f"confidence must be integer 0-100, got {self.confidence}")


@dataclass
class AuditRecord:
    """
    Audit trail record for governance decisions.
    
    Maintains comprehensive audit information without storing sensitive data.
    Only SHA-256 hashes, transaction metadata, verdicts, and timestamps are
    persisted to ensure compliance and auditability.
    
    Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 5.3, 5.5
    """
    transaction_id: str
    input_hash: str
    final_verdict: GovernanceVerdict
    abstention_count: int
    veto_applied: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    def apply_veto(self, new_decision: str, veto_reason: str):
        """Apply human veto to this audit record."""
        # Update the verdict
        self.final_verdict.final_decision = new_decision
        self.final_verdict.decision_source = "VETO"
        self.final_verdict.timestamp = datetime.utcnow()
        
        # Update audit metadata
        self.veto_applied = True
        self.updated_at = datetime.utcnow()


@dataclass
class VetoResult:
    """
    Result of a human veto operation.
    
    Contains information about the veto action including the original decision,
    new decision, and timing information for audit purposes.
    
    Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
    """
    transaction_id: str
    original_decision: str
    new_decision: str
    veto_reason: str
    veto_timestamp: datetime = field(default_factory=datetime.utcnow)
    success: bool = True