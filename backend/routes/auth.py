from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from database import get_db
from pydantic import BaseModel
from typing import Optional
import logging
import jwt
import os
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()

# Request/Response models
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: Optional[str] = None

# JWT Secret from environment
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Client = Depends(get_db)
):
    """Extract and validate user from Bearer token - PROXY AUTHENTICATION"""
    token = credentials.credentials
    
    try:
        # Verify token with Supabase (FastAPI acts as proxy)
        user_response = db.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Ensure user exists in our users table
        user = user_response.user
        db.table("users").upsert({
            "id": user.id,
            "email": user.email
        }, on_conflict="id").execute()
        
        return user
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: Client = Depends(get_db)
):
    """
    PROXY LOGIN: Frontend -> FastAPI -> Supabase
    Frontend never touches Supabase directly
    """
    try:
        # Use Supabase auth through FastAPI proxy
        auth_response = db.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user = auth_response.user
        session = auth_response.session
        
        # Ensure user exists in our users table
        db.table("users").upsert({
            "id": user.id,
            "email": user.email
        }, on_conflict="id").execute()
        
        return AuthResponse(
            access_token=session.access_token,
            user={
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
        )
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        if "Invalid login credentials" in str(e):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    db: Client = Depends(get_db)
):
    """
    PROXY REGISTRATION: Frontend -> FastAPI -> Supabase
    Frontend never touches Supabase directly
    """
    try:
        # Use Supabase auth through FastAPI proxy
        auth_response = db.auth.sign_up({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        user = auth_response.user
        session = auth_response.session
        
        # Create user record in our database
        db.table("users").upsert({
            "id": user.id,
            "email": user.email
        }, on_conflict="id").execute()
        
        # If email confirmation is required, session might be None
        if not session:
            raise HTTPException(
                status_code=201, 
                detail="Registration successful. Please check your email for confirmation."
            )
        
        return AuthResponse(
            access_token=session.access_token,
            user={
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
        )
        
    except Exception as e:
        logger.error(f"Registration error: {e}")
        error_msg = str(e).lower()
        if "email address" in error_msg and "invalid" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid email address format")
        elif "already registered" in error_msg:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        elif "password" in error_msg:
            raise HTTPException(status_code=400, detail="Password does not meet requirements")
        else:
            raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/logout")
async def logout(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    PROXY LOGOUT: Invalidate session through Supabase
    """
    try:
        # Sign out from Supabase
        db.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"Logout error: {e}")
        # Even if logout fails, return success (client should clear token)
        return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user=Depends(get_current_user)
):
    """
    Get current user information - PROXY PATTERN
    """
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at.isoformat() if user.created_at else None
    )

@router.post("/refresh")
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Client = Depends(get_db)
):
    """
    Refresh access token through Supabase proxy
    """
    try:
        # Get current session
        user_response = db.auth.get_user(credentials.credentials)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Refresh session
        refresh_response = db.auth.refresh_session()
        if not refresh_response.session:
            raise HTTPException(status_code=401, detail="Token refresh failed")
        
        return {
            "access_token": refresh_response.session.access_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=401, detail="Token refresh failed")