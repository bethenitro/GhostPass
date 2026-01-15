from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from database import get_db
from routes.auth import get_current_user
from models import SessionCreateRequest, SessionStatusResponse, Session, SessionType
from utils import parse_supabase_timestamp
from typing import Optional
import logging
import uuid
from datetime import datetime, timedelta

router = APIRouter(prefix="/session", tags=["Session"])
logger = logging.getLogger(__name__)

# Session durations in seconds
SESSION_DURATIONS = {
    SessionType.THIRTY_SECONDS: 30,
    SessionType.THREE_MINUTES: 180,  # 3 * 60
    SessionType.TEN_MINUTES: 600,    # 10 * 60
}

@router.post("/create", response_model=SessionStatusResponse)
def create_session(
    req: SessionCreateRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Create a new GHOSTPASS SESSION with immediate vaporization"""
    try:
        logger.info(f"Creating session for user {user.id}, type: {req.session_type}")

        # Check if user has an active session (only one session allowed at a time)
        active_session_response = db.table("sessions")\
            .select("*")\
            .eq("user_id", str(user.id))\
            .eq("status", "ACTIVE")\
            .execute()

        if active_session_response.data:
            active_session = active_session_response.data[0]
            vaporizes_at = parse_supabase_timestamp(active_session['vaporizes_at'])
            if vaporizes_at > datetime.now(vaporizes_at.tzinfo):
                return SessionStatusResponse(
                    session=Session(**active_session),
                    can_create=False,
                    message="You already have an active session. Wait for it to vaporize."
                )

        # Vaporize any expired sessions first (RPC call with empty params)
        try:
            result = db.rpc("vaporize_expired_sessions", {}).execute()
            # The RPC function returns an integer count directly
            if result and hasattr(result, 'data') and result.data is not None:
                vaporized_count = result.data
                logger.info(f"Vaporized {vaporized_count} expired sessions")
        except Exception as e:
            # Log the error but continue - vaporization is not critical for session creation
            logger.debug(f"Vaporize function call had an issue: {e}")

        # Get session duration
        duration_seconds = SESSION_DURATIONS[req.session_type]

        # Create session
        session_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        vaporizes_at = created_at + timedelta(seconds=duration_seconds)

        session_data = {
            "id": session_id,
            "user_id": str(user.id),
            "session_type": req.session_type,
            "status": "ACTIVE",
            "created_at": created_at.isoformat(),
            "vaporizes_at": vaporizes_at.isoformat(),
            "qr_code": f"ghostsession:{session_id}"
        }

        # Insert session
        db.table("sessions").insert(session_data).execute()

        logger.info(f"Session created: {session_id}, vaporizes at: {vaporizes_at}")

        return SessionStatusResponse(
            session=Session(**session_data),
            can_create=True,
            message=f"Session created. Vaporizes in {duration_seconds} seconds."
        )

    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")

@router.get("/status", response_model=SessionStatusResponse)
def get_session_status(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get current session status for user"""
    try:
        # Vaporize any expired sessions first (RPC call with empty params)
        try:
            result = db.rpc("vaporize_expired_sessions", {}).execute()
            # The RPC function returns an integer count directly
            if result and hasattr(result, 'data') and result.data is not None:
                vaporized_count = result.data
                logger.info(f"Vaporized {vaporized_count} expired sessions")
        except Exception as e:
            # Log the error but continue - vaporization is not critical for status check
            logger.debug(f"Vaporize function call had an issue: {e}")

        # Get active session
        session_response = db.table("sessions")\
            .select("*")\
            .eq("user_id", str(user.id))\
            .eq("status", "ACTIVE")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()

        if session_response.data:
            session = session_response.data[0]
            vaporizes_at = parse_supabase_timestamp(session['vaporizes_at'])

            if vaporizes_at > datetime.now(vaporizes_at.tzinfo):
                return SessionStatusResponse(
                    session=Session(**session),
                    can_create=False,
                    message="Active session found"
                )

        # No active session
        return SessionStatusResponse(
            session=None,
            can_create=True,
            message="No active session. Ready to create one."
        )

    except Exception as e:
        logger.error(f"Session status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get session status")

@router.delete("/vaporize")
def vaporize_session(
    user=Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Manually vaporize current session (for testing/emergency)"""
    try:
        # Update active session to vaporized
        update_result = db.table("sessions")\
            .update({"status": "VAPORIZED"})\
            .eq("user_id", str(user.id))\
            .eq("status", "ACTIVE")\
            .execute()

        return {"message": f"Vaporized {len(update_result.data) if update_result.data else 0} sessions"}

    except Exception as e:
        logger.error(f"Session vaporization error: {e}")
        raise HTTPException(status_code=500, detail="Failed to vaporize session")