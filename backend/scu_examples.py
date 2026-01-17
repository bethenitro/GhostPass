"""
Example usage of Sensory Cargo Units (SCUs)

Demonstrates how to create, validate, and work with SCUs.
"""

from datetime import datetime
from scu import SensoryCargonUnit, SensoryType, SCUValidator


def example_vision_scu():
    """Example: Vision SCU with structural/semantic data"""
    vision_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={
            "objects_detected": ["person", "vehicle", "building"],
            "confidence_scores": [0.95, 0.87, 0.92],
            "spatial_layout": {
                "person": {"x": 120, "y": 340, "width": 80, "height": 200},
                "vehicle": {"x": 450, "y": 280, "width": 150, "height": 100}
            },
            "scene_classification": "urban_street"
        },
        source_id="camera_sensor_01"
    )
    
    print("Vision SCU:")
    print(f"  Type: {vision_scu.sensory_type}")
    print(f"  Source: {vision_scu.metadata.source_id}")
    print(f"  Timestamp: {vision_scu.metadata.timestamp}")
    print(f"  Integrity Valid: {vision_scu.verify_integrity()}")
    print()
    
    return vision_scu


def example_hearing_scu():
    """Example: Hearing SCU with temporal/sequence data"""
    hearing_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.HEARING,
        signal_data={
            "audio_pattern": "rhythmic_pulse",
            "frequency_range": [200, 4000],
            "temporal_sequence": [
                {"time": 0.0, "amplitude": 0.8},
                {"time": 0.5, "amplitude": 0.3},
                {"time": 1.0, "amplitude": 0.9}
            ],
            "duration_ms": 1000
        },
        source_id="microphone_array_02"
    )
    
    print("Hearing SCU:")
    print(f"  Type: {hearing_scu.sensory_type}")
    print(f"  Pattern: {hearing_scu.signal_data['audio_pattern']}")
    print(f"  Integrity Valid: {hearing_scu.verify_integrity()}")
    print()
    
    return hearing_scu


def example_touch_scu():
    """Example: Touch SCU with threshold/constraint data"""
    touch_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.TOUCH,
        signal_data={
            "pressure_points": [
                {"location": "surface_a", "pressure_psi": 15.2},
                {"location": "surface_b", "pressure_psi": 8.7}
            ],
            "threshold_exceeded": False,
            "max_threshold": 20.0,
            "contact_area_cm2": 45.3
        },
        source_id="pressure_sensor_grid_03"
    )
    
    print("Touch SCU:")
    print(f"  Type: {touch_scu.sensory_type}")
    print(f"  Threshold Exceeded: {touch_scu.signal_data['threshold_exceeded']}")
    print(f"  Integrity Valid: {touch_scu.verify_integrity()}")
    print()
    
    return touch_scu


def example_balance_scu():
    """Example: Balance SCU with stability/drift data"""
    balance_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.BALANCE,
        signal_data={
            "orientation": {"pitch": 2.3, "roll": -1.1, "yaw": 0.5},
            "drift_rate": 0.02,
            "stability_score": 0.94,
            "reference_point": "center_of_mass"
        },
        source_id="gyroscope_04"
    )
    
    print("Balance SCU:")
    print(f"  Type: {balance_scu.sensory_type}")
    print(f"  Stability: {balance_scu.signal_data['stability_score']}")
    print(f"  Integrity Valid: {balance_scu.verify_integrity()}")
    print()
    
    return balance_scu


def example_smell_scu():
    """Example: Smell SCU with anomaly/risk data"""
    smell_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.SMELL,
        signal_data={
            "chemical_signatures": ["CO2", "CH4", "VOC"],
            "concentrations_ppm": [450, 2.1, 0.8],
            "anomaly_detected": True,
            "risk_level": "medium",
            "baseline_deviation": 2.3
        },
        source_id="chemical_sensor_05"
    )
    
    print("Smell SCU:")
    print(f"  Type: {smell_scu.sensory_type}")
    print(f"  Anomaly: {smell_scu.signal_data['anomaly_detected']}")
    print(f"  Risk: {smell_scu.signal_data['risk_level']}")
    print(f"  Integrity Valid: {smell_scu.verify_integrity()}")
    print()
    
    return smell_scu


def example_taste_scu():
    """Example: Taste SCU with quality/fitness data"""
    taste_scu = SensoryCargonUnit.create(
        sensory_type=SensoryType.TASTE,
        signal_data={
            "quality_metrics": {
                "pH": 7.2,
                "salinity": 0.05,
                "turbidity": 1.2
            },
            "fitness_score": 0.89,
            "acceptable": True,
            "quality_grade": "A"
        },
        source_id="quality_analyzer_06"
    )
    
    print("Taste SCU:")
    print(f"  Type: {taste_scu.sensory_type}")
    print(f"  Quality Grade: {taste_scu.signal_data['quality_grade']}")
    print(f"  Fitness: {taste_scu.signal_data['fitness_score']}")
    print(f"  Integrity Valid: {taste_scu.verify_integrity()}")
    print()
    
    return taste_scu


def example_batch_validation():
    """Example: Validate multiple SCUs at once"""
    print("Batch Validation Example:")
    print("-" * 50)
    
    # Create valid SCUs
    scu1 = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"test": "data1"},
        source_id="sensor_1"
    )
    
    scu2 = SensoryCargonUnit.create(
        sensory_type=SensoryType.HEARING,
        signal_data={"test": "data2"},
        source_id="sensor_2"
    )
    
    # Create invalid SCU (tampered data)
    scu3_dict = scu1.to_dict()
    scu3_dict["signal_data"]["test"] = "tampered"  # Change data without updating hash
    
    # Validate batch
    batch = [scu1.to_dict(), scu2.to_dict(), scu3_dict]
    results = SCUValidator.validate_batch(batch)
    
    print(f"Total SCUs: {results['total']}")
    print(f"Valid: {results['valid']}")
    print(f"Invalid: {results['invalid']}")
    
    if results['errors']:
        print("\nErrors:")
        for error in results['errors']:
            print(f"  SCU {error['index']}: {error['error']}")
    print()


def example_serialization():
    """Example: Convert SCU to/from JSON"""
    print("Serialization Example:")
    print("-" * 50)
    
    # Create SCU
    original = SensoryCargonUnit.create(
        sensory_type=SensoryType.VISION,
        signal_data={"example": "serialization"},
        source_id="test_sensor"
    )
    
    # Convert to JSON
    json_str = original.to_json()
    print(f"JSON length: {len(json_str)} characters")
    
    # Parse back from JSON
    import json
    parsed_dict = json.loads(json_str)
    reconstructed = SensoryCargonUnit(**parsed_dict)
    
    print(f"Original integrity: {original.verify_integrity()}")
    print(f"Reconstructed integrity: {reconstructed.verify_integrity()}")
    print(f"Hashes match: {original.metadata.integrity_hash == reconstructed.metadata.integrity_hash}")
    print()


if __name__ == "__main__":
    print("=" * 50)
    print("SENSORY CARGO UNIT (SCU) EXAMPLES")
    print("=" * 50)
    print()
    
    # Run all examples
    example_vision_scu()
    example_hearing_scu()
    example_touch_scu()
    example_balance_scu()
    example_smell_scu()
    example_taste_scu()
    example_batch_validation()
    example_serialization()
    
    print("=" * 50)
    print("All examples completed successfully!")
    print("=" * 50)
