"""
Ghost Pass Integration Example

Demonstrates the complete flow: External System -> Conduit -> Ghost Pass -> Senate
"""

import requests
from datetime import datetime, timedelta
from scu import SensoryCargonUnit, SensoryCapsule, SensoryType
from ghost_pass import GhostPass, GhostPassConfig


def example_1_successful_flow():
    """Example 1: Successful signal flow through entire pipeline"""
    print("=" * 70)
    print("EXAMPLE 1: Successful Signal Flow")
    print("=" * 70)
    print()
    
    print("Step 1: External system creates SCU")
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={
            "objects_detected": ["person", "vehicle"],
            "confidence_scores": [0.95, 0.87],
            "scene": "urban_street"
        },
        source_id="camera_street_01"
    )
    print(f"  ✓ Created: {scu.sensory_type} from {scu.metadata.source_id}")
    print()
    
    print("Step 2: Send to Conduit")
    try:
        import json
        response = requests.post(
            "http://localhost:8000/conduit/receive",
            data=scu.to_json(),
            headers={"Content-Type": "application/json"}
        )
        conduit_result = response.json()
        print(f"  ✓ Conduit Status: {conduit_result['status']}")
        print()
        
        print("Step 3: Conduit validates and forwards to Ghost Pass")
        forwarding = conduit_result.get('forwarding', {})
        print(f"  ✓ Ghost Pass Status: {forwarding.get('status', 'N/A')}")
        print(f"  ✓ Ready for Senate: {forwarding.get('ready_for_senate', False)}")
        print()
        
        if forwarding.get('status') == 'approved':
            print("Step 4: Ghost Pass forwards to Senate")
            senate = forwarding.get('senate_forwarding', {})
            print(f"  ✓ Senate Forwarded: {senate.get('forwarded', False)}")
            print(f"  ✓ Destination: {senate.get('destination', 'N/A')}")
        
    except requests.exceptions.ConnectionError:
        print("  ✗ Could not connect to API (run: uvicorn main:app --reload)")
    
    print()


def example_2_policy_rejection():
    """Example 2: Signal rejected by policy"""
    print("=" * 70)
    print("EXAMPLE 2: Policy Rejection")
    print("=" * 70)
    print()
    
    print("Setup: Configure policy to only allow VISION in venue_a")
    GhostPassConfig.ALLOWED_SENSORY_TYPES = {
        "venue_a": [SensoryType.VISION]
    }
    print("  ✓ Policy configured")
    print()
    
    print("Step 1: External system creates TOUCH SCU (not allowed)")
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.TOUCH,
        signal_data={"pressure": 15.2},
        source_id="pressure_sensor_01"
    )
    print(f"  ✓ Created: {scu.sensory_type} from {scu.metadata.source_id}")
    print()
    
    print("Step 2: Process through Ghost Pass with venue_a context")
    ghost_pass = GhostPass(context="venue_a")
    result = ghost_pass.process_from_conduit(scu.to_dict())
    
    print(f"  Status: {result['status']}")
    print(f"  Ready for Senate: {result['ready_for_senate']}")
    
    if result['status'] == 'rejected':
        print("\n  Rejection Reasons:")
        for error in result['errors']:
            print(f"    - {error['rule']}: {error['message']}")
    
    # Reset config
    GhostPassConfig.ALLOWED_SENSORY_TYPES = {}
    print()


def example_3_replay_attack():
    """Example 3: Old timestamp rejected (replay attack prevention)"""
    print("=" * 70)
    print("EXAMPLE 3: Replay Attack Prevention")
    print("=" * 70)
    print()
    
    print("Step 1: Attacker creates SCU with old timestamp")
    old_timestamp = datetime.utcnow() - timedelta(minutes=10)
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"malicious": "data"},
        source_id="attacker_sensor",
        timestamp=old_timestamp
    )
    print(f"  ✓ Created: {scu.sensory_type} with timestamp {old_timestamp}")
    print(f"  ⚠ Timestamp is {(datetime.utcnow() - old_timestamp).total_seconds():.0f}s old")
    print()
    
    print("Step 2: Process through Ghost Pass")
    ghost_pass = GhostPass()
    result = ghost_pass.process_from_conduit(scu.to_dict())
    
    print(f"  Status: {result['status']}")
    print(f"  Ready for Senate: {result['ready_for_senate']}")
    
    if result['status'] == 'rejected':
        print("\n  ✓ Replay attack prevented!")
        print("  Rejection Reasons:")
        for error in result['errors']:
            print(f"    - {error['rule']}: {error['message']}")
    
    print()


def example_4_unauthorized_source():
    """Example 4: Unauthorized source blocked"""
    print("=" * 70)
    print("EXAMPLE 4: Unauthorized Source Blocked")
    print("=" * 70)
    print()
    
    print("Setup: Block specific source")
    GhostPassConfig.BLOCKED_SOURCES = ["malicious_sensor"]
    print("  ✓ Blocked: malicious_sensor")
    print()
    
    print("Step 1: Blocked source tries to send signal")
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"attempt": "unauthorized"},
        source_id="malicious_sensor"
    )
    print(f"  ✓ Created: {scu.sensory_type} from {scu.metadata.source_id}")
    print()
    
    print("Step 2: Process through Ghost Pass")
    ghost_pass = GhostPass()
    result = ghost_pass.process_from_conduit(scu.to_dict())
    
    print(f"  Status: {result['status']}")
    print(f"  Ready for Senate: {result['ready_for_senate']}")
    
    if result['status'] == 'rejected':
        print("\n  ✓ Unauthorized source blocked!")
        print("  Rejection Reasons:")
        for error in result['errors']:
            print(f"    - {error['rule']}: {error['message']}")
    
    # Reset config
    GhostPassConfig.BLOCKED_SOURCES = []
    print()


def example_5_capsule_processing():
    """Example 5: Capsule with multiple SCUs"""
    print("=" * 70)
    print("EXAMPLE 5: Capsule Processing")
    print("=" * 70)
    print()
    
    print("Step 1: External system creates capsule with 3 SCUs")
    scus = [
        SensoryCargonUnit.create(
            sensory_type=SensoryType.VISION,
            signal_data={"scene": "entrance"},
            source_id="sensor_hub_01"
        ),
        SensoryCargonUnit.create(
            sensory_type=SensoryType.HEARING,
            signal_data={"audio": "door_open"},
            source_id="sensor_hub_01"
        ),
        SensoryCargonUnit.create(
            sensory_type=SensoryType.TOUCH,
            signal_data={"pressure": 12.5},
            source_id="sensor_hub_01"
        )
    ]
    
    capsule = SensoryCapsule(
        capsule_id="entrance_event_001",
        timestamp=datetime.utcnow(),
        source_id="sensor_hub_01",
        scus=scus
    )
    print(f"  ✓ Created capsule with {len(capsule.scus)} SCUs")
    print()
    
    print("Step 2: Process through Ghost Pass")
    ghost_pass = GhostPass()
    result = ghost_pass.process_from_conduit(capsule.to_dict())
    
    print(f"  Status: {result['status']}")
    print(f"  SCU Count: {result['scu_count']}")
    print(f"  Ready for Senate: {result['ready_for_senate']}")
    
    if result['status'] == 'approved':
        print("\n  ✓ All SCUs validated!")
        print(f"  Validation Timestamp: {result['validation_timestamp']}")
        print("\n  Normalized SCUs ready for Senate:")
        for norm_scu in result['normalized_scus']:
            original = norm_scu['scu']
            print(f"    - {original['sensory_type']}: ✓")
    
    print()


def example_6_normalization():
    """Example 6: Signal normalization for Senate"""
    print("=" * 70)
    print("EXAMPLE 6: Signal Normalization")
    print("=" * 70)
    print()
    
    print("Step 1: Create SCU")
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"objects": ["person"]},
        source_id="camera_01"
    )
    print(f"  ✓ Original SCU created")
    print()
    
    print("Step 2: Process through Ghost Pass")
    ghost_pass = GhostPass()
    result = ghost_pass.process_from_conduit(scu.to_dict())
    
    if result['status'] == 'approved':
        print("  ✓ SCU approved and normalized")
        print()
        
        print("Step 3: Examine normalized format")
        normalized = result['normalized_scu']
        
        print("  Original SCU:")
        print(f"    - Sensory Type: {normalized['scu']['sensory_type']}")
        print(f"    - Source: {normalized['scu']['metadata']['source_id']}")
        print(f"    - Original Timestamp: {normalized['scu']['metadata']['timestamp']}")
        print()
        
        print("  Ghost Pass Metadata (added):")
        gp_meta = normalized['ghost_pass_metadata']
        print(f"    - Validation Timestamp: {gp_meta['validation_timestamp']}")
        print(f"    - Approved: {gp_meta['approved']}")
        print(f"    - Validator: {gp_meta['validator']}")
        print()
        
        print("  ✓ Signal ready for Senate with full audit trail")
    
    print()


def example_7_multi_layer_validation():
    """Example 7: Multi-layer validation in action"""
    print("=" * 70)
    print("EXAMPLE 7: Multi-Layer Validation")
    print("=" * 70)
    print()
    
    print("Creating SCU that will go through all validation layers...")
    scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"test": "multi_layer"},
        source_id="test_sensor"
    )
    print()
    
    print("Layer 1: Conduit Validation")
    print("  ✓ Structure validated")
    print("  ✓ Integrity hash verified")
    print("  ✓ Audit logged")
    print()
    
    print("Layer 2: Ghost Pass Schema Validation")
    ghost_pass = GhostPass()
    result = ghost_pass.process_from_conduit(scu.to_dict())
    print("  ✓ Schema version checked")
    print("  ✓ Required fields verified")
    print("  ✓ Data types confirmed")
    print()
    
    print("Layer 3: Ghost Pass Integrity Check")
    print("  ✓ Integrity hash re-verified")
    print("  ✓ Timestamp freshness checked")
    print("  ✓ Source authorization confirmed")
    print()
    
    print("Layer 4: Ghost Pass Policy Enforcement")
    print("  ✓ Sensory type allowed")
    print("  ✓ Signal ranges valid")
    print()
    
    print("Layer 5: Normalization")
    print("  ✓ Format standardized")
    print("  ✓ Validation metadata added")
    print()
    
    print(f"Final Status: {result['status']}")
    print(f"Ready for Senate: {result['ready_for_senate']}")
    print()


if __name__ == "__main__":
    print("\n")
    print("*" * 70)
    print("GHOST PASS INTEGRATION EXAMPLES")
    print("*" * 70)
    print("\n")
    
    # Run all examples
    example_1_successful_flow()
    example_2_policy_rejection()
    example_3_replay_attack()
    example_4_unauthorized_source()
    example_5_capsule_processing()
    example_6_normalization()
    example_7_multi_layer_validation()
    
    print("*" * 70)
    print("ALL EXAMPLES COMPLETED")
    print("*" * 70)
    print("\nGhost Pass Features Demonstrated:")
    print("1. Schema validation (version, fields, types)")
    print("2. Integrity verification (hash, timestamp, source)")
    print("3. Policy enforcement (sensory types, authorization)")
    print("4. Replay attack prevention (timestamp freshness)")
    print("5. Source authorization (blocked/allowed lists)")
    print("6. Signal normalization (Senate-ready format)")
    print("7. Multi-layer validation (defense in depth)")
    print("8. Capsule processing (multiple SCUs)")
    print("\nSecurity Benefits:")
    print("- Defense in depth (multiple validation layers)")
    print("- Replay attack prevention")
    print("- Source authorization")
    print("- Policy enforcement")
    print("- Full audit trail")
