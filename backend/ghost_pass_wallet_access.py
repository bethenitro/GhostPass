"""
Ghost Pass Wallet Access Management

Implements automatic wallet surfacing, PWA behavior, and persistent session handling
for zero-friction access in intoxicated, crowded, low-light conditions.
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class WalletAccessMode(Enum):
    """Wallet access modes"""
    FIRST_TIME = "first_time"
    RETURNING = "returning"
    FORCED_SURFACE = "forced_surface"


@dataclass
class WalletSession:
    """Persistent wallet session for instant access"""
    session_id: str
    wallet_binding_id: str
    device_fingerprint: str
    created_at: datetime
    last_accessed: datetime
    expires_at: datetime
    event_id: Optional[str] = None
    venue_id: Optional[str] = None
    is_active: bool = True
    force_surface: bool = False


class GhostPassWalletAccess:
    """
    Manages Ghost Pass wallet automatic surfacing and persistent access.
    
    REQUIREMENTS IMPLEMENTED:
    - Automatic wallet appearance after first successful scan
    - PWA add-to-home-screen flow
    - Persistent session handle for instant reopening
    - Brightness takeover for QR scanning
    - Zero friction for intoxicated, crowded, low-light conditions
    """
    
    def __init__(self):
        self.active_sessions: Dict[str, WalletSession] = {}
    
    def create_wallet_session(
        self, 
        wallet_binding_id: str, 
        device_fingerprint: str,
        event_id: Optional[str] = None,
        venue_id: Optional[str] = None,
        duration_hours: int = 24
    ) -> WalletSession:
        """
        Create persistent wallet session for instant access.
        
        Args:
            wallet_binding_id: User's wallet binding ID
            device_fingerprint: Device fingerprint for security
            event_id: Optional event ID for event-specific sessions
            venue_id: Optional venue ID for venue-specific sessions
            duration_hours: Session duration (default: 24 hours)
            
        Returns:
            WalletSession: Created session
        """
        session_id = f"gp_session_{wallet_binding_id}_{int(datetime.utcnow().timestamp())}"
        
        session = WalletSession(
            session_id=session_id,
            wallet_binding_id=wallet_binding_id,
            device_fingerprint=device_fingerprint,
            created_at=datetime.utcnow(),
            last_accessed=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours),
            event_id=event_id,
            venue_id=venue_id,
            is_active=True,
            force_surface=True  # Force surface on first creation
        )
        
        self.active_sessions[session_id] = session
        
        logger.info(f"Created wallet session {session_id} for wallet {wallet_binding_id}")
        return session
    
    def get_wallet_session(self, session_id: str) -> Optional[WalletSession]:
        """Get wallet session by ID"""
        session = self.active_sessions.get(session_id)
        
        if session and session.expires_at > datetime.utcnow():
            # Update last accessed
            session.last_accessed = datetime.utcnow()
            return session
        elif session:
            # Session expired
            self.deactivate_session(session_id)
            
        return None
    
    def find_active_session(
        self, 
        wallet_binding_id: str, 
        device_fingerprint: str
    ) -> Optional[WalletSession]:
        """Find active session for wallet and device"""
        for session in self.active_sessions.values():
            if (session.wallet_binding_id == wallet_binding_id and 
                session.device_fingerprint == device_fingerprint and
                session.is_active and 
                session.expires_at > datetime.utcnow()):
                
                session.last_accessed = datetime.utcnow()
                return session
        
        return None
    
    def deactivate_session(self, session_id: str) -> bool:
        """Deactivate wallet session"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id].is_active = False
            logger.info(f"Deactivated wallet session {session_id}")
            return True
        return False
    
    def generate_pwa_manifest(
        self, 
        session: WalletSession,
        event_name: str = "Event",
        venue_name: str = "Venue"
    ) -> Dict[str, Any]:
        """
        Generate PWA manifest for add-to-home-screen flow.
        
        Args:
            session: Wallet session
            event_name: Event name for display
            venue_name: Venue name for display
            
        Returns:
            Dict: PWA manifest
        """
        return {
            "name": f"{event_name} - Ghost Pass Wallet",
            "short_name": "Ghost Pass",
            "description": f"Your wallet for {event_name} at {venue_name}",
            "start_url": f"/wallet?session={session.session_id}",
            "display": "standalone",
            "background_color": "#000000",
            "theme_color": "#000000",
            "orientation": "portrait",
            "scope": "/",
            "icons": [
                {
                    "src": "/icons/ghost-pass-192.png",
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any maskable"
                },
                {
                    "src": "/icons/ghost-pass-512.png", 
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any maskable"
                }
            ],
            "categories": ["finance", "utilities"],
            "lang": "en",
            "dir": "ltr"
        }
    
    def generate_wallet_surface_response(
        self,
        session: WalletSession,
        event_name: str = "Event",
        venue_name: str = "Venue",
        force_install: bool = True
    ) -> Dict[str, Any]:
        """
        Generate wallet surface response with PWA install prompt.
        
        REQUIREMENT: Wallet must surface automatically after first successful scan
        and remain immediately accessible for event duration.
        
        Args:
            session: Wallet session
            event_name: Event name
            venue_name: Venue name  
            force_install: Whether to force PWA install prompt
            
        Returns:
            Dict: Wallet surface response with PWA data
        """
        return {
            "session_id": session.session_id,
            "wallet_binding_id": session.wallet_binding_id,
            "force_surface": session.force_surface,
            "expires_at": session.expires_at.isoformat(),
            "pwa_manifest": self.generate_pwa_manifest(session, event_name, venue_name),
            "install_prompt": {
                "show": force_install and session.force_surface,
                "title": f"Add {event_name} Wallet to Home Screen",
                "message": "Keep your wallet instantly accessible throughout the event",
                "install_button_text": "Add to Home Screen",
                "skip_button_text": "Not Now"
            },
            "brightness_control": {
                "enabled": True,
                "qr_brightness_level": 100,  # Maximum brightness for QR scanning
                "restore_on_close": True
            },
            "wallet_url": f"/wallet?session={session.session_id}",
            "boarding_pass_mode": True  # Enables boarding pass behavior
        }
    
    def create_brightness_control_config(self) -> Dict[str, Any]:
        """
        Create brightness control configuration for QR scanning.
        
        REQUIREMENT: Ghost pass QR code must take over brightness of phone 
        when accessed for proper low light scanning environments.
        
        Returns:
            Dict: Brightness control configuration
        """
        return {
            "qr_scan_brightness": {
                "enabled": True,
                "brightness_level": 100,  # Maximum brightness (0-100)
                "screen_timeout_disabled": True,
                "restore_on_exit": True,
                "flash_enabled": True,  # Enable camera flash if available
                "vibration_feedback": True
            },
            "wallet_display_brightness": {
                "enabled": True,
                "brightness_level": 85,  # High brightness for wallet display
                "auto_adjust": False,
                "restore_on_close": True
            },
            "low_light_optimization": {
                "contrast_boost": True,
                "text_size_increase": 10,  # Percentage increase
                "high_contrast_mode": True
            }
        }
    
    def generate_wallet_access_config(self, session: WalletSession) -> Dict[str, Any]:
        """
        Generate wallet access configuration for frontend.
        
        Args:
            session: Wallet session
            
        Returns:
            Dict: Wallet access configuration
        """
        return {
            "session_id": session.session_id,
            "wallet_binding_id": session.wallet_binding_id,
            "force_surface": session.force_surface,
            "auto_brightness": True,  # Enable brightness takeover for QR scanning
            "persistent_access": True,
            "boarding_pass_behavior": True,
            "zero_friction_mode": True,
            "session_expires_at": session.expires_at.isoformat(),
            "last_accessed": session.last_accessed.isoformat(),
            "pwa_config": {
                "enable_add_to_home": True,
                "force_install_prompt": session.force_surface,
                "standalone_mode": True
            },
            "ui_config": {
                "brightness_takeover": True,
                "low_light_optimization": True,
                "large_touch_targets": True,
                "high_contrast_mode": True
            }
        }
    
    def handle_first_successful_scan(
        self,
        wallet_binding_id: str,
        device_fingerprint: str,
        event_id: Optional[str] = None,
        venue_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle first successful scan - create session and force wallet surface.
        
        Args:
            wallet_binding_id: User's wallet binding ID
            device_fingerprint: Device fingerprint
            event_id: Optional event ID
            venue_id: Optional venue ID
            
        Returns:
            Dict: Wallet access response with forced surface instructions
        """
        # Create persistent session
        session = self.create_wallet_session(
            wallet_binding_id=wallet_binding_id,
            device_fingerprint=device_fingerprint,
            event_id=event_id,
            venue_id=venue_id
        )
        
        # Generate access config
        access_config = self.generate_wallet_access_config(session)
        
        logger.info(f"First successful scan for wallet {wallet_binding_id} - forcing surface")
        
        return {
            "status": "FIRST_SCAN_SUCCESS",
            "message": "Ghost Pass wallet activated - adding to home screen",
            "wallet_access": access_config,
            "force_surface": True,
            "pwa_manifest_url": f"/api/wallet/pwa-manifest/{session.session_id}",
            "instructions": {
                "action": "FORCE_SURFACE_WALLET",
                "method": "PWA_ADD_TO_HOME",
                "brightness_takeover": True,
                "boarding_pass_behavior": True
            }
        }
    
    def handle_returning_access(
        self,
        session_id: str,
        device_fingerprint: str
    ) -> Dict[str, Any]:
        """
        Handle returning wallet access.
        
        Args:
            session_id: Session ID
            device_fingerprint: Device fingerprint for verification
            
        Returns:
            Dict: Wallet access response
        """
        session = self.get_wallet_session(session_id)
        
        if not session:
            return {
                "status": "SESSION_EXPIRED",
                "message": "Wallet session expired - please scan QR code again",
                "force_surface": False
            }
        
        if session.device_fingerprint != device_fingerprint:
            return {
                "status": "DEVICE_MISMATCH", 
                "message": "Device verification failed",
                "force_surface": False
            }
        
        access_config = self.generate_wallet_access_config(session)
        # Don't force surface for returning users
        access_config["force_surface"] = False
        
        return {
            "status": "RETURNING_ACCESS",
            "message": "Welcome back to Ghost Pass wallet",
            "wallet_access": access_config,
            "force_surface": False
        }
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        expired_count = 0
        current_time = datetime.utcnow()
        
        expired_sessions = [
            session_id for session_id, session in self.active_sessions.items()
            if session.expires_at <= current_time
        ]
        
        for session_id in expired_sessions:
            del self.active_sessions[session_id]
            expired_count += 1
        
        if expired_count > 0:
            logger.info(f"Cleaned up {expired_count} expired wallet sessions")
        
        return expired_count


# Global instance
wallet_access_manager = GhostPassWalletAccess()