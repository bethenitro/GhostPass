#!/usr/bin/env python3
"""
Simple startup script for The Senate governance engine.

This script properly sets up the Python path and starts the Senate server.
Run this from the project root directory.
"""

import sys
import os
import uvicorn
import logging

# Add the current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Now we can import senate modules
try:
    from senate.api.app import app
    from senate.utils.logging import setup_logging
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running this from the project root directory.")
    sys.exit(1)


def main():
    """Main entry point for The Senate governance engine."""
    # Setup logging
    setup_logging()
    logger = logging.getLogger("senate.main")
    
    logger.info("Starting The Senate Governance Engine")
    
    # Run the FastAPI application
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to True for development
        log_level="info"
    )


if __name__ == "__main__":
    main()