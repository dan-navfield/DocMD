"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  Key,
  LogOut,
  Copy,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  Save,
  Eye,
  EyeOff,
  Shield,
  Type,
  CreditCard,
  ArrowUpRight,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { settings as settingsApi, billing as billingApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FontLibrary } from "@/components/font-library";
import type { SubscriptionUsage } from "@/lib/types";

type Section = "profile" | "billing" | "settings" | "fonts" | "api-keys";

const menuItems = [
  { id: "profile" as Section, label: "Profile", icon: User },
  { id: "billing" as Section, label: "Billing", icon: CreditCard },
  { id: "settings" as Section, label: "Settings", icon: Settings },
  { id: "fonts" as Section, label: "Fonts", icon: Type },
  { id: "api-keys" as Section, label: "API Keys", icon: Key },
];

const TIER_LABELS: Record<string, string> = {
  solo: "Solo",
  team: "Team",
  enterprise: "Enterprise",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trialing: "bg-blue-50 text-blue-700 border-blue-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  canceled: "bg-red-50 text-red-700 border-red-200",
  unpaid: "bg-red-50 text-red-700 border-red-200",
  incomplete: "bg-slate-50 text-slate-600 border-slate-200",
};

const FEATURE_LABELS: Record<string, string> = {
  custom_templates: "Custom templates",
  style_mapping_editor: "Style mapping editor",
  integrations: "Integrations",
  team_collaboration: "Team collaboration",
  api_access: "API access",
  mcp_server_access: "MCP server access",
};

export default function SettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile state
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Settings state
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmKey, setLlmKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftEmail, setMicrosoftEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [llmSuccess, setLlmSuccess] = useState("");

  // Billing state
  const [billingUsage, setBillingUsage] = useState<SubscriptionUsage | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<
    { id: string; name: string; key_prefix: string }[]
  >([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("");

  useEffect(() => {
    // Load user profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");
        const name = user.user_metadata?.full_name || "";
        setFullName(name);
        setOriginalName(name);
      }
    });

    // Load settings
    settingsApi
      .getLLM()
      .then((data) => {
        setLlmProvider(data.provider);
        setHasKey(data.has_key);
      })
      .catch(() => {});
    settingsApi
      .getMicrosoft()
      .then((data) => {
        setMicrosoftConnected(data.connected);
        setMicrosoftEmail(data.email);
      })
      .catch(() => {});
    settingsApi.getApiKeys().then(setApiKeys).catch(() => []);
    billingApi.getUsage().then(setBillingUsage).catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSuccess("");
    try {
      await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      setOriginalName(fullName);
      setProfileSuccess("Profile updated successfully");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch {
      // Fail silently
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(""), 3000);
      }
    } catch {
      setPasswordError("Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveLLM = async () => {
    if (!llmKey) return;
    setSaving(true);
    setLlmSuccess("");
    try {
      await settingsApi.updateLLM(llmProvider, llmKey);
      setHasKey(true);
      setLlmKey("");
      setLlmSuccess("API key saved successfully");
      setTimeout(() => setLlmSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName) return;
    try {
      const result = await settingsApi.createApiKey(newKeyName);
      setCreatedKey(result.key);
      setApiKeys((prev) => [
        {
          id: result.id,
          name: result.name,
          key_prefix: result.key.slice(0, 12) + "...",
        },
        ...prev,
      ]);
      setNewKeyName("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("Revoke this API key?")) return;
    await settingsApi.deleteApiKey(id);
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const { portal_url } = await billingApi.createPortalSession();
      window.location.href = portal_url;
    } catch (err) {
      console.error("Failed to open billing portal:", err);
      setBillingLoading(false);
    }
  };

  const handleSubscribe = async (tier: string = "solo") => {
    setBillingLoading(true);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(tier, "month");
      window.location.href = checkout_url;
    } catch (err) {
      console.error("Failed to create checkout session:", err);
      setBillingLoading(false);
    }
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail
      ? userEmail[0].toUpperCase()
      : "?";

  return (
    <div className="mx-auto flex max-w-5xl gap-8">
      {/* Left sidebar menu */}
      <div className="w-56 shrink-0">
        <div className="sticky top-6">
          {/* User card */}
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {fullName || "User"}
              </p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-6 border-t pt-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* ──────── PROFILE ──────── */}
        {activeSection === "profile" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Profile</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your personal information and account security
              </p>
            </div>

            {/* Personal Information */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Personal Information
                </h2>
              </div>
              <div className="space-y-5 p-6">
                {/* Avatar + Name */}
                <div className="flex items-start gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
                    {initials}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Full name
                      </label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="h-10 max-w-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Email address
                      </label>
                      <div className="flex h-10 max-w-sm items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {userEmail}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Email cannot be changed
                      </p>
                    </div>
                  </div>
                </div>

                {profileSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">
                      {profileSuccess}
                    </span>
                  </div>
                )}

                <div className="flex justify-end border-t pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || fullName === originalName}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {savingProfile ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {savingProfile ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Change Password
                  </h2>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    New password
                  </label>
                  <div className="relative max-w-sm">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="h-10 pl-10 pr-10"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Confirm new password
                  </label>
                  <div className="relative max-w-sm">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="h-10 pl-10 pr-10"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">
                      {passwordSuccess}
                    </span>
                  </div>
                )}

                <div className="flex justify-end border-t pt-4">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    variant="outline"
                    className="border-slate-300"
                  >
                    {changingPassword ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    {changingPassword ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── BILLING ──────── */}
        {activeSection === "billing" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Billing</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your subscription, view usage, and update payment details
              </p>
            </div>

            {/* Current Plan */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Current Plan
                </h2>
              </div>
              <div className="p-6">
                {billingUsage ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                        <CreditCard className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-slate-900">
                            {TIER_LABELS[billingUsage.tier] || billingUsage.tier}
                          </p>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                              STATUS_COLORS[billingUsage.status] || STATUS_COLORS.incomplete
                            )}
                          >
                            {billingUsage.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {billingUsage.status === "trialing"
                            ? "Your free trial is active"
                            : billingUsage.status === "active"
                              ? "Your subscription is active"
                              : billingUsage.status === "canceled"
                                ? "Your subscription has been canceled"
                                : "Please update your billing"}
                        </p>
                      </div>
                    </div>
                    <div>
                      {(billingUsage.status === "active" ||
                        billingUsage.status === "past_due") && (
                        <Button
                          onClick={handleManageBilling}
                          disabled={billingLoading}
                          variant="outline"
                        >
                          {billingLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="mr-2 h-4 w-4" />
                          )}
                          Manage Billing
                        </Button>
                      )}
                      {(billingUsage.status === "trialing" ||
                        billingUsage.status === "canceled") && (
                        <Button
                          onClick={() => handleSubscribe(billingUsage.tier)}
                          disabled={billingLoading}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {billingLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                          )}
                          Subscribe
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading subscription...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Usage */}
            {billingUsage && (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Usage This Period
                  </h2>
                </div>
                <div className="space-y-5 p-6">
                  {/* Conversions */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        Conversions
                      </span>
                      <span className="text-sm text-slate-500">
                        {billingUsage.conversions_used}
                        {billingUsage.conversions_limit
                          ? ` / ${billingUsage.conversions_limit}`
                          : " (unlimited)"}
                      </span>
                    </div>
                    {billingUsage.conversions_limit && (
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            billingUsage.conversions_used /
                              billingUsage.conversions_limit >=
                            0.9
                              ? "bg-red-500"
                              : billingUsage.conversions_used /
                                    billingUsage.conversions_limit >=
                                  0.7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (billingUsage.conversions_used /
                                billingUsage.conversions_limit) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Templates */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        Templates
                      </span>
                      <span className="text-sm text-slate-500">
                        {billingUsage.templates_used}
                        {billingUsage.templates_limit
                          ? ` / ${billingUsage.templates_limit}`
                          : " (unlimited)"}
                      </span>
                    </div>
                    {billingUsage.templates_limit && (
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            billingUsage.templates_used /
                              billingUsage.templates_limit >=
                            0.9
                              ? "bg-red-500"
                              : billingUsage.templates_used /
                                    billingUsage.templates_limit >=
                                  0.7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (billingUsage.templates_used /
                                billingUsage.templates_limit) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            {billingUsage && (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Plan Features
                  </h2>
                </div>
                <div className="divide-y">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <span className="text-sm text-slate-700">{label}</span>
                      {billingUsage.features[key] ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upgrade CTA for Solo users */}
            {billingUsage && billingUsage.tier === "solo" && (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Upgrade to Team
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Unlimited conversions, custom templates, integrations, and more.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSubscribe("team")}
                      disabled={billingLoading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {billingLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                      )}
                      Upgrade — $49/mo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────── SETTINGS ──────── */}
        {activeSection === "settings" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Settings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Configure integrations and AI agent behaviour
              </p>
            </div>

            {/* AI Agent Configuration */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  AI Agent Configuration
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose your LLM provider and enter your API key (BYOK)
                </p>
              </div>
              <div className="space-y-5 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Provider
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="h-10 w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    API Key
                    {hasKey && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2 max-w-lg">
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder={
                        hasKey
                          ? "Enter new key to replace..."
                          : "Enter API key..."
                      }
                      className="h-10 flex-1"
                    />
                    <Button
                      onClick={handleSaveLLM}
                      disabled={!llmKey || saving}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                {llmSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">
                      {llmSuccess}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Microsoft SharePoint */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Microsoft SharePoint
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Connect your Microsoft account to export documents to SharePoint
                </p>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        microsoftConnected
                          ? "bg-emerald-50"
                          : "bg-slate-100"
                      )}
                    >
                      {microsoftConnected ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {microsoftConnected ? "Connected" : "Not connected"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {microsoftConnected && microsoftEmail
                          ? microsoftEmail
                          : "Sign in with your Microsoft account to get started"}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/microsoft`}
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      {microsoftConnected ? "Reconnect" : "Connect Microsoft"}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── FONTS ──────── */}
        {activeSection === "fonts" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Fonts</h1>
              <p className="mt-1 text-sm text-slate-500">
                Upload custom fonts to use in templates and document conversions
              </p>
            </div>
            <FontLibrary />
          </div>
        )}

        {/* ──────── API KEYS ──────── */}
        {activeSection === "api-keys" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">API Keys</h1>
              <p className="mt-1 text-sm text-slate-500">
                Generate and manage keys for MCP integration and automated
                pipelines
              </p>
            </div>

            {/* Create new key */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Create New Key
                </h2>
              </div>
              <div className="p-6">
                <div className="flex gap-2 max-w-lg">
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. CI Pipeline)"
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={!newKeyName}
                    onClick={handleCreateApiKey}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Generate Key
                  </Button>
                </div>

                {createdKey && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                      Copy this key now — it won&apos;t be shown again!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md bg-white border px-3 py-2 text-xs font-mono text-slate-800">
                        {createdKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(createdKey)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Existing keys */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Active Keys
                </h2>
              </div>
              {apiKeys.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Key className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    No API keys yet
                  </p>
                  <p className="text-xs text-slate-400">
                    Create one above to get started
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between px-6 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {key.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {key.key_prefix}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
