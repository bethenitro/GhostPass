"""
Main entry point for The Senate governance engine.

This module provides the main entry point for running The Senate as a
standalone service using uvicorn.

Run from the parent directory: python -m senate.main
"""

import uvicorn
import logging
import sys
import os

# Add current directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

try:
    from senate.api.app import app
    from senate.utils.logging import setup_logging
except ImportError as e:
    print(f"Import error: {e}")
    print("Please run from the parent directory using: python -m senate.main")
    sys.exit(1)


def main():
    """Main entry point for The Senate governance engine."""
    # Setup logging
    setup_logging()
    logger = logging.getLogger("senate.main")
    
    logger.info("Starting The Senate Governance Engine")
    
    # Run the FastAPI application
    uvicorn.run(
        "senate.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Set to False in production
        log_level="info"
    )


if __name__ == "__main__":
    main()