"""
Logging configuration for The Senate governance engine.

Provides structured logging setup with appropriate levels and formatting
for governance operations, audit trails, and system monitoring.
"""

import logging
import logging.config
import sys
from typing import Dict, Any


def setup_logging(level: str = "INFO") -> None:
    """
    Setup logging configuration for The Senate.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    
    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "detailed": {
                "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "audit": {
                "format": "%(asctime)s [AUDIT] %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": level,
                "formatter": "standard",
                "stream": sys.stdout
            },
            "audit": {
                "class": "logging.StreamHandler", 
                "level": "INFO",
                "formatter": "audit",
                "stream": sys.stdout
            }
        },
        "loggers": {
            "senate": {
                "level": level,
                "handlers": ["console"],
                "propagate": False
            },
            "senate.audit": {
                "level": "INFO",
                "handlers": ["audit"],
                "propagate": False
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False
            },
            "fastapi": {
                "level": "INFO", 
                "handlers": ["console"],
                "propagate": False
            }
        },
        "root": {
            "level": level,
            "handlers": ["console"]
        }
    }
    
    logging.config.dictConfig(logging_config)
    
    # Log startup message
    logger = logging.getLogger("senate")
    logger.info("The Senate logging system initialized")


def get_audit_logger() -> logging.Logger:
    """Get the dedicated audit logger."""
    return logging.getLogger("senate.audit")


def get_logger(name: str) -> logging.Logger:
    """Get a logger for the specified module."""
    return logging.getLogger(f"senate.{name}")