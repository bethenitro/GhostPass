from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, Literal
from uuid import UUID
from datetime import datetime
from enum import Enum

# Auth Models
class SessionRequest(BaseModel):
    token: str

class SessionResponse(BaseModel):
    user_id: UUID
    email: str
    authenticated: bool

# Wallet Models
class FundRequest(BaseModel):
    source: Literal["zelle", "stripe"]
    amount: float = Field(..., gt=0)  # Accept dollars, convert to cents internally

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
    gateway_id: Optional[str] = None
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

# Scan Models
class ScanRequest(BaseModel):
    pass_id: UUID
    gateway_id: str
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
