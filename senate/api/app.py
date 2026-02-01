"""
FastAPI application setup for The Senate governance engine.

This module creates and configures the FastAPI application with proper
error handling, logging, and middleware setup.

Requirements: 14.1, 14.5
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import time
from typing import Dict, Any

from senate.utils.logging import setup_logging
from senate.utils.errors import SenateError, ValidationError, ConfigurationError


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Setup logging first
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # Create FastAPI app
    app = FastAPI(
        title="The Senate Governance Engine",
        description="A governance engine that evaluates user actions through multi-stage LLM decision process",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add request timing middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
    
    # Global exception handlers
    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        logger.warning(f"Validation error: {exc.message}")
        return JSONResponse(
            status_code=400,
            content={"error": "Validation Error", "message": exc.message}
        )
    
    @app.exception_handler(ConfigurationError)
    async def configuration_error_handler(request: Request, exc: ConfigurationError):
        logger.error(f"Configuration error: {exc.message}")
        return JSONResponse(
            status_code=500,
            content={"error": "Configuration Error", "message": "Internal server configuration error"}
        )
    
    @app.exception_handler(SenateError)
    async def senate_error_handler(request: Request, exc: SenateError):
        logger.error(f"Senate error: {exc.message}")
        return JSONResponse(
            status_code=500,
            content={"error": "Senate Error", "message": "Internal governance engine error"}
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "HTTP Error", "message": exc.detail}
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": "An unexpected error occurred"}
        )
    
    # Health check endpoint
    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        """
        Health check endpoint for monitoring.
        
        Requirements: 14.5
        """
        return {
            "status": "healthy",
            "service": "the-senate",
            "version": "0.1.0",
            "timestamp": time.time()
        }
    
    # Status endpoint with more detailed information
    @app.get("/status")
    async def status_check() -> Dict[str, Any]:
        """
        Detailed status endpoint for monitoring and diagnostics.
        
        Requirements: 14.5
        """
        return {
            "status": "operational",
            "service": "the-senate",
            "version": "0.1.0",
            "components": {
                "api": "healthy",
                "governance_engine": "healthy",
                "audit_system": "healthy"
            },
            "timestamp": time.time()
        }
    
    # Import and include governance routes
    try:
        from senate.api.routes import governance_router, veto_router, audit_router
        
        app.include_router(governance_router, prefix="/api/v1")
        app.include_router(veto_router, prefix="/api/v1")
        app.include_router(audit_router, prefix="/api/v1")
        
        logger.info("API routes registered successfully")
    except Exception as e:
        logger.error(f"Failed to register API routes: {e}")
        # Continue without routes for basic health checks
    
    logger.info("The Senate FastAPI application created successfully")
    return app


# Create the app instance
app = create_app()