"""
Environment Configuration API

Provides endpoints for environment mode and Sensory Type status.
"""

from fastapi import APIRouter
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/environment",
    tags=["environment"],
    responses={404: {"description": "Not found"}}
)


@router.get("/mode")
async def get_environment_mode():
    """
    Get current environment mode.
    
    Returns:
        dict: Environment mode and configuration
    """
    from environment_config import environment_config
    
    return {
        "environment_mode": environment_config.mode.value,
        "is_sandbox": environment_config.is_sandbox,
        "is_production": environment_config.is_production,
        "description": {
            "sandbox": "Demos, internal testing, vendor walkthroughs - full observability, zero friction",
            "production": "Real deployments (airport, venue, government) - policy-enforced locking"
        }
    }


@router.get("/sensory-types")
async def get_sensory_types():
    """
    Get status for all 6 Sensory Types based on environment mode.
    
    LANGUAGE CONTRACT:
    - Always returns exactly 6 Sensory Types (fixed count)
    - Each represents a conceptual channel, not signal count
    - UI must display as "TOUCH channel" not "touch sensories"
    
    Returns:
        dict: Status for all Sensory Types
    """
    from environment_config import environment_config
    
    types = environment_config.get_all_sensory_types()
    
    return {
        "environment_mode": environment_config.mode.value,
        "sensory_types": types,
        "total_types": 6,  # Always 6, never dynamic
        "language_note": "Each type represents a Sensory Type. SCUs belong to types."
    }


@router.get("/sensory-types/{sensory_type}")
async def get_sensory_type_status(sensory_type: str):
    """
    Get detailed status for a specific Sensory Type.
    
    Args:
        sensory_type: One of VISION, HEARING, TOUCH, BALANCE, SMELL, TASTE
        
    Returns:
        dict: Detailed Sensory Type status
    """
    from environment_config import environment_config
    
    sensory_type = sensory_type.upper()
    status = environment_config.get_sensory_type_status(sensory_type)
    
    return {
        "environment_mode": environment_config.mode.value,
        "type_status": status,
        "behavior": {
            "sandbox": "Always available (authority bypassed for demos)",
            "production": "Locked only if authority required and no token present"
        }
    }


@router.get("/authority-policies")
async def get_authority_policies():
    """
    Get authority policies for all Sensory Types.
    
    Returns:
        dict: Authority requirements by Sensory Type
    """
    from environment_config import environment_config
    
    types = environment_config.get_all_sensory_types()
    
    policies = {}
    for sensory_type, status in types.items():
        policies[sensory_type] = {
            "authority_required": status["authority_required"],
            "locked_in_production": status["locked"] if not environment_config.is_sandbox else False,
            "bypassed_in_sandbox": status.get("authority_bypassed", False)
        }
    
    return {
        "environment_mode": environment_config.mode.value,
        "authority_policies": policies,
        "rules": {
            "sandbox": "Authority may be displayed but must NOT block",
            "production": "Locking applies only if authority required AND no token"
        }
    }