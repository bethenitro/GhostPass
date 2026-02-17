"""
Main entry point for The Senate governance engine.

This module provides the main entry point for running The Senate as a
standalone service using uvicorn.
"""

import uvicorn
import logging
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from api.app import app
    from utils.logging import setup_logging
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    sys.exit(1)


def main():
    """Main entry point for The Senate governance engine."""
    # Setup logging
    setup_logging()
    logger = logging.getLogger("senate.main")
    
    logger.info("Starting The Senate Governance Engine")
    
    # Get environment configuration
    environment = os.getenv("ENVIRONMENT", "development")
    reload = environment == "development"
    
    # Run the FastAPI application
    uvicorn.run(
        "api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=reload,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )


if __name__ == "__main__":
    main()