"""
Unit tests for The Senate data models.

Tests the core data models for proper validation, error handling,
and compliance with requirements.
"""

import pytest
from datetime import datetime
from models.governance import (
    GovernanceRequest,
    SenatorResponse,
    GovernanceVerdict,
    AuditRecord,
    VetoResult
)
from models.config import (
    LLMConfig,
    SenatorConfig,
    GovernanceConfig
)


class TestGovernanceRequest:
    """Test GovernanceRequest model."""
    
    def test_valid_request_creation(self):
        """Test creating a valid governance request."""
        request = GovernanceRequest(
            user_prompt="Test prompt",
            transaction_id="test-123"
        )
        assert request.user_prompt == "Test prompt"
        assert request.transaction_id == "test-123"
    
    def test_hash_generation(self):
        """Test SHA-256 hash generation."""
        request = GovernanceRequest(
            user_prompt="Test prompt",
            transaction_id="test-123"
        )
        hash1 = request.generate_hash()
        hash2 = request.generate_hash()
        
        # Same input should produce same hash
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 produces 64 character hex string
        
        # Different input should produce different hash
        request2 = GovernanceRequest(
            user_prompt="Different prompt",
            transaction_id="test-123"
        )
        assert request.generate_hash() != request2.generate_hash()


class TestSenatorResponse:
    """Test SenatorResponse model."""
    
    def test_valid_response_creation(self):
        """Test creating a valid Senator response."""
        response = SenatorResponse(
            senator_id="senator-1",
            vote="APPROVE",
            confidence_score=85,
            risk_flags=["low-risk"],
            reasoning="Action appears safe"
        )
        assert response.senator_id == "senator-1"
        assert response.vote == "APPROVE"
        assert response.confidence_score == 85
        assert response.risk_flags == ["low-risk"]
        assert response.reasoning == "Action appears safe"
        assert not response.is_abstention
    
    def test_invalid_vote_converts_to_abstention(self):
        """Test that invalid vote values are converted to abstentions."""
        response = SenatorResponse(
            senator_id="senator-1",
            vote="INVALID",
            confidence_score=85,
            risk_flags=[],
            reasoning="Test"
        )
        assert response.is_abstention
        assert response.vote is None
        assert "Invalid vote value" in response.abstention_reason
    
    def test_invalid_confidence_score_converts_to_abstention(self):
        """Test that invalid confidence scores are converted to abstentions."""
        response = SenatorResponse(
            senator_id="senator-1",
            vote="APPROVE",
            confidence_score=150,  # Invalid: > 100
            risk_flags=[],
            reasoning="Test"
        )
        assert response.is_abstention
        assert response.confidence_score is None
        assert "Invalid confidence score" in response.abstention_reason
    
    def test_invalid_risk_flags_converts_to_abstention(self):
        """Test that invalid risk_flags format is converted to abstention."""
        response = SenatorResponse(
            senator_id="senator-1",
            vote="APPROVE",
            confidence_score=85,
            risk_flags="not-a-list",  # Invalid: should be list
            reasoning="Test"
        )
        assert response.is_abstention
        assert "Invalid risk_flags format" in response.abstention_reason


class TestGovernanceVerdict:
    """Test GovernanceVerdict model."""
    
    def test_valid_verdict_creation(self):
        """Test creating a valid governance verdict."""
        verdict = GovernanceVerdict(
            final_decision="APPROVE",
            decision_source="SENATE",
            risk_summary=["low-risk"],
            confidence=85,
            transaction_id="test-123"
        )
        assert verdict.final_decision == "APPROVE"
        assert verdict.decision_source == "SENATE"
        assert verdict.risk_summary == ["low-risk"]
        assert verdict.confidence == 85
        assert verdict.transaction_id == "test-123"
        assert isinstance(verdict.timestamp, datetime)
    
    def test_invalid_final_decision_raises_error(self):
        """Test that invalid final_decision values raise ValueError."""
        with pytest.raises(ValueError, match="Invalid final_decision"):
            GovernanceVerdict(
                final_decision="INVALID",
                decision_source="SENATE",
                risk_summary=[],
                confidence=85,
                transaction_id="test-123"
            )
    
    def test_invalid_decision_source_raises_error(self):
        """Test that invalid decision_source values raise ValueError."""
        with pytest.raises(ValueError, match="Invalid decision_source"):
            GovernanceVerdict(
                final_decision="APPROVE",
                decision_source="INVALID",
                risk_summary=[],
                confidence=85,
                transaction_id="test-123"
            )


class TestLLMConfig:
    """Test LLMConfig model."""
    
    def test_valid_config_creation(self):
        """Test creating a valid LLM configuration."""
        config = LLMConfig(
            provider="openai",
            model_name="gpt-4",
            timeout_seconds=30,
            max_retries=2
        )
        assert config.provider == "openai"
        assert config.model_name == "gpt-4"
        assert config.timeout_seconds == 30
        assert config.max_retries == 2
    
    def test_empty_provider_raises_error(self):
        """Test that empty provider raises ValueError."""
        with pytest.raises(ValueError, match="provider cannot be empty"):
            LLMConfig(
                provider="",
                model_name="gpt-4"
            )
    
    def test_invalid_timeout_raises_error(self):
        """Test that invalid timeout raises ValueError."""
        with pytest.raises(ValueError, match="timeout_seconds must be positive"):
            LLMConfig(
                provider="openai",
                model_name="gpt-4",
                timeout_seconds=0
            )


class TestGovernanceConfig:
    """Test GovernanceConfig model."""
    
    def test_valid_config_creation(self):
        """Test creating a valid governance configuration."""
        senators = [
            SenatorConfig(
                role_id=f"senator-{i}",
                llm_config=LLMConfig(provider="openai", model_name="gpt-4")
            )
            for i in range(3)
        ]
        
        config = GovernanceConfig(
            senators=senators,
            executive_secretary=LLMConfig(provider="openai", model_name="gpt-4"),
            judge=LLMConfig(provider="openai", model_name="gpt-4"),
            protected_risk_flags=["security", "privacy"]
        )
        
        assert len(config.senators) == 3
        assert config.executive_secretary.provider == "openai"
        assert config.judge.provider == "openai"
        assert "security" in config.protected_risk_flags
    
    def test_insufficient_senators_raises_error(self):
        """Test that less than 3 Senators raises ValueError."""
        senators = [
            SenatorConfig(
                role_id="senator-1",
                llm_config=LLMConfig(provider="openai", model_name="gpt-4")
            )
        ]
        
        with pytest.raises(ValueError, match="Minimum 3 Senators required"):
            GovernanceConfig(
                senators=senators,
                executive_secretary=LLMConfig(provider="openai", model_name="gpt-4"),
                judge=LLMConfig(provider="openai", model_name="gpt-4")
            )
    
    def test_duplicate_senator_ids_raises_error(self):
        """Test that duplicate Senator role IDs raise ValueError."""
        senators = [
            SenatorConfig(
                role_id="senator-1",
                llm_config=LLMConfig(provider="openai", model_name="gpt-4")
            ),
            SenatorConfig(
                role_id="senator-1",  # Duplicate ID
                llm_config=LLMConfig(provider="openai", model_name="gpt-4")
            ),
            SenatorConfig(
                role_id="senator-3",
                llm_config=LLMConfig(provider="openai", model_name="gpt-4")
            )
        ]
        
        with pytest.raises(ValueError, match="Senator role_ids must be unique"):
            GovernanceConfig(
                senators=senators,
                executive_secretary=LLMConfig(provider="openai", model_name="gpt-4"),
                judge=LLMConfig(provider="openai", model_name="gpt-4")
            )
    
    def test_is_protected_risk_flag(self):
        """Test protected risk flag detection."""
        config = GovernanceConfig(
            senators=[
                SenatorConfig(
                    role_id=f"senator-{i}",
                    llm_config=LLMConfig(provider="openai", model_name="gpt-4")
                )
                for i in range(3)
            ],
            executive_secretary=LLMConfig(provider="openai", model_name="gpt-4"),
            judge=LLMConfig(provider="openai", model_name="gpt-4"),
            protected_risk_flags=["security", "privacy", "SAFETY"]
        )
        
        assert config.is_protected_risk_flag("security")
        assert config.is_protected_risk_flag("SECURITY")  # Case insensitive
        assert config.is_protected_risk_flag("privacy")
        assert config.is_protected_risk_flag("safety")
        assert not config.is_protected_risk_flag("low-risk")