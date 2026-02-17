"""
Parallel Senator execution system for The Senate governance engine.

Manages simultaneous dispatch of governance requests to all configured
Senators with timeout handling and abstention recording for failures.

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from models.governance import SenatorResponse
from models.config import GovernanceConfig, SenatorConfig
from core.llm_provider import LLMProvider, LLMProviderFactory
from core.response_normalizer import ResponseNormalizer
from utils.errors import GovernanceError, TimeoutError


logger = logging.getLogger(__name__)


class SenatorDispatcher:
    """
    Manages parallel execution of Senator evaluations.
    
    Dispatches governance requests to all configured Senators simultaneously
    using asyncio.gather pattern with individual timeout handling and
    graceful failure management.
    """
    
    def __init__(self, config: GovernanceConfig):
        """
        Initialize Senator dispatcher.
        
        Args:
            config: Governance configuration containing Senator settings
        """
        self.config = config
        self.response_normalizer = ResponseNormalizer()
        self._senator_providers: Dict[str, LLMProvider] = {}
        self._initialize_senators()
    
    def _initialize_senators(self):
        """Initialize LLM providers for all configured Senators."""
        logger.info(f"Initializing {len(self.config.senators)} Senators")
        
        for senator_config in self.config.senators:
            try:
                provider = LLMProviderFactory.create_provider(senator_config.llm_config)
                self._senator_providers[senator_config.role_id] = provider
                logger.debug(f"Initialized Senator {senator_config.role_id} with {provider.get_provider_name()}")
            except Exception as e:
                logger.error(f"Failed to initialize Senator {senator_config.role_id}: {e}")
                raise GovernanceError(
                    f"Senator initialization failed: {e}",
                    stage="initialization"
                )
    
    async def dispatch_to_senators(self, prompt_hash: str, context: Dict[str, Any]) -> List[SenatorResponse]:
        """
        Dispatch governance request to all Senators in parallel.
        
        Uses asyncio.gather with individual timeouts to ensure no Senator
        can block the entire process. Failed Senators are recorded as
        abstentions.
        
        Args:
            prompt_hash: SHA-256 hash of the user prompt
            context: Governance context including transaction_id
            
        Returns:
            List[SenatorResponse]: Responses from all Senators (including abstentions)
            
        Requirements: 7.1, 7.4
        """
        logger.info(f"Dispatching to {len(self.config.senators)} Senators for transaction {context.get('transaction_id')}")
        start_time = datetime.utcnow()
        
        # Create tasks for all Senators
        tasks = []
        senator_configs = []
        
        for senator_config in self.config.senators:
            task = self._execute_senator_with_timeout(senator_config, prompt_hash, context)
            tasks.append(task)
            senator_configs.append(senator_config)
        
        # Execute all Senator tasks in parallel using Promise.allSettled pattern
        try:
            # Use asyncio.gather with return_exceptions=True for Promise.allSettled behavior
            # This ensures one failed Senator doesn't block others
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and create responses
            responses = []
            for i, (result, senator_config) in enumerate(zip(results, senator_configs)):
                if isinstance(result, Exception):
                    # Convert exception to abstention
                    abstention_reason = self._get_abstention_reason(result)
                    response = self._create_abstention_response(senator_config.role_id, abstention_reason)
                    logger.warning(f"Senator {senator_config.role_id} failed: {abstention_reason}")
                else:
                    response = result
                
                responses.append(response)
            
            # Log execution summary
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            abstention_count = sum(1 for r in responses if r.is_abstention)
            valid_count = len(responses) - abstention_count
            
            logger.info(f"Senator dispatch completed in {execution_time:.2f}s: "
                       f"{valid_count} valid responses, {abstention_count} abstentions")
            
            return responses
            
        except Exception as e:
            logger.error(f"Critical error in Senator dispatch: {e}")
            raise GovernanceError(
                f"Senator dispatch failed: {e}",
                context.get('transaction_id'),
                "senator_dispatch"
            )
    
    async def _execute_senator_with_timeout(
        self, 
        senator_config: SenatorConfig, 
        prompt_hash: str, 
        context: Dict[str, Any]
    ) -> SenatorResponse:
        """
        Execute individual Senator with timeout enforcement.
        
        Args:
            senator_config: Configuration for this Senator
            prompt_hash: SHA-256 hash of the user prompt
            context: Governance context
            
        Returns:
            SenatorResponse: Response from Senator or abstention
            
        Requirements: 7.2, 7.3, 7.5
        """
        senator_id = senator_config.role_id
        timeout_seconds = senator_config.timeout_seconds
        
        try:
            # Get LLM provider for this Senator
            provider = self._senator_providers.get(senator_id)
            if not provider:
                raise GovernanceError(f"No provider found for Senator {senator_id}")
            
            # Create Senator prompt
            senator_prompt = self._create_senator_prompt(prompt_hash, context)
            senator_context = {**context, 'role': 'senator', 'senator_id': senator_id}
            
            # Execute with hard timeout
            logger.debug(f"Executing Senator {senator_id} with {timeout_seconds}s timeout")
            
            raw_response = await asyncio.wait_for(
                provider.generate_response_with_retry(senator_prompt, senator_context),
                timeout=timeout_seconds
            )
            
            # Normalize response
            response = self.response_normalizer.normalize_response(raw_response, senator_id)
            
            if response.is_abstention:
                logger.warning(f"Senator {senator_id} response normalized to abstention: {response.abstention_reason}")
            else:
                logger.debug(f"Senator {senator_id} responded: {response.vote} (confidence: {response.confidence_score})")
            
            return response
            
        except asyncio.TimeoutError:
            # Hard timeout exceeded
            reason = f"Timeout after {timeout_seconds}s"
            logger.warning(f"Senator {senator_id} timed out after {timeout_seconds}s")
            return self._create_abstention_response(senator_id, reason)
            
        except Exception as e:
            # Any other error
            reason = f"Execution error: {str(e)}"
            logger.warning(f"Senator {senator_id} failed: {reason}")
            return self._create_abstention_response(senator_id, reason)
    
    def _create_senator_prompt(self, prompt_hash: str, context: Dict[str, Any]) -> str:
        """
        Create standardized prompt for Senator evaluation.
        
        Args:
            prompt_hash: SHA-256 hash of user prompt
            context: Governance context
            
        Returns:
            str: Formatted prompt for Senator
        """
        return f"""You are a Senator in The Senate governance system. Your role is to evaluate whether a user action should be approved, denied, or escalated for further review.

CRITICAL: You must respond with ONLY valid JSON containing exactly these fields:
{{"vote": "APPROVE" | "DENY" | "ESCALATE", "confidence_score": 0-100, "risk_flags": [], "reasoning": "One sentence explanation"}}

Invalid JSON = ABSTAIN. Your response will be automatically converted to abstention if it doesn't match this exact format.

Input Hash: {prompt_hash}
Transaction ID: {context.get('transaction_id', 'unknown')}

Evaluate this action and provide your vote. Consider security implications, policy compliance, and potential risks. If you detect any serious security concerns, include appropriate risk flags.

Respond with valid JSON only, no additional text."""
    
    def _create_abstention_response(self, senator_id: str, reason: str) -> SenatorResponse:
        """
        Create abstention response for failed Senator.
        
        Args:
            senator_id: Senator identifier
            reason: Reason for abstention
            
        Returns:
            SenatorResponse: Abstention response
        """
        return SenatorResponse(
            senator_id=senator_id,
            vote=None,
            confidence_score=None,
            risk_flags=[],
            reasoning=None,
            is_abstention=True,
            abstention_reason=reason
        )
    
    def _get_abstention_reason(self, error: Exception) -> str:
        """
        Extract appropriate abstention reason from exception.
        
        Args:
            error: Exception that caused the failure
            
        Returns:
            str: Human-readable abstention reason
        """
        if isinstance(error, asyncio.TimeoutError):
            return "Request timeout"
        elif isinstance(error, TimeoutError):
            return f"Timeout after {error.timeout_seconds}s"
        elif hasattr(error, 'message'):
            return f"Error: {error.message}"
        else:
            return f"Error: {str(error)}"
    
    def get_senator_count(self) -> int:
        """Get total number of configured Senators."""
        return len(self.config.senators)
    
    def get_senator_ids(self) -> List[str]:
        """Get list of all Senator role IDs."""
        return [senator.role_id for senator in self.config.senators]
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on all Senator providers.
        
        Returns:
            Dict: Health status for each Senator
        """
        health_status = {}
        
        for senator_config in self.config.senators:
            senator_id = senator_config.role_id
            provider = self._senator_providers.get(senator_id)
            
            if provider:
                try:
                    # Quick test with minimal prompt
                    test_context = {'role': 'senator', 'health_check': True}
                    await asyncio.wait_for(
                        provider.generate_response("health check", test_context),
                        timeout=5.0
                    )
                    health_status[senator_id] = "healthy"
                except Exception as e:
                    health_status[senator_id] = f"unhealthy: {str(e)}"
            else:
                health_status[senator_id] = "not_initialized"
        
        return health_status


class SenatorExecutionMetrics:
    """
    Tracks metrics for Senator execution performance.
    
    Provides insights into timeout rates, abstention patterns,
    and overall system performance.
    """
    
    def __init__(self):
        """Initialize metrics tracking."""
        self.total_executions = 0
        self.total_abstentions = 0
        self.timeout_count = 0
        self.error_count = 0
        self.execution_times = []
        self.senator_performance = {}
    
    def record_execution(
        self, 
        responses: List[SenatorResponse], 
        execution_time: float
    ):
        """
        Record metrics from Senator execution.
        
        Args:
            responses: List of Senator responses
            execution_time: Total execution time in seconds
        """
        self.total_executions += 1
        self.execution_times.append(execution_time)
        
        abstention_count = 0
        for response in responses:
            senator_id = response.senator_id
            
            # Initialize senator metrics if needed
            if senator_id not in self.senator_performance:
                self.senator_performance[senator_id] = {
                    'total': 0,
                    'abstentions': 0,
                    'timeouts': 0,
                    'errors': 0
                }
            
            # Update senator metrics
            self.senator_performance[senator_id]['total'] += 1
            
            if response.is_abstention:
                abstention_count += 1
                self.senator_performance[senator_id]['abstentions'] += 1
                
                if 'timeout' in (response.abstention_reason or '').lower():
                    self.timeout_count += 1
                    self.senator_performance[senator_id]['timeouts'] += 1
                else:
                    self.error_count += 1
                    self.senator_performance[senator_id]['errors'] += 1
        
        self.total_abstentions += abstention_count
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of execution metrics."""
        if self.total_executions == 0:
            return {"status": "no_executions"}
        
        avg_execution_time = sum(self.execution_times) / len(self.execution_times)
        abstention_rate = self.total_abstentions / (self.total_executions * len(self.senator_performance))
        
        return {
            "total_executions": self.total_executions,
            "average_execution_time": avg_execution_time,
            "abstention_rate": abstention_rate,
            "timeout_count": self.timeout_count,
            "error_count": self.error_count,
            "senator_performance": self.senator_performance
        }