"""
Ghost Pass Entry Tracking System

Implements comprehensive entry tracking, re-entry permissions, and fee management
for venues with configurable re-entry policies and dual fee structure.
"""

import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
from supabase import Client

logger = logging.getLogger(__name__)


class EntryType(Enum):
    """Entry type classification"""
    INITIAL = "initial"
    RE_ENTRY = "re_entry"


class ReEntryPolicy(Enum):
    """Re-entry policy options"""
    ALLOWED = "allowed"
    NOT_ALLOWED = "not_allowed"


@dataclass
class EntryEvent:
    """Individual entry event record"""
    id: str
    wallet_id: str
    wallet_binding_id: str
    event_id: Optional[str]
    venue_id: str
    entry_number: int
    entry_type: EntryType
    timestamp: datetime
    gateway_id: Optional[str] = None
    gateway_name: Optional[str] = None
    initial_entry_fee_cents: int = 0
    venue_reentry_fee_cents: int = 0
    valid_reentry_scan_fee_cents: int = 0
    total_fees_cents: int = 0
    device_fingerprint: Optional[str] = None
    interaction_method: str = "QR"
    metadata: Dict[str, Any] = None


@dataclass
class VenueEntryConfig:
    """Venue entry configuration"""
    venue_id: str
    event_id: Optional[str]
    re_entry_allowed: bool
    initial_entry_fee_cents: int
    venue_reentry_fee_cents: int = 0
    valid_reentry_scan_fee_cents: int = 0
    max_reentries: Optional[int] = None
    reentry_time_limit_hours: Optional[int] = None
    created_at: datetime = None
    updated_at: datetime = None


class GhostPassEntryTracker:
    """
    Comprehensive entry tracking system for Ghost Pass.
    
    REQUIREMENTS IMPLEMENTED:
    - Entry count tracking per wallet
    - Initial entry fee (unchanged)
    - Re-entry permission configuration (Yes/No)
    - Venue re-entry fee (venue-controlled)
    - VALID re-entry scan fee (platform fee)
    - Complete audit trail of all entries
    - Security and dispute resolution support
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.venue_configs: Dict[str, VenueEntryConfig] = {}
    
    def get_venue_entry_config(
        self, 
        venue_id: str, 
        event_id: Optional[str] = None
    ) -> VenueEntryConfig:
        """
        Get entry configuration for venue/event.
        
        Args:
            venue_id: Venue identifier
            event_id: Optional event identifier
            
        Returns:
            VenueEntryConfig: Entry configuration
        """
        config_key = f"{venue_id}:{event_id or 'default'}"
        
        if config_key in self.venue_configs:
            return self.venue_configs[config_key]
        
        try:
            # Query database for venue entry config
            query = self.db.table("venue_entry_configs").select("*").eq("venue_id", venue_id)
            
            if event_id:
                query = query.eq("event_id", event_id)
            else:
                query = query.is_("event_id", "null")
            
            result = query.execute()
            
            if result.data:
                config_data = result.data[0]
                config = VenueEntryConfig(
                    venue_id=config_data["venue_id"],
                    event_id=config_data.get("event_id"),
                    re_entry_allowed=config_data["re_entry_allowed"],
                    initial_entry_fee_cents=config_data["initial_entry_fee_cents"],
                    venue_reentry_fee_cents=config_data.get("venue_reentry_fee_cents", 0),
                    valid_reentry_scan_fee_cents=config_data.get("valid_reentry_scan_fee_cents", 0),
                    max_reentries=config_data.get("max_reentries"),
                    reentry_time_limit_hours=config_data.get("reentry_time_limit_hours"),
                    created_at=datetime.fromisoformat(config_data["created_at"]),
                    updated_at=datetime.fromisoformat(config_data["updated_at"]) if config_data.get("updated_at") else None
                )
            else:
                # Create default config
                config = VenueEntryConfig(
                    venue_id=venue_id,
                    event_id=event_id,
                    re_entry_allowed=True,  # Default: allow re-entry
                    initial_entry_fee_cents=2500,  # Default: $25.00
                    venue_reentry_fee_cents=1000,  # Default: $10.00
                    valid_reentry_scan_fee_cents=25,  # Default: $0.25
                    created_at=datetime.utcnow()
                )
                
                # Save default config to database
                self.save_venue_entry_config(config)
            
            self.venue_configs[config_key] = config
            return config
            
        except Exception as e:
            logger.error(f"Failed to get venue entry config for {venue_id}: {e}")
            # Return safe default
            return VenueEntryConfig(
                venue_id=venue_id,
                event_id=event_id,
                re_entry_allowed=True,
                initial_entry_fee_cents=2500,
                venue_reentry_fee_cents=1000,
                valid_reentry_scan_fee_cents=25,
                created_at=datetime.utcnow()
            )
    
    def save_venue_entry_config(self, config: VenueEntryConfig) -> bool:
        """Save venue entry configuration to database"""
        try:
            config_data = {
                "venue_id": config.venue_id,
                "event_id": config.event_id,
                "re_entry_allowed": config.re_entry_allowed,
                "initial_entry_fee_cents": config.initial_entry_fee_cents,
                "venue_reentry_fee_cents": config.venue_reentry_fee_cents,
                "valid_reentry_scan_fee_cents": config.valid_reentry_scan_fee_cents,
                "max_reentries": config.max_reentries,
                "reentry_time_limit_hours": config.reentry_time_limit_hours,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if not config.created_at:
                config_data["created_at"] = datetime.utcnow().isoformat()
            
            # Upsert configuration
            self.db.table("venue_entry_configs").upsert(
                config_data,
                on_conflict="venue_id,event_id"
            ).execute()
            
            # Update cache
            config_key = f"{config.venue_id}:{config.event_id or 'default'}"
            self.venue_configs[config_key] = config
            
            logger.info(f"Saved venue entry config for {config.venue_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save venue entry config: {e}")
            return False
    
    def get_wallet_entry_count(
        self, 
        wallet_binding_id: str, 
        venue_id: str,
        event_id: Optional[str] = None
    ) -> int:
        """
        Get current entry count for wallet at venue/event.
        
        Args:
            wallet_binding_id: Wallet binding ID
            venue_id: Venue identifier
            event_id: Optional event identifier
            
        Returns:
            int: Current entry count
        """
        try:
            query = self.db.table("entry_events").select("entry_number", count="exact").eq(
                "wallet_binding_id", wallet_binding_id
            ).eq("venue_id", venue_id)
            
            if event_id:
                query = query.eq("event_id", event_id)
            
            result = query.execute()
            return result.count or 0
            
        except Exception as e:
            logger.error(f"Failed to get entry count for wallet {wallet_binding_id}: {e}")
            return 0
    
    def get_wallet_entry_history(
        self, 
        wallet_binding_id: str,
        venue_id: Optional[str] = None,
        event_id: Optional[str] = None,
        limit: int = 50
    ) -> List[EntryEvent]:
        """
        Get entry history for wallet.
        
        Args:
            wallet_binding_id: Wallet binding ID
            venue_id: Optional venue filter
            event_id: Optional event filter
            limit: Maximum number of entries to return
            
        Returns:
            List[EntryEvent]: Entry history
        """
        try:
            query = self.db.table("entry_events").select("*").eq(
                "wallet_binding_id", wallet_binding_id
            ).order("timestamp", desc=True).limit(limit)
            
            if venue_id:
                query = query.eq("venue_id", venue_id)
            
            if event_id:
                query = query.eq("event_id", event_id)
            
            result = query.execute()
            
            entries = []
            for entry_data in result.data:
                entry = EntryEvent(
                    id=entry_data["id"],
                    wallet_id=entry_data["wallet_id"],
                    wallet_binding_id=entry_data["wallet_binding_id"],
                    event_id=entry_data.get("event_id"),
                    venue_id=entry_data["venue_id"],
                    entry_number=entry_data["entry_number"],
                    entry_type=EntryType(entry_data["entry_type"]),
                    timestamp=datetime.fromisoformat(entry_data["timestamp"]),
                    gateway_id=entry_data.get("gateway_id"),
                    gateway_name=entry_data.get("gateway_name"),
                    initial_entry_fee_cents=entry_data.get("initial_entry_fee_cents", 0),
                    venue_reentry_fee_cents=entry_data.get("venue_reentry_fee_cents", 0),
                    valid_reentry_scan_fee_cents=entry_data.get("valid_reentry_scan_fee_cents", 0),
                    total_fees_cents=entry_data.get("total_fees_cents", 0),
                    device_fingerprint=entry_data.get("device_fingerprint"),
                    interaction_method=entry_data.get("interaction_method", "QR"),
                    metadata=entry_data.get("metadata", {})
                )
                entries.append(entry)
            
            return entries
            
        except Exception as e:
            logger.error(f"Failed to get entry history for wallet {wallet_binding_id}: {e}")
            return []
    
    def check_entry_permission(
        self,
        wallet_binding_id: str,
        venue_id: str,
        event_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if wallet can enter venue (initial or re-entry).
        
        Args:
            wallet_binding_id: Wallet binding ID
            venue_id: Venue identifier
            event_id: Optional event identifier
            
        Returns:
            Dict: Entry permission result
        """
        try:
            # Get venue configuration
            config = self.get_venue_entry_config(venue_id, event_id)
            
            # Get current entry count
            entry_count = self.get_wallet_entry_count(wallet_binding_id, venue_id, event_id)
            
            if entry_count == 0:
                # Initial entry
                return {
                    "allowed": True,
                    "entry_type": EntryType.INITIAL.value,
                    "entry_number": 1,
                    "fees": {
                        "initial_entry_fee_cents": config.initial_entry_fee_cents,
                        "venue_reentry_fee_cents": 0,
                        "valid_reentry_scan_fee_cents": 0,
                        "total_fees_cents": config.initial_entry_fee_cents
                    },
                    "message": "Initial entry permitted"
                }
            else:
                # Re-entry attempt
                if not config.re_entry_allowed:
                    return {
                        "allowed": False,
                        "entry_type": EntryType.RE_ENTRY.value,
                        "entry_number": entry_count + 1,
                        "message": "Re-entry not allowed - See Staff / Manager",
                        "reason": "RE_ENTRY_DISABLED"
                    }
                
                # Check max re-entries limit
                if config.max_reentries and entry_count >= config.max_reentries:
                    return {
                        "allowed": False,
                        "entry_type": EntryType.RE_ENTRY.value,
                        "entry_number": entry_count + 1,
                        "message": f"Maximum re-entries ({config.max_reentries}) exceeded",
                        "reason": "MAX_REENTRIES_EXCEEDED"
                    }
                
                # Check time limit for re-entry
                if config.reentry_time_limit_hours:
                    last_entry = self.get_last_entry(wallet_binding_id, venue_id, event_id)
                    if last_entry:
                        time_since_last = datetime.utcnow() - last_entry.timestamp
                        if time_since_last.total_seconds() > (config.reentry_time_limit_hours * 3600):
                            return {
                                "allowed": False,
                                "entry_type": EntryType.RE_ENTRY.value,
                                "entry_number": entry_count + 1,
                                "message": f"Re-entry time limit ({config.reentry_time_limit_hours}h) exceeded",
                                "reason": "REENTRY_TIME_LIMIT_EXCEEDED"
                            }
                
                # Re-entry allowed
                total_fees = config.venue_reentry_fee_cents + config.valid_reentry_scan_fee_cents
                
                return {
                    "allowed": True,
                    "entry_type": EntryType.RE_ENTRY.value,
                    "entry_number": entry_count + 1,
                    "fees": {
                        "initial_entry_fee_cents": 0,
                        "venue_reentry_fee_cents": config.venue_reentry_fee_cents,
                        "valid_reentry_scan_fee_cents": config.valid_reentry_scan_fee_cents,
                        "total_fees_cents": total_fees
                    },
                    "message": f"Re-entry permitted (#{entry_count + 1})"
                }
                
        except Exception as e:
            logger.error(f"Failed to check entry permission: {e}")
            return {
                "allowed": False,
                "entry_type": "unknown",
                "message": "Entry permission check failed",
                "reason": "SYSTEM_ERROR"
            }
    
    def get_last_entry(
        self,
        wallet_binding_id: str,
        venue_id: str,
        event_id: Optional[str] = None
    ) -> Optional[EntryEvent]:
        """Get the last entry event for wallet at venue"""
        entries = self.get_wallet_entry_history(
            wallet_binding_id=wallet_binding_id,
            venue_id=venue_id,
            event_id=event_id,
            limit=1
        )
        return entries[0] if entries else None
    
    def record_entry_event(
        self,
        wallet_id: str,
        wallet_binding_id: str,
        venue_id: str,
        entry_permission: Dict[str, Any],
        gateway_id: Optional[str] = None,
        gateway_name: Optional[str] = None,
        device_fingerprint: Optional[str] = None,
        interaction_method: str = "QR",
        event_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> EntryEvent:
        """
        Record entry event in audit trail.
        
        Args:
            wallet_id: Wallet ID
            wallet_binding_id: Wallet binding ID
            venue_id: Venue identifier
            entry_permission: Entry permission result from check_entry_permission
            gateway_id: Optional gateway ID
            gateway_name: Optional gateway name
            device_fingerprint: Optional device fingerprint
            interaction_method: Interaction method (QR/NFC)
            event_id: Optional event identifier
            metadata: Optional additional metadata
            
        Returns:
            EntryEvent: Recorded entry event
        """
        try:
            fees = entry_permission.get("fees", {})
            
            entry_event = EntryEvent(
                id=f"entry_{wallet_binding_id}_{int(datetime.utcnow().timestamp())}",
                wallet_id=wallet_id,
                wallet_binding_id=wallet_binding_id,
                event_id=event_id,
                venue_id=venue_id,
                entry_number=entry_permission["entry_number"],
                entry_type=EntryType(entry_permission["entry_type"]),
                timestamp=datetime.utcnow(),
                gateway_id=gateway_id,
                gateway_name=gateway_name,
                initial_entry_fee_cents=fees.get("initial_entry_fee_cents", 0),
                venue_reentry_fee_cents=fees.get("venue_reentry_fee_cents", 0),
                valid_reentry_scan_fee_cents=fees.get("valid_reentry_scan_fee_cents", 0),
                total_fees_cents=fees.get("total_fees_cents", 0),
                device_fingerprint=device_fingerprint,
                interaction_method=interaction_method,
                metadata=metadata or {}
            )
            
            # Save to database
            entry_data = {
                "id": entry_event.id,
                "wallet_id": entry_event.wallet_id,
                "wallet_binding_id": entry_event.wallet_binding_id,
                "event_id": entry_event.event_id,
                "venue_id": entry_event.venue_id,
                "entry_number": entry_event.entry_number,
                "entry_type": entry_event.entry_type.value,
                "timestamp": entry_event.timestamp.isoformat(),
                "gateway_id": entry_event.gateway_id,
                "gateway_name": entry_event.gateway_name,
                "initial_entry_fee_cents": entry_event.initial_entry_fee_cents,
                "venue_reentry_fee_cents": entry_event.venue_reentry_fee_cents,
                "valid_reentry_scan_fee_cents": entry_event.valid_reentry_scan_fee_cents,
                "total_fees_cents": entry_event.total_fees_cents,
                "device_fingerprint": entry_event.device_fingerprint,
                "interaction_method": entry_event.interaction_method,
                "metadata": entry_event.metadata
            }
            
            self.db.table("entry_events").insert(entry_data).execute()
            
            logger.info(f"Recorded entry event {entry_event.id} for wallet {wallet_binding_id}")
            return entry_event
            
        except Exception as e:
            logger.error(f"Failed to record entry event: {e}")
            raise
    
    def save_venue_entry_config(self, config: VenueEntryConfig) -> VenueEntryConfig:
        """
        Save venue entry configuration to database.
        
        Args:
            config: Venue entry configuration to save
            
        Returns:
            VenueEntryConfig: Saved configuration
        """
        try:
            config_data = {
                "venue_id": config.venue_id,
                "event_id": config.event_id,
                "re_entry_allowed": config.re_entry_allowed,
                "initial_entry_fee_cents": config.initial_entry_fee_cents,
                "venue_reentry_fee_cents": config.venue_reentry_fee_cents,
                "valid_reentry_scan_fee_cents": config.valid_reentry_scan_fee_cents,
                "max_reentries": config.max_reentries,
                "reentry_time_limit_hours": config.reentry_time_limit_hours,
                "created_at": config.created_at.isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Use upsert to handle updates
            result = self.db.table("venue_entry_configs").upsert(
                config_data,
                on_conflict="venue_id,event_id"
            ).execute()
            
            if result.data:
                saved_data = result.data[0]
                config.updated_at = datetime.fromisoformat(saved_data["updated_at"])
                
                # Update cache
                config_key = f"{config.venue_id}:{config.event_id or 'default'}"
                self.venue_configs[config_key] = config
                
                logger.info(f"Saved venue entry config for {config.venue_id}")
                return config
            else:
                raise Exception("Failed to save venue entry config")
                
        except Exception as e:
            logger.error(f"Failed to save venue entry config: {e}")
            raise
    
    def get_venue_entry_stats(
        self,
        venue_id: str,
        event_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get entry statistics for venue/event.
        
        Args:
            venue_id: Venue identifier
            event_id: Optional event identifier
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Dict: Entry statistics
        """
        try:
            query = self.db.table("entry_events").select("*").eq("venue_id", venue_id)
            
            if event_id:
                query = query.eq("event_id", event_id)
            
            if start_date:
                query = query.gte("timestamp", start_date.isoformat())
            
            if end_date:
                query = query.lte("timestamp", end_date.isoformat())
            
            result = query.execute()
            entries = result.data
            
            # Calculate statistics
            total_entries = len(entries)
            initial_entries = len([e for e in entries if e["entry_type"] == EntryType.INITIAL.value])
            re_entries = len([e for e in entries if e["entry_type"] == EntryType.RE_ENTRY.value])
            
            total_fees_collected = sum(e.get("total_fees_cents", 0) for e in entries)
            venue_fees_collected = sum(e.get("venue_reentry_fee_cents", 0) + e.get("initial_entry_fee_cents", 0) for e in entries)
            valid_fees_collected = sum(e.get("valid_reentry_scan_fee_cents", 0) for e in entries)
            
            unique_wallets = len(set(e["wallet_binding_id"] for e in entries))
            
            return {
                "venue_id": venue_id,
                "event_id": event_id,
                "period": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                },
                "totals": {
                    "total_entries": total_entries,
                    "initial_entries": initial_entries,
                    "re_entries": re_entries,
                    "unique_wallets": unique_wallets
                },
                "fees": {
                    "total_fees_collected_cents": total_fees_collected,
                    "venue_fees_collected_cents": venue_fees_collected,
                    "valid_fees_collected_cents": valid_fees_collected,
                    "total_fees_collected_dollars": total_fees_collected / 100.0,
                    "venue_fees_collected_dollars": venue_fees_collected / 100.0,
                    "valid_fees_collected_dollars": valid_fees_collected / 100.0
                },
                "averages": {
                    "avg_entries_per_wallet": total_entries / unique_wallets if unique_wallets > 0 else 0,
                    "reentry_rate": re_entries / initial_entries if initial_entries > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get venue entry stats: {e}")
            return {
                "venue_id": venue_id,
                "event_id": event_id,
                "error": str(e)
            }