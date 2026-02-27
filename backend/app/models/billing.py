from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class SubscriptionTier(str, Enum):
    solo = "solo"
    team = "team"
    enterprise = "enterprise"


class SubscriptionStatus(str, Enum):
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    unpaid = "unpaid"
    incomplete = "incomplete"


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    tier: SubscriptionTier
    status: SubscriptionStatus
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    trial_end: Optional[datetime] = None
    price_id: Optional[str] = None
    billing_interval: Optional[str] = "month"
    conversions_this_period: int = 0
    period_reset_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CheckoutSessionRequest(BaseModel):
    tier: SubscriptionTier
    interval: str = "month"  # "month" or "year"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class PortalSessionRequest(BaseModel):
    return_url: Optional[str] = None


class PortalSessionResponse(BaseModel):
    portal_url: str


class UsageResponse(BaseModel):
    tier: SubscriptionTier
    status: SubscriptionStatus
    conversions_used: int
    conversions_limit: Optional[int]  # None = unlimited
    templates_used: int
    templates_limit: Optional[int]  # None = unlimited
    features: dict  # feature_name -> bool
