from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, Literal, List
from uuid import UUID
from datetime import datetime
from enum import Enum

# User Role Enum
class UserRole(str, Enum):
    USER = "USER"
    VENDOR = "VENDOR"
    ADMIN = "ADMIN"

# Auth Models
class SessionRequest(BaseModel):
    token: str

class SessionResponse(BaseModel):
    user_id: UUID
    email: str
    authenticated: bool

# Wallet Models
class FundingSourceAmount(BaseModel):
    source: str  # No restrictions on source type
    amount: float = Field(..., gt=0)  # Amount in dollars for this source

class FundRequest(BaseModel):
    sources: List[FundingSourceAmount]  # Multiple funding sources with individual amounts
    
    def model_post_init(self, __context):
        if not self.sources:
            raise ValueError("At least one funding source is required")
        total = sum(s.amount for s in self.sources)
        if total <= 0:
            raise ValueError("Total amount must be positive")

class WalletBalance(BaseModel):
    balance_cents: int
    balance_dollars: float
    updated_at: datetime

# Transaction Models
class TransactionType(str, Enum):
    FUND = "FUND"
    SPEND = "SPEND"
    FEE = "FEE"

class Transaction(BaseModel):
    id: UUID
    wallet_id: UUID
    type: TransactionType
    amount_cents: int
    balance_before_cents: Optional[int] = None  # Balance before transaction
    balance_after_cents: Optional[int] = None   # Balance after transaction
    vendor_name: Optional[str] = None           # Mandatory for SPEND/FEE transactions
    gateway_id: Optional[str] = None
    gateway_name: Optional[str] = None          # Human-readable gateway name for receipts
    gateway_type: Optional[str] = None          # Gateway type: ENTRY_POINT, INTERNAL_AREA, TABLE_SEAT
    venue_id: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

# GhostPass Models
class PurchaseRequest(BaseModel):
    duration: Literal[1, 3, 7]  # days

class PassStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"

class GhostPass(BaseModel):
    id: UUID
    user_id: UUID
    status: PassStatus
    expires_at: datetime
    created_at: datetime

class PurchaseResponse(BaseModel):
    status: str
    pass_id: UUID
    expires_at: datetime
    amount_charged_cents: int

# Session Models
class SessionType(str, Enum):
    THIRTY_SECONDS = "30_seconds"
    THREE_MINUTES = "3_minutes"
    TEN_MINUTES = "10_minutes"

class SessionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    VAPORIZED = "VAPORIZED"

class SessionCreateRequest(BaseModel):
    session_type: SessionType

class Session(BaseModel):
    id: UUID
    user_id: UUID
    session_type: SessionType
    status: SessionStatus
    created_at: datetime
    vaporizes_at: datetime
    venue_id: Optional[str] = None  # Set when first scanned

class SessionStatusResponse(BaseModel):
    session: Optional[Session] = None
    can_create: bool
    message: str

# Scan Models
class ScanRequest(BaseModel):
    pass_id: UUID
    gateway_id: str = Field(..., min_length=1, description="Gateway ID where scan is occurring (required)")
    venue_id: str

class ScanResponse(BaseModel):
    status: Literal["APPROVED", "DENIED"]
    receipt_id: str
    message: Optional[str] = None

# Fee Models
class FeeConfig(BaseModel):
    id: UUID
    venue_id: str
    valid_pct: float
    vendor_pct: float
    pool_pct: float
    promoter_pct: float

# Payout Models
class PayoutRequest(BaseModel):
    amount_cents: int = Field(..., gt=0)
    account_details: Dict[str, str]

class PayoutResponse(BaseModel):
    status: str
    payout_id: str
    amount_cents: int
# Admin Models
class AdminUser(BaseModel):
    id: UUID
    email: str
    role: UserRole
    created_at: datetime

class FeeConfigUpdate(BaseModel):
    venue_id: Optional[str] = None
    valid_pct: float = Field(..., ge=0, le=100)
    vendor_pct: float = Field(..., ge=0, le=100)
    pool_pct: float = Field(..., ge=0, le=100)
    promoter_pct: float = Field(..., ge=0, le=100)

    def model_post_init(self, __context):
        total = self.valid_pct + self.vendor_pct + self.pool_pct + self.promoter_pct
        if abs(total - 100.0) > 0.01:  # Allow small floating point errors
            raise ValueError(f"Fee percentages must sum to 100%, got {total}%")

class ScanFeeUpdate(BaseModel):
    venue_id: str
    fee_cents: int = Field(..., ge=0)

class GhostPassPricingUpdate(BaseModel):
    one_day_cents: int = Field(..., ge=0)
    three_day_cents: int = Field(..., ge=0)
    seven_day_cents: int = Field(..., ge=0)

class PayoutStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROCESSED = "PROCESSED"

class PayoutRequestAdmin(BaseModel):
    id: UUID
    vendor_user_id: UUID
    vendor_email: str
    amount_cents: int
    status: PayoutStatus
    requested_at: datetime
    processed_at: Optional[datetime] = None
    processed_by: Optional[UUID] = None
    notes: Optional[str] = None

class PayoutAction(BaseModel):
    action: Literal["approve", "reject", "process"]
    notes: Optional[str] = None

class RetentionOverride(BaseModel):
    retention_days: int = Field(..., ge=1, le=365)
    justification: str = Field(..., min_length=10)

class AuditLog(BaseModel):
    id: UUID
    admin_user_id: UUID
    admin_email: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

class SystemStats(BaseModel):
    total_users: int
    total_wallets: int
    total_balance_cents: int
    active_passes: int
    expired_passes: int
    pending_payouts: int
    total_transactions: int
    revenue_today_cents: int
    revenue_week_cents: int
    revenue_month_cents: int

class AdminDashboard(BaseModel):
    stats: SystemStats
    recent_transactions: List[Transaction]
    pending_payouts: List[PayoutRequestAdmin]
    recent_audit_logs: List[AuditLog]
    current_fee_config: Optional[Dict[str, Any]] = None
    current_scan_fees: Optional[Dict[str, Any]] = None
    current_pricing: Optional[Dict[str, Any]] = None
    current_retention: Optional[Dict[str, Any]] = None

# Gateway Models
class GatewayStatus(str, Enum):
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"

class GatewayType(str, Enum):
    ENTRY_POINT = "ENTRY_POINT"
    INTERNAL_AREA = "INTERNAL_AREA"
    TABLE_SEAT = "TABLE_SEAT"

class GatewayPoint(BaseModel):
    id: UUID
    venue_id: str
    name: str
    number: Optional[int] = None
    accepts_ghostpass: bool = True
    status: GatewayStatus
    type: GatewayType
    linked_area_id: Optional[UUID] = None  # For TABLE_SEAT: references INTERNAL_AREA
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None

class GatewayPointCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    number: Optional[int] = Field(None, ge=0)
    accepts_ghostpass: bool = True
    status: GatewayStatus = GatewayStatus.ENABLED
    type: GatewayType
    linked_area_id: Optional[UUID] = None  # Required for TABLE_SEAT type

class GatewayPointUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    number: Optional[int] = Field(None, ge=0)
    accepts_ghostpass: Optional[bool] = None
    status: Optional[GatewayStatus] = None
    linked_area_id: Optional[UUID] = None