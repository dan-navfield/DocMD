from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from supabase import Client

from app.config import Settings

logger = logging.getLogger(__name__)

TIER_LIMITS = {
    "solo": {
        "conversions_per_month": 20,
        "templates": 5,
        "custom_templates": False,
        "style_mapping_editor": False,
        "integrations": False,
        "team_collaboration": False,
        "api_access": False,
        "mcp_server_access": True,
        "trial_days": 7,
    },
    "team": {
        "conversions_per_month": None,  # unlimited
        "templates": None,  # unlimited
        "custom_templates": True,
        "style_mapping_editor": True,
        "integrations": True,
        "team_collaboration": True,
        "api_access": True,
        "mcp_server_access": True,
        "trial_days": 14,
    },
    "enterprise": {
        "conversions_per_month": None,
        "templates": None,
        "custom_templates": True,
        "style_mapping_editor": True,
        "integrations": True,
        "team_collaboration": True,
        "api_access": True,
        "mcp_server_access": True,
        "trial_days": 30,
    },
}


class BillingService:
    def __init__(self, supabase: Client, settings: Settings):
        self.supabase = supabase
        self.settings = settings
        stripe.api_key = settings.stripe_secret_key

    def _get_price_id(self, tier: str, interval: str) -> str:
        key = f"stripe_{tier}_{interval.replace('month', 'monthly').replace('year', 'annual')}_price_id"
        price_id = getattr(self.settings, key, "")
        if not price_id:
            raise ValueError(f"No price ID configured for {tier}/{interval}")
        return price_id

    # ── Subscription CRUD ──

    def get_subscription(self, user_id: str) -> Optional[dict]:
        result = (
            self.supabase.table("subscriptions")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if result and result.data:
            return result.data[0]
        return None

    def get_or_create_subscription(
        self, user_id: str, tier: str = "solo"
    ) -> dict:
        existing = self.get_subscription(user_id)
        if existing:
            return existing

        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])
        trial_days = limits["trial_days"]
        now = datetime.now(timezone.utc)

        data = {
            "user_id": user_id,
            "tier": tier,
            "status": "trialing",
            "trial_end": (now + timedelta(days=trial_days)).isoformat(),
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=trial_days)).isoformat(),
            "period_reset_at": now.isoformat(),
            "conversions_this_period": 0,
        }
        result = self.supabase.table("subscriptions").insert(data).execute()
        return result.data[0]

    # ── Stripe Customer ──

    def get_or_create_stripe_customer(
        self, user_id: str, email: str
    ) -> str:
        sub = self.get_subscription(user_id)
        if sub and sub.get("stripe_customer_id"):
            return sub["stripe_customer_id"]

        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id},
        )
        customer_id = customer.id

        if sub:
            self.supabase.table("subscriptions").update(
                {"stripe_customer_id": customer_id}
            ).eq("user_id", user_id).execute()
        else:
            self.get_or_create_subscription(user_id)
            self.supabase.table("subscriptions").update(
                {"stripe_customer_id": customer_id}
            ).eq("user_id", user_id).execute()

        return customer_id

    # ── Checkout & Portal ──

    def create_checkout_session(
        self,
        user_id: str,
        email: str,
        tier: str,
        interval: str = "month",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> str:
        customer_id = self.get_or_create_stripe_customer(user_id, email)
        price_id = self._get_price_id(tier, interval)

        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])
        trial_days = limits["trial_days"]

        frontend_url = self.settings.frontend_url
        if not success_url:
            success_url = f"{frontend_url}/documents?billing=success"
        if not cancel_url:
            cancel_url = f"{frontend_url}/login"

        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={"trial_period_days": trial_days},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id, "tier": tier},
        )
        return session.url

    def create_portal_session(
        self, user_id: str, email: str, return_url: Optional[str] = None
    ) -> str:
        customer_id = self.get_or_create_stripe_customer(user_id, email)
        if not return_url:
            return_url = f"{self.settings.frontend_url}/settings"

        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    # ── Webhook handlers ──

    def handle_checkout_completed(self, session: dict) -> None:
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        tier = session.get("metadata", {}).get("tier", "solo")
        user_id = session.get("metadata", {}).get("user_id")

        if not customer_id:
            logger.warning("checkout.session.completed missing customer")
            return

        update_data = {
            "stripe_subscription_id": subscription_id,
            "stripe_customer_id": customer_id,
            "status": "active",
            "tier": tier,
        }

        if user_id:
            self.supabase.table("subscriptions").update(update_data).eq(
                "user_id", user_id
            ).execute()
        else:
            self.supabase.table("subscriptions").update(update_data).eq(
                "stripe_customer_id", customer_id
            ).execute()

        logger.info("Checkout completed for customer %s", customer_id)

    def handle_subscription_updated(self, subscription: dict) -> None:
        sub_id = subscription.get("id")
        status = subscription.get("status")
        current_period_start = subscription.get("current_period_start")
        current_period_end = subscription.get("current_period_end")
        cancel_at_period_end = subscription.get("cancel_at_period_end", False)
        trial_end = subscription.get("trial_end")
        price_id = None
        interval = None

        items = subscription.get("items", {}).get("data", [])
        if items:
            price = items[0].get("price", {})
            price_id = price.get("id")
            interval = price.get("recurring", {}).get("interval")

        # Determine tier from price ID
        tier = self._tier_from_price_id(price_id) if price_id else None

        update_data: dict = {"status": status, "cancel_at_period_end": cancel_at_period_end}

        if current_period_start:
            update_data["current_period_start"] = datetime.fromtimestamp(
                current_period_start, tz=timezone.utc
            ).isoformat()
        if current_period_end:
            update_data["current_period_end"] = datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            ).isoformat()
        if trial_end:
            update_data["trial_end"] = datetime.fromtimestamp(
                trial_end, tz=timezone.utc
            ).isoformat()
        if price_id:
            update_data["price_id"] = price_id
        if interval:
            update_data["billing_interval"] = interval
        if tier:
            update_data["tier"] = tier

        # Reset conversion counter on new period
        existing = (
            self.supabase.table("subscriptions")
            .select("period_reset_at")
            .eq("stripe_subscription_id", sub_id)
            .limit(1)
            .execute()
        )
        existing_row = existing.data[0] if existing and existing.data else None
        if existing_row and current_period_start:
            period_start_dt = datetime.fromtimestamp(
                current_period_start, tz=timezone.utc
            )
            reset_at = existing_row.get("period_reset_at")
            if reset_at:
                reset_dt = datetime.fromisoformat(reset_at.replace("Z", "+00:00"))
                if period_start_dt > reset_dt:
                    update_data["conversions_this_period"] = 0
                    update_data["period_reset_at"] = period_start_dt.isoformat()

        self.supabase.table("subscriptions").update(update_data).eq(
            "stripe_subscription_id", sub_id
        ).execute()

        logger.info("Subscription %s updated to status=%s", sub_id, status)

    def handle_subscription_deleted(self, subscription: dict) -> None:
        sub_id = subscription.get("id")
        self.supabase.table("subscriptions").update({"status": "canceled"}).eq(
            "stripe_subscription_id", sub_id
        ).execute()
        logger.info("Subscription %s canceled", sub_id)

    def handle_invoice_payment_failed(self, invoice: dict) -> None:
        sub_id = invoice.get("subscription")
        if sub_id:
            self.supabase.table("subscriptions").update(
                {"status": "past_due"}
            ).eq("stripe_subscription_id", sub_id).execute()
            logger.info("Subscription %s marked past_due", sub_id)

    def _tier_from_price_id(self, price_id: str) -> Optional[str]:
        mapping = {
            self.settings.stripe_solo_monthly_price_id: "solo",
            self.settings.stripe_solo_annual_price_id: "solo",
            self.settings.stripe_team_monthly_price_id: "team",
            self.settings.stripe_team_annual_price_id: "team",
        }
        return mapping.get(price_id)

    # ── Usage & feature checks ──

    def increment_conversion_count(self, user_id: str) -> None:
        sub = self.get_subscription(user_id)
        if not sub:
            return
        self.supabase.table("subscriptions").update(
            {"conversions_this_period": sub["conversions_this_period"] + 1}
        ).eq("user_id", user_id).execute()

    def check_can_convert(self, user_id: str) -> tuple[bool, str]:
        sub = self.get_or_create_subscription(user_id)
        status = sub["status"]

        if status in ("canceled", "unpaid", "incomplete"):
            return False, f"Your subscription is {status}. Please update your billing to continue."

        if status == "past_due":
            return False, "Your payment is past due. Please update your payment method."

        # Check trial expiry
        if status == "trialing" and sub.get("trial_end"):
            trial_end = datetime.fromisoformat(
                sub["trial_end"].replace("Z", "+00:00")
            )
            if datetime.now(timezone.utc) > trial_end:
                return False, "Your free trial has expired. Please subscribe to continue."

        tier = sub["tier"]
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])
        max_conversions = limits["conversions_per_month"]

        if max_conversions is not None:
            if sub["conversions_this_period"] >= max_conversions:
                return (
                    False,
                    f"You've reached your {max_conversions} conversion limit this period. "
                    "Upgrade to Team for unlimited conversions.",
                )

        return True, ""

    def check_can_create_template(self, user_id: str) -> tuple[bool, str]:
        sub = self.get_or_create_subscription(user_id)
        status = sub["status"]

        if status in ("canceled", "unpaid", "incomplete"):
            return False, f"Your subscription is {status}. Please update your billing to continue."

        tier = sub["tier"]
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])
        max_templates = limits["templates"]

        if max_templates is not None:
            count_result = (
                self.supabase.table("templates")
                .select("id", count="exact")
                .eq("created_by", user_id)
                .execute()
            )
            current_count = count_result.count or 0
            if current_count >= max_templates:
                return (
                    False,
                    f"You've reached your {max_templates} template limit. "
                    "Upgrade to Team for unlimited templates.",
                )

        return True, ""

    def check_feature_access(
        self, user_id: str, feature: str
    ) -> tuple[bool, str]:
        sub = self.get_or_create_subscription(user_id)
        tier = sub["tier"]
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])
        has_access = limits.get(feature, False)

        if not has_access:
            return (
                False,
                f"The {feature.replace('_', ' ')} feature requires a Team or Enterprise plan.",
            )
        return True, ""

    def get_usage(self, user_id: str) -> dict:
        sub = self.get_or_create_subscription(user_id)
        tier = sub["tier"]
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["solo"])

        # Count templates
        count_result = (
            self.supabase.table("templates")
            .select("id", count="exact")
            .eq("created_by", user_id)
            .execute()
        )
        templates_used = count_result.count or 0

        return {
            "tier": tier,
            "status": sub["status"],
            "conversions_used": sub["conversions_this_period"],
            "conversions_limit": limits["conversions_per_month"],
            "templates_used": templates_used,
            "templates_limit": limits["templates"],
            "features": {
                "custom_templates": limits["custom_templates"],
                "style_mapping_editor": limits["style_mapping_editor"],
                "integrations": limits["integrations"],
                "team_collaboration": limits["team_collaboration"],
                "api_access": limits["api_access"],
                "mcp_server_access": limits["mcp_server_access"],
            },
        }
