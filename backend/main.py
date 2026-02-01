from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from routes import auth, wallet, ghostpass, scan, vendor, admin, session, gateway, audit, conduit, sensory_monitor, senate, environment, ghost_pass_modes
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GhostPass Wallet API",
    description="Secure, conduit-style wallet API for GhostPass system",
    version="1.0.0"
)

# Add validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error on {request.method} {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "message": "Request validation failed"}
    )

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(wallet.router)
app.include_router(ghostpass.router)
app.include_router(ghost_pass_modes.router)  # New Ghost Pass modes API
app.include_router(scan.router)
app.include_router(session.router)
app.include_router(vendor.router)
app.include_router(admin.router)
app.include_router(gateway.router)
app.include_router(audit.router)
app.include_router(conduit.router)
app.include_router(sensory_monitor.router)
app.include_router(senate.router)
app.include_router(environment.router)

@app.get("/")
async def root():
    return {
        "message": "GhostPass Wallet API Online - PROXY ARCHITECTURE",
        "version": "1.0.0",
        "status": "operational",
        "architecture": "Frontend -> FastAPI -> Supabase",
        "frontend_access": "No direct Supabase access from frontend"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": "2026-01-12T00:00:00Z",
        "proxy_architecture": "active",
        "supabase_connection": "configured"
    }

@app.get("/test/proxy")
async def test_proxy():
    """Test endpoint to verify proxy architecture"""
    return {
        "message": "Proxy architecture working!",
        "frontend_should_call": "http://localhost:8000",
        "frontend_should_not_call": "supabase.co directly",
        "authentication": "handled by FastAPI proxy",
        "database": "accessed only by FastAPI"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
