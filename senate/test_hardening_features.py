#!/usr/bin/env python3
"""
Hardening Features Test Suite

Tests the new hardening features:
1. Quorum enforcement - minimum valid senators required
2. Confidence threshold - minimum confidence for APPROVE decisions

These tests ensure the safety hardening works as expected.
"""

import asyncio
import json
import logging
import sys
import os
from typing import Dict, Any, List

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from senate.core.governance_orchestrator import GovernanceOrchestrator
from senate.models.governance import GovernanceRequest
from senate.models.config import GovernanceConfig, SenatorConfig, LLMConfig
from senate.core.llm_provider import MockLLMProvider, LLMProviderFactory


class HardeningTestSuite:
    """Test suite for hardening features."""
    
    def __init__(self):
        self.setup_logging()
        self.logger = logging.getLogger("senate.hardening_test")
    
    def setup_logging(self):
        """Setup test logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
    
    def create_test_orchestrator(self, senator_configs: List[Dict[str, Any]], 
                                minimum_quorum: int = 2, 
                                min_approve_confidence: int = 60) -> GovernanceOrchestrator:
        """Create orchestrator with custom hardening parameters."""
        senators = []
        
        for i, senator_config in enumerate(senator_configs):
            role_id = f"senator_{senator_config.get('role', f'test_{i}')}"
            
            llm_config = LLMConfig(
                provider="mock",
                model_name=f"test-model-{i}",
                timeout_seconds=5,
                max_retries=1
            )
            
            senator = SenatorConfig(
                role_id=role_id,
                llm_config=llm_config,
                timeout_seconds=5,
                max_retries=1
            )
            senators.append(senator)
        
        # Create test configuration with custom hardening parameters
        config = GovernanceConfig(
            senators=senators,
            executive_secretary=LLMConfig(provider="mock", model_name="exec-test", timeout_seconds=10, max_retries=1),
            judge=LLMConfig(provider="mock", model_name="judge-test", timeout_seconds=15, max_retries=1),
            protected_risk_flags=["security_vulnerability", "data_breach_risk"],
            default_timeout=5,
            safety_bias_threshold=0.5,
            max_concurrent_requests=100,
            audit_retention_days=365,
            minimum_quorum=minimum_quorum,
            min_approve_confidence=min_approve_confidence
        )
        
        orchestrator = GovernanceOrchestrator(config)
        
        # Configure mock responses for each senator
        for i, senator_config in enumerate(senator_configs):
            senator_id = f"senator_{senator_config.get('role', f'test_{i}')}"
            provider = orchestrator.senator_dispatcher._senator_providers.get(senator_id)
            
            if provider and hasattr(provider, 'responses'):
                if senator_config.get('type') == 'timeout':
                    provider.set_timeout_behavior(True)
                elif senator_config.get('type') == 'hallucinating':
                    provider.set_failure_behavior(True, "Invalid JSON response")
                elif 'response' in senator_config:
                    provider.responses = [senator_config['response']]
        
        return orchestrator
    
    async def test_quorum_enforcement_insufficient(self) -> bool:
        """Test that insufficient quorum triggers escalation."""
        print("Testing insufficient quorum enforcement...")
        
        # Configure only 1 valid senator (below minimum quorum of 2)
        senator_configs = [
            {
                'role': 'security',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 90,
                    'risk_flags': [],
                    'reasoning': 'Security approved'
                }
            },
            {
                'type': 'timeout',  # This will abstain
                'role': 'compliance'
            },
            {
                'type': 'hallucinating',  # This will abstain
                'role': 'operations'
            }
        ]
        
        orchestrator = self.create_test_orchestrator(senator_configs, minimum_quorum=2)
        
        request = GovernanceRequest(
            user_prompt="Test insufficient quorum",
            transaction_id="test_quorum_insufficient"
        )
        
        verdict = await orchestrator.evaluate_action(request)
        
        # Should escalate to Judge due to insufficient quorum
        checks = [
            ("Judge was invoked", verdict.decision_source == "JUDGE"),
            ("Decision made (safety fallback)", verdict.final_decision in ["APPROVE", "DENY"]),
            ("Quorum issue noted", any("abstention" in str(flag).lower() or "quorum" in str(flag).lower() or "Only 1 valid" in str(flag) or "minimum 2 required" in str(flag) for flag in verdict.risk_summary)),
            ("Raw prompt wiped", request.user_prompt == "[WIPED]")
        ]
        
        passed_checks = sum(1 for _, check in checks if check)
        
        for description, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {description}")
        
        return passed_checks == len(checks)
    
    async def test_quorum_enforcement_sufficient(self) -> bool:
        """Test that sufficient quorum allows normal processing."""
        print("Testing sufficient quorum processing...")
        
        # Configure 2 valid senators with VERY HIGH confidence to avoid threshold trigger
        senator_configs = [
            {
                'role': 'security',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 95,  # Very high confidence
                    'risk_flags': [],
                    'reasoning': 'Security approved'
                }
            },
            {
                'role': 'compliance',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 95,  # Very high confidence
                    'risk_flags': [],
                    'reasoning': 'Compliance approved'
                }
            },
            {
                'type': 'timeout',  # This will abstain but we still have quorum
                'role': 'operations'
            }
        ]
        
        orchestrator = self.create_test_orchestrator(senator_configs, minimum_quorum=2)
        
        request = GovernanceRequest(
            user_prompt="Test sufficient quorum",
            transaction_id="test_quorum_sufficient"
        )
        
        verdict = await orchestrator.evaluate_action(request)
        
        # Should process normally with Senate decision
        checks = [
            ("Senate decided", verdict.decision_source == "SENATE"),
            ("Decision is APPROVE", verdict.final_decision == "APPROVE"),
            ("Good confidence", verdict.confidence >= 60),  # Should be well above threshold now
            ("No quorum issues", not any("INSUFFICIENT_QUORUM" in str(flag) or "quorum" in str(flag).lower() for flag in verdict.risk_summary)),
            ("Raw prompt wiped", request.user_prompt == "[WIPED]")
        ]
        
        passed_checks = sum(1 for _, check in checks if check)
        
        for description, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {description}")
        
        return passed_checks == len(checks)
    
    async def test_confidence_threshold_low(self) -> bool:
        """Test that low confidence APPROVE triggers escalation."""
        print("Testing low confidence APPROVE escalation...")
        
        # Configure senators with low confidence APPROVE
        senator_configs = [
            {
                'role': 'security',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 40,  # Below threshold of 60
                    'risk_flags': [],
                    'reasoning': 'Uncertain security approval'
                }
            },
            {
                'role': 'compliance',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 45,  # Below threshold of 60
                    'risk_flags': [],
                    'reasoning': 'Uncertain compliance approval'
                }
            },
            {
                'role': 'operations',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 50,  # Below threshold of 60
                    'risk_flags': [],
                    'reasoning': 'Uncertain operations approval'
                }
            }
        ]
        
        orchestrator = self.create_test_orchestrator(senator_configs, min_approve_confidence=60)
        
        request = GovernanceRequest(
            user_prompt="Test low confidence approval",
            transaction_id="test_confidence_low"
        )
        
        verdict = await orchestrator.evaluate_action(request)
        
        # Should escalate to Judge due to low confidence
        checks = [
            ("Judge was invoked", verdict.decision_source == "JUDGE"),
            ("Decision made (safety fallback)", verdict.final_decision in ["APPROVE", "DENY"]),
            ("Low confidence noted", any("LOW_CONFIDENCE" in flag or "confidence" in flag.lower() for flag in verdict.risk_summary)),
            ("Raw prompt wiped", request.user_prompt == "[WIPED]")
        ]
        
        passed_checks = sum(1 for _, check in checks if check)
        
        for description, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {description}")
        
        return passed_checks == len(checks)
    
    async def test_confidence_threshold_high(self) -> bool:
        """Test that high confidence APPROVE processes normally."""
        print("Testing high confidence APPROVE processing...")
        
        # Configure senators with high confidence APPROVE
        senator_configs = [
            {
                'role': 'security',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 85,  # Above threshold of 60
                    'risk_flags': [],
                    'reasoning': 'High confidence security approval'
                }
            },
            {
                'role': 'compliance',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 90,  # Above threshold of 60
                    'risk_flags': [],
                    'reasoning': 'High confidence compliance approval'
                }
            },
            {
                'role': 'operations',
                'response': {
                    'vote': 'APPROVE',
                    'confidence_score': 80,  # Above threshold of 60
                    'risk_flags': [],
                    'reasoning': 'High confidence operations approval'
                }
            }
        ]
        
        orchestrator = self.create_test_orchestrator(senator_configs, min_approve_confidence=60)
        
        request = GovernanceRequest(
            user_prompt="Test high confidence approval",
            transaction_id="test_confidence_high"
        )
        
        verdict = await orchestrator.evaluate_action(request)
        
        # Should process normally with Senate decision
        checks = [
            ("Senate decided", verdict.decision_source == "SENATE"),
            ("Decision is APPROVE", verdict.final_decision == "APPROVE"),
            ("High confidence", verdict.confidence >= 80),
            ("No confidence issues", not any("LOW_CONFIDENCE" in flag for flag in verdict.risk_summary)),
            ("Raw prompt wiped", request.user_prompt == "[WIPED]")
        ]
        
        passed_checks = sum(1 for _, check in checks if check)
        
        for description, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {description}")
        
        return passed_checks == len(checks)
    
    async def test_confidence_threshold_deny_unaffected(self) -> bool:
        """Test that confidence threshold doesn't affect DENY decisions."""
        print("Testing confidence threshold doesn't affect DENY...")
        
        # Configure senators with low confidence DENY (should not trigger threshold)
        senator_configs = [
            {
                'role': 'security',
                'response': {
                    'vote': 'DENY',
                    'confidence_score': 30,  # Low confidence but DENY
                    'risk_flags': ['security_concern'],
                    'reasoning': 'Security concerns identified'
                }
            },
            {
                'role': 'compliance',
                'response': {
                    'vote': 'DENY',
                    'confidence_score': 40,  # Low confidence but DENY
                    'risk_flags': ['compliance_issue'],
                    'reasoning': 'Compliance issues found'
                }
            },
            {
                'role': 'operations',
                'response': {
                    'vote': 'DENY',
                    'confidence_score': 35,  # Low confidence but DENY
                    'risk_flags': [],
                    'reasoning': 'Operational concerns'
                }
            }
        ]
        
        orchestrator = self.create_test_orchestrator(senator_configs, min_approve_confidence=60)
        
        request = GovernanceRequest(
            user_prompt="Test low confidence deny",
            transaction_id="test_confidence_deny"
        )
        
        verdict = await orchestrator.evaluate_action(request)
        
        # Should process normally - confidence threshold only applies to APPROVE
        checks = [
            ("Senate decided", verdict.decision_source == "SENATE"),
            ("Decision is DENY", verdict.final_decision == "DENY"),
            ("No confidence threshold triggered", not any("LOW_CONFIDENCE" in flag for flag in verdict.risk_summary)),
            ("Risk flags preserved", len(verdict.risk_summary) > 0),
            ("Raw prompt wiped", request.user_prompt == "[WIPED]")
        ]
        
        passed_checks = sum(1 for _, check in checks if check)
        
        for description, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {description}")
        
        return passed_checks == len(checks)
    
    async def run_all_hardening_tests(self):
        """Run all hardening feature tests."""
        print("=" * 80)
        print("SENATE HARDENING FEATURES TEST SUITE")
        print("=" * 80)
        
        tests = [
            ("Insufficient Quorum", self.test_quorum_enforcement_insufficient),
            ("Sufficient Quorum", self.test_quorum_enforcement_sufficient),
            ("Low Confidence APPROVE", self.test_confidence_threshold_low),
            ("High Confidence APPROVE", self.test_confidence_threshold_high),
            ("Confidence Threshold - DENY Unaffected", self.test_confidence_threshold_deny_unaffected)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            
            try:
                result = await test_func()
                if result:
                    print(f"✅ {test_name} PASSED")
                    passed += 1
                else:
                    print(f"❌ {test_name} FAILED")
                    failed += 1
            except Exception as e:
                print(f"❌ {test_name} ERROR: {e}")
                failed += 1
        
        # Final results
        print("\n" + "=" * 80)
        print("HARDENING TEST RESULTS")
        print("=" * 80)
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"TOTAL:  {len(tests)}")
        
        if failed == 0:
            print("\n🎉 ALL HARDENING TESTS PASSED")
            print("✅ Quorum enforcement working correctly")
            print("✅ Confidence threshold working correctly")
            print("✅ Safety hardening features validated")
        else:
            print(f"\n⚠️  {failed} HARDENING TESTS FAILED")
        
        return failed == 0


async def main():
    """Run the hardening test suite."""
    test_suite = HardeningTestSuite()
    success = await test_suite.run_all_hardening_tests()
    
    if success:
        print("\n🎯 HARDENING TESTING COMPLETE - ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ HARDENING TESTING FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)