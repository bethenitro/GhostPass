"""
Response normalization and validation for The Senate governance engine.

Validates LLM responses and converts invalid outputs to abstentions with
clear reasoning. Handles malformed JSON, invalid vote values, confidence
scores, and risk flags.

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 4.1, 4.2, 4.3, 4.4, 4.5
"""

import json
import logging
from typing import Dict, Any, Optional, List, Union

from models.governance import SenatorResponse
from utils.errors import ValidationError


logger = logging.getLogger(__name__)


class ResponseNormalizer:
    """
    Validates and normalizes LLM responses into structured SenatorResponse objects.
    
    Converts invalid responses to abstentions while maintaining clear audit
    trails of why responses were rejected.
    """
    
    def __init__(self):
        """Initialize response normalizer."""
        self.valid_votes = {"APPROVE", "DENY", "ESCALATE"}
    
    def normalize_response(self, raw_response: str, senator_id: str) -> SenatorResponse:
        """
        Normalize raw LLM response into structured SenatorResponse.
        
        Args:
            raw_response: Raw string response from LLM
            senator_id: Identifier of the Senator that generated the response
            
        Returns:
            SenatorResponse: Normalized response or abstention
        """
        logger.debug(f"Normalizing response from {senator_id}")
        
        try:
            # Parse JSON response
            parsed_data = self._parse_json_response(raw_response)
            if parsed_data is None:
                return self._create_abstention(
                    senator_id, 
                    f"Invalid JSON format: {raw_response[:100]}..."
                )
            
            # Validate required fields
            validation_result = self._validate_response_structure(parsed_data)
            if not validation_result.is_valid:
                return self._create_abstention(senator_id, validation_result.error_message)
            
            # Extract and validate individual fields
            vote = self._validate_vote(parsed_data.get('vote'))
            confidence_score = self._validate_confidence_score(parsed_data.get('confidence_score'))
            risk_flags = self._validate_risk_flags(parsed_data.get('risk_flags', []))
            reasoning = self._validate_reasoning(parsed_data.get('reasoning'))
            
            # Check if any field validation failed
            if vote is None:
                return self._create_abstention(
                    senator_id,
                    f"Invalid vote value: {parsed_data.get('vote')}"
                )
            
            if confidence_score is None and parsed_data.get('confidence_score') is not None:
                return self._create_abstention(
                    senator_id,
                    f"Invalid confidence_score: {parsed_data.get('confidence_score')}"
                )
            
            if risk_flags is None:
                return self._create_abstention(
                    senator_id,
                    f"Invalid risk_flags format: {type(parsed_data.get('risk_flags'))}"
                )
            
            # Create valid response
            response = SenatorResponse(
                senator_id=senator_id,
                vote=vote,
                confidence_score=confidence_score,
                risk_flags=risk_flags or [],
                reasoning=reasoning,
                is_abstention=False,
                abstention_reason=None
            )
            
            logger.debug(f"Successfully normalized response from {senator_id}: {vote}")
            return response
            
        except Exception as e:
            logger.warning(f"Unexpected error normalizing response from {senator_id}: {e}")
            return self._create_abstention(
                senator_id,
                f"Normalization error: {str(e)}"
            )
    
    def _parse_json_response(self, raw_response: str) -> Optional[Dict[str, Any]]:
        """
        Parse JSON response with error handling.
        
        Args:
            raw_response: Raw string response
            
        Returns:
            Dict or None if parsing fails
        """
        try:
            # Strip whitespace and common formatting issues
            cleaned_response = raw_response.strip()
            
            # Handle empty responses
            if not cleaned_response:
                return None
            
            # Parse JSON
            parsed = json.loads(cleaned_response)
            
            # Ensure we have a dictionary
            if not isinstance(parsed, dict):
                logger.warning(f"Response is not a JSON object: {type(parsed)}")
                return None
            
            return parsed
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parsing failed: {e}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected parsing error: {e}")
            return None
    
    def _validate_response_structure(self, data: Dict[str, Any]) -> 'ValidationResult':
        """
        Validate that response contains required fields.
        
        Args:
            data: Parsed response data
            
        Returns:
            ValidationResult: Validation outcome
        """
        required_fields = ['vote', 'confidence_score', 'risk_flags', 'reasoning']
        missing_fields = []
        
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            return ValidationResult(
                is_valid=False,
                error_message=f"Missing required fields: {missing_fields}"
            )
        
        return ValidationResult(is_valid=True)
    
    def _validate_vote(self, vote: Any) -> Optional[str]:
        """
        Validate vote field.
        
        Args:
            vote: Vote value to validate
            
        Returns:
            str or None if invalid
        """
        if not isinstance(vote, str):
            return None
        
        vote_upper = vote.upper().strip()
        if vote_upper not in self.valid_votes:
            return None
        
        return vote_upper
    
    def _validate_confidence_score(self, confidence: Any) -> Optional[int]:
        """
        Validate confidence score field.
        
        Args:
            confidence: Confidence value to validate
            
        Returns:
            int or None if invalid
        """
        if confidence is None:
            return None
        
        # Handle string numbers
        if isinstance(confidence, str):
            try:
                confidence = int(confidence)
            except ValueError:
                return None
        
        # Must be integer
        if not isinstance(confidence, int):
            return None
        
        # Must be in valid range
        if not 0 <= confidence <= 100:
            return None
        
        return confidence
    
    def _validate_risk_flags(self, risk_flags: Any) -> Optional[List[str]]:
        """
        Validate risk flags field.
        
        Args:
            risk_flags: Risk flags to validate
            
        Returns:
            List[str] or None if invalid
        """
        if risk_flags is None:
            return []
        
        if not isinstance(risk_flags, list):
            return None
        
        # Validate each flag is a string
        validated_flags = []
        for flag in risk_flags:
            if isinstance(flag, str):
                validated_flags.append(flag.strip())
            else:
                # Invalid flag type
                return None
        
        return validated_flags
    
    def _validate_reasoning(self, reasoning: Any) -> Optional[str]:
        """
        Validate reasoning field.
        
        Args:
            reasoning: Reasoning to validate
            
        Returns:
            str or None if invalid
        """
        if reasoning is None:
            return None
        
        if not isinstance(reasoning, str):
            return None
        
        return reasoning.strip()
    
    def _create_abstention(self, senator_id: str, reason: str) -> SenatorResponse:
        """
        Create abstention response with clear reasoning.
        
        Args:
            senator_id: Senator identifier
            reason: Reason for abstention
            
        Returns:
            SenatorResponse: Abstention response
        """
        logger.info(f"Creating abstention for {senator_id}: {reason}")
        
        return SenatorResponse(
            senator_id=senator_id,
            vote=None,
            confidence_score=None,
            risk_flags=[],
            reasoning=None,
            is_abstention=True,
            abstention_reason=reason
        )


class ValidationResult:
    """Result of response validation."""
    
    def __init__(self, is_valid: bool, error_message: str = ""):
        self.is_valid = is_valid
        self.error_message = error_message


class ResponseValidator:
    """
    Additional validation utilities for response processing.
    
    Provides specialized validation methods for different response types
    and governance roles.
    """
    
    @staticmethod
    def validate_senator_response_format(data: Dict[str, Any]) -> bool:
        """
        Validate that data matches expected Senator response format.
        
        Args:
            data: Response data to validate
            
        Returns:
            bool: True if format is valid
        """
        required_fields = ['vote', 'confidence_score', 'risk_flags', 'reasoning']
        
        # Check all required fields exist
        for field in required_fields:
            if field not in data:
                return False
        
        # Validate vote
        vote = data.get('vote')
        if not isinstance(vote, str) or vote.upper() not in {'APPROVE', 'DENY', 'ESCALATE'}:
            return False
        
        # Validate confidence_score
        confidence = data.get('confidence_score')
        if confidence is not None:
            if not isinstance(confidence, int) or not 0 <= confidence <= 100:
                return False
        
        # Validate risk_flags
        risk_flags = data.get('risk_flags')
        if not isinstance(risk_flags, list):
            return False
        
        for flag in risk_flags:
            if not isinstance(flag, str):
                return False
        
        # Validate reasoning
        reasoning = data.get('reasoning')
        if reasoning is not None and not isinstance(reasoning, str):
            return False
        
        return True
    
    @staticmethod
    def extract_risk_flags(responses: List[SenatorResponse]) -> List[str]:
        """
        Extract all unique risk flags from Senator responses.
        
        Args:
            responses: List of Senator responses
            
        Returns:
            List[str]: Unique risk flags
        """
        all_flags = []
        for response in responses:
            if not response.is_abstention and response.risk_flags:
                all_flags.extend(response.risk_flags)
        
        # Return unique flags while preserving order
        seen = set()
        unique_flags = []
        for flag in all_flags:
            if flag not in seen:
                seen.add(flag)
                unique_flags.append(flag)
        
        return unique_flags
    
    @staticmethod
    def count_abstentions(responses: List[SenatorResponse]) -> int:
        """
        Count number of abstentions in responses.
        
        Args:
            responses: List of Senator responses
            
        Returns:
            int: Number of abstentions
        """
        return sum(1 for response in responses if response.is_abstention)
    
    @staticmethod
    def get_valid_responses(responses: List[SenatorResponse]) -> List[SenatorResponse]:
        """
        Filter out abstentions and return only valid responses.
        
        Args:
            responses: List of Senator responses
            
        Returns:
            List[SenatorResponse]: Valid responses only
        """
        return [response for response in responses if not response.is_abstention]