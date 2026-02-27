-- Subscription billing: tracks user plans, Stripe integration, and usage

CREATE TYPE subscription_tier AS ENUM ('solo', 'team', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    tier subscription_tier NOT NULL DEFAULT 'solo',
    status subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    trial_end TIMESTAMPTZ,
    price_id TEXT,
    billing_interval TEXT DEFAULT 'month',
    conversions_this_period INT NOT NULL DEFAULT 0,
    period_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id),
    UNIQUE(stripe_customer_id),
    UNIQUE(stripe_subscription_id)
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can update their own subscription (for client-side fields only;
-- Stripe webhooks use service key which bypasses RLS)
CREATE POLICY "Users can update own subscription"
    ON subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role can insert (backend creates subscriptions on behalf of users)
-- No INSERT policy for authenticated — backend uses service key to create
CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
