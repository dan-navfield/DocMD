"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Shield,
  Zap,
  Crown,
} from "lucide-react";

type Tier = "solo" | "team";
type Interval = "monthly" | "annual";

const PLANS: Record<
  string,
  {
    name: string;
    monthlyPrice: number;
    annualPrice: number;

    badge?: string;
    features: { label: string; included: boolean }[];
  }
> = {
  solo: {
    name: "Solo",
    monthlyPrice: 10,
    annualPrice: 8,

    features: [
      { label: "20 conversions / month", included: true },
      { label: "5 templates", included: true },
      { label: "5 mappings", included: true },
      { label: "API access", included: true },
      { label: "Team members", included: false },
      { label: "Priority support", included: false },
    ],
  },
  team: {
    name: "Team",
    monthlyPrice: 49,
    annualPrice: 39,

    badge: "Most popular",
    features: [
      { label: "Unlimited conversions", included: true },
      { label: "Unlimited templates", included: true },
      { label: "Unlimited mappings", included: true },
      { label: "API access", included: true },
      { label: "Up to 10 team members", included: true },
      { label: "Priority support", included: true },
    ],
  },
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");
  const [isEnterprise, setIsEnterprise] = useState(false);

  // Account form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Read URL params for deep links from pricing page
  useEffect(() => {
    const urlTier = searchParams.get("tier");
    const urlInterval = searchParams.get("interval");

    if (urlInterval === "monthly" || urlInterval === "annual") {
      setInterval(urlInterval);
    }

    if (urlTier === "enterprise") {
      setIsEnterprise(true);
      setStep(2);
      return;
    }

    if (urlTier === "solo" || urlTier === "team") {
      setSelectedTier(urlTier);
      setStep(2);
    }
  }, [searchParams]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Store plan + interval so login page can create checkout session
    if (selectedTier) {
      sessionStorage.setItem("docmd_tier", selectedTier);
      sessionStorage.setItem("docmd_interval", interval);
    }

    setStep(3);
    setLoading(false);
  };

  const selectedPlan = selectedTier ? PLANS[selectedTier] : null;
  const price = selectedPlan
    ? interval === "annual"
      ? selectedPlan.annualPrice
      : selectedPlan.monthlyPrice
    : null;

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between bg-emerald-700 p-10 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur font-bold text-lg">
              MD
            </div>
            <span className="text-xl font-semibold">DocMD</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Markdown in.
              <br />
              Word out.
              <br />
              <span className="text-emerald-200">Perfectly styled.</span>
            </h1>
            <p className="mt-4 text-lg text-emerald-100/80 leading-relaxed">
              Turn Markdown into professionally formatted Word documents
              that match your organisation&apos;s templates — every time.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Sparkles,
                title: "AI-powered classification",
                desc: "Automatically detect doc types and apply the right template",
              },
              {
                icon: Shield,
                title: "Template governance",
                desc: "Reusable mappings ensure consistent formatting across teams",
              },
              {
                icon: Zap,
                title: "API & MCP ready",
                desc: "Integrate with your AI pipeline for straight-through processing",
              },
            ].map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="h-4 w-4 text-emerald-200" />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-sm text-emerald-100/60">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-emerald-200/50">
          <FileText className="h-4 w-4" />
          <span>Trusted by teams who care about document quality</span>
        </div>
      </div>

      {/* Right panel — steps */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-[520px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-lg text-white">
              MD
            </div>
            <span className="text-xl font-semibold text-slate-900">DocMD</span>
          </div>

          {/* Step 1: Plan Selection */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  Choose your plan
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Pick the plan that fits your needs
                </p>
              </div>

              {/* Interval toggle */}
              <div className="mb-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setInterval("monthly")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    interval === "monthly"
                      ? "bg-emerald-100 text-emerald-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval("annual")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    interval === "annual"
                      ? "bg-emerald-100 text-emerald-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Annual
                  <span className="ml-1.5 text-xs text-emerald-600">
                    Save 20%
                  </span>
                </button>
              </div>

              {/* Plan cards */}
              <div className="grid grid-cols-2 gap-4">
                {(["solo", "team"] as const).map((tier) => {
                  const plan = PLANS[tier];
                  const tierPrice =
                    interval === "annual"
                      ? plan.annualPrice
                      : plan.monthlyPrice;
                  const isSelected = selectedTier === tier;

                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative rounded-xl border-2 p-5 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                          {plan.badge}
                        </span>
                      )}
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {plan.name}
                        </h3>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-slate-900">
                            ${tierPrice}
                          </span>
                          <span className="text-sm text-slate-500">/mo</span>
                        </div>
                        {/* price interval clarification */}
                      </div>
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li
                            key={f.label}
                            className="flex items-center gap-2 text-sm"
                          >
                            {f.included ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-slate-300" />
                            )}
                            <span
                              className={
                                f.included
                                  ? "text-slate-700"
                                  : "text-slate-400"
                              }
                            >
                              {f.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => {
                  if (selectedTier) setStep(2);
                }}
                disabled={!selectedTier}
                className="mt-6 h-11 w-full bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Account Form (or Enterprise Contact) */}
          {step === 2 && (
            <div>
              {isEnterprise ? (
                /* Enterprise: Contact Sales */
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <Crown className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Enterprise Plan
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
                    For organisations needing custom limits, SSO, dedicated
                    support, and SLAs. Get in touch and we&apos;ll set up a plan
                    tailored to your needs.
                  </p>
                  <a
                    href="mailto:sales@mddoc.app?subject=Enterprise%20Plan%20Inquiry"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-yellow-300 px-6 text-sm font-medium text-black hover:bg-yellow-400 transition"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Contact Sales
                  </a>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setIsEnterprise(false);
                        setStep(1);
                      }}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
                      Back to plans
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal signup form */
                <div>
                  <button
                    onClick={() => setStep(1)}
                    className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">
                      Create your account
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      Get started with DocMD in seconds
                    </p>
                  </div>

                  {/* Selected plan badge */}
                  {selectedPlan && (
                    <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium text-emerald-800">
                        {selectedPlan.name} plan
                      </span>
                    </div>
                  )}

                  {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Full name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Jane Smith"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-11 pl-10"
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11 pl-10"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="password"
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-11 pl-10"
                          autoComplete="new-password"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || !name || !email || !password}
                      className="h-11 w-full bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      {loading ? "Creating account..." : "Create account"}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>

                  <div className="mt-8 border-t pt-6">
                    <p className="text-center text-xs text-slate-400">
                      By continuing, you agree to DocMD&apos;s Terms of Service
                      and Privacy Policy.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Email Confirmation */}
          {step === 3 && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <Mail className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                We sent a confirmation link to
              </p>
              <p className="mt-1 font-medium text-slate-900">{email}</p>
              <p className="mt-4 text-sm text-slate-500 max-w-sm mx-auto">
                Click the link in your email to confirm your account, then come
                back and sign in.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-yellow-300 px-6 text-sm font-medium text-black hover:bg-yellow-400 transition"
              >
                Go to sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
