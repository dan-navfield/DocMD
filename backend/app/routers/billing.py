from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase_admin
from app.models.billing import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    PortalSessionRequest,
    PortalSessionResponse,
    SubscriptionResponse,
    UsageResponse,
)
from app.services.billing_service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


def get_billing_service(
    supabase=Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
) -> BillingService:
    return BillingService(supabase, settings)


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    """Get the current user's subscription, creating a trial if none exists."""
    sub = service.get_or_create_subscription(user["id"])
    return sub


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    """Get current usage stats and feature access for the user."""
    return service.get_usage(user["id"])


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    """Create a Stripe Checkout Session and return the URL."""
    if body.tier == "enterprise":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enterprise plans require contacting sales.",
        )
    email = user.get("email", "")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User email is required for billing.",
        )

    try:
        url = service.create_checkout_session(
            user_id=user["id"],
            email=email,
            tier=body.tier.value,
            interval=body.interval,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except stripe.StripeError as e:
        logger.error("Stripe error creating checkout: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create checkout session. Please try again.",
        )

    return CheckoutSessionResponse(checkout_url=url)


@router.post("/portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    body: PortalSessionRequest,
    user: dict = Depends(get_current_user),
    service: BillingService = Depends(get_billing_service),
):
    """Create a Stripe Customer Portal session and return the URL."""
    email = user.get("email", "")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User email is required for billing.",
        )

    try:
        url = service.create_portal_session(
            user_id=user["id"],
            email=email,
            return_url=body.return_url,
        )
    except stripe.StripeError as e:
        logger.error("Stripe error creating portal session: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create portal session. Please try again.",
        )

    return PortalSessionResponse(portal_url=url)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase=Depends(get_supabase_admin),
):
    """Receive and handle Stripe webhook events. No auth — verified by signature."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    service = BillingService(supabase, settings)
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        service.handle_checkout_completed(data)
    elif event_type == "customer.subscription.updated":
        service.handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        service.handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        service.handle_invoice_payment_failed(data)
    else:
        logger.debug("Unhandled webhook event: %s", event_type)

    return {"received": True}
