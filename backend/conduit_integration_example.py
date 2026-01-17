"""
Integration Example: How External Systems Use the Conduit

This demonstrates how external sensor systems would integrate with the Conduit.
"""

import requests
from datetime import datetime
from scu import SensoryCargonUnit, SensoryCapsule, SensoryType


class ExternalSensorSystem:
    """
    Example external system that sends sensory signals to the Conduit.
    
    This could be:
    - A camera system sending vision data
    - An audio monitoring system sending hearing data
    - A pressure sensor array sending touch data
    - etc.
    """
    
    def __init__(self, system_id: str, conduit_url: str = "http://localhost:8000"):
        self.system_id = system_id
        self.conduit_url = conduit_url
    
    def send_single_signal(self, sensory_type: SensoryType, signal_data: dict) -> dict:
        """
        Send a single sensory signal to the Conduit.
        
        Args:
            sensory_type: Type of sensory signal
            signal_data: The actual signal information
            
        Returns:
            dict: Response from Conduit
        """
        # Create SCU with automatic integrity hash
        scu = SensoryCargonUnit.create(
            sensory_type=sensory_type,
            signal_data=signal_data,
            source_id=self.system_id
        )
        
        # Send to Conduit
        response = requests.post(
            f"{self.conduit_url}/conduit/receive",
            json=scu.to_dict()
        )
        
        return response.json()
    
    def send_multiple_signals(self, signals: list[tuple[SensoryType, dict]]) -> dict:
        """
        Send multiple sensory signals as a Sensory Capsule.
        
        Args:
            signals: List of (sensory_type, signal_data) tuples
            
        Returns:
            dict: Response from Conduit
        """
        # Create SCUs for each signal
        scus = [
            SensoryCargonUnit.create(
                sensory_type=sensory_type,
                signal_data=signal_data,
                source_id=self.system_id
            )
            for sensory_type, signal_data in signals
        ]
        
        # Create Sensory Capsule
        capsule = SensoryCapsule(
            capsule_id=f"{self.system_id}_{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow(),
            source_id=self.system_id,
            scus=scus
        )
        
        # Send to Conduit
        response = requests.post(
            f"{self.conduit_url}/conduit/receive",
            json=capsule.to_dict()
        )
        
        return response.json()


# Example 1: Camera System
def example_camera_system():
    """Example: Camera system sending vision data"""
    print("=" * 60)
    print("EXAMPLE 1: Camera System")
    print("=" * 60)
    
    camera = ExternalSensorSystem(system_id="camera_street_01")
    
    # Detect objects in scene
    vision_data = {
        "objects_detected": ["person", "vehicle", "traffic_light"],
        "confidence_scores": [0.95, 0.87, 0.92],
        "spatial_layout": {
            "person": {"x": 120, "y": 340, "width": 80, "height": 200},
            "vehicle": {"x": 450, "y": 280, "width": 150, "height": 100}
        },
        "scene_classification": "urban_street",
        "lighting_conditions": "daylight"
    }
    
    result = camera.send_single_signal(SensoryType.VISION, vision_data)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Forwarded to: {result['forwarding']['destination']}")
    print()


# Example 2: Audio Monitoring System
def example_audio_system():
    """Example: Audio system sending hearing data"""
    print("=" * 60)
    print("EXAMPLE 2: Audio Monitoring System")
    print("=" * 60)
    
    audio = ExternalSensorSystem(system_id="microphone_array_02")
    
    # Detect audio pattern
    hearing_data = {
        "audio_pattern": "alert_siren",
        "frequency_range": [800, 1200],
        "temporal_sequence": [
            {"time": 0.0, "amplitude": 0.8},
            {"time": 0.5, "amplitude": 0.3},
            {"time": 1.0, "amplitude": 0.9}
        ],
        "duration_ms": 3000,
        "direction": "north_east"
    }
    
    result = audio.send_single_signal(SensoryType.HEARING, hearing_data)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Forwarded to: {result['forwarding']['destination']}")
    print()


# Example 3: Multi-Sensor Hub
def example_multi_sensor_hub():
    """Example: Multi-sensor hub sending multiple signals at once"""
    print("=" * 60)
    print("EXAMPLE 3: Multi-Sensor Hub (Capsule)")
    print("=" * 60)
    
    hub = ExternalSensorSystem(system_id="sensor_hub_building_a")
    
    # Collect multiple signals
    signals = [
        # Vision: Security camera
        (SensoryType.VISION, {
            "objects": ["person"],
            "location": "entrance",
            "timestamp_local": "2026-01-17T12:00:00"
        }),
        
        # Hearing: Audio sensor
        (SensoryType.HEARING, {
            "audio_pattern": "door_open",
            "volume_db": 65
        }),
        
        # Touch: Pressure sensor
        (SensoryType.TOUCH, {
            "pressure_points": [{"location": "door_handle", "pressure_psi": 12.5}],
            "threshold_exceeded": False
        }),
        
        # Smell: Air quality sensor
        (SensoryType.SMELL, {
            "chemical_signatures": ["CO2"],
            "concentrations_ppm": [420],
            "anomaly_detected": False
        })
    ]
    
    result = hub.send_multiple_signals(signals)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"SCU Count: {result['scu_count']}")
    print(f"Sensory Types: {result['sensory_types']}")
    print(f"Forwarded to: {result['forwarding']['destination']}")
    print()


# Example 4: Industrial Monitoring System
def example_industrial_system():
    """Example: Industrial system monitoring equipment"""
    print("=" * 60)
    print("EXAMPLE 4: Industrial Monitoring System")
    print("=" * 60)
    
    industrial = ExternalSensorSystem(system_id="industrial_monitor_plant_01")
    
    # Monitor equipment with multiple sensors
    signals = [
        # Balance: Vibration sensor
        (SensoryType.BALANCE, {
            "orientation": {"pitch": 0.5, "roll": -0.3, "yaw": 0.1},
            "drift_rate": 0.01,
            "stability_score": 0.98,
            "equipment_id": "turbine_01"
        }),
        
        # Touch: Pressure sensor
        (SensoryType.TOUCH, {
            "pressure_points": [
                {"location": "inlet", "pressure_psi": 145.2},
                {"location": "outlet", "pressure_psi": 138.7}
            ],
            "threshold_exceeded": False,
            "max_threshold": 150.0
        }),
        
        # Smell: Chemical sensor
        (SensoryType.SMELL, {
            "chemical_signatures": ["CO", "NOx", "SO2"],
            "concentrations_ppm": [5.2, 12.1, 3.8],
            "anomaly_detected": False,
            "risk_level": "low"
        }),
        
        # Taste: Quality sensor
        (SensoryType.TASTE, {
            "quality_metrics": {
                "pH": 7.1,
                "conductivity": 450,
                "turbidity": 0.8
            },
            "fitness_score": 0.92,
            "acceptable": True,
            "quality_grade": "A"
        })
    ]
    
    result = industrial.send_multiple_signals(signals)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"SCU Count: {result['scu_count']}")
    print(f"Sensory Types: {result['sensory_types']}")
    print(f"Forwarded to: {result['forwarding']['destination']}")
    print()


# Example 5: Error Handling
def example_error_handling():
    """Example: How to handle errors from the Conduit"""
    print("=" * 60)
    print("EXAMPLE 5: Error Handling")
    print("=" * 60)
    
    system = ExternalSensorSystem(system_id="test_system")
    
    try:
        # This will succeed
        result = system.send_single_signal(
            SensoryType.VISION,
            {"test": "data"}
        )
        print(f"✓ Success: {result['status']}")
        
    except requests.exceptions.HTTPError as e:
        # Handle validation errors
        print(f"✗ Validation Error: {e.response.json()}")
        
    except requests.exceptions.ConnectionError:
        # Handle connection errors
        print("✗ Connection Error: Could not reach Conduit")
        print("  Make sure the API server is running")
    
    print()


if __name__ == "__main__":
    print("\n")
    print("*" * 60)
    print("CONDUIT INTEGRATION EXAMPLES")
    print("*" * 60)
    print("\nThese examples show how external systems integrate with the Conduit.")
    print("\nMake sure the FastAPI server is running:")
    print("  cd backend && uvicorn main:app --reload")
    print("\n")
    
    try:
        example_camera_system()
        example_audio_system()
        example_multi_sensor_hub()
        example_industrial_system()
        example_error_handling()
        
        print("*" * 60)
        print("ALL EXAMPLES COMPLETED")
        print("*" * 60)
        print("\nKey Takeaways:")
        print("1. External systems create SCUs with automatic integrity hashing")
        print("2. Single signals sent as individual SCUs")
        print("3. Multiple signals grouped in Sensory Capsules")
        print("4. Conduit validates and forwards to Ghost Pass")
        print("5. Full audit trail for all received signals")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to API server")
        print("Make sure the server is running on http://localhost:8000")
        print("\nStart the server with:")
        print("  cd backend && uvicorn main:app --reload")
