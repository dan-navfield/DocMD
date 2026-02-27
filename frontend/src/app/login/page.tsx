"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { billing, onboarding } from "@/lib/api";
import {
  FileText,
  ArrowRight,
  Mail,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Read plan/tier from URL params (for email-confirmation-in-different-tab edge case)
  useEffect(() => {
    const urlTier = searchParams.get("tier");
    if (urlTier && (urlTier === "solo" || urlTier === "team")) {
      sessionStorage.setItem("docmd_tier", urlTier);
    }
    const urlInterval = searchParams.get("interval");
    if (urlInterval && (urlInterval === "monthly" || urlInterval === "annual")) {
      sessionStorage.setItem("docmd_interval", urlInterval);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    await handlePostAuth();
  };

  const handlePostAuth = async () => {
    // 1. Check for stored tier → Stripe checkout with success_url=/onboarding
    const storedTier = sessionStorage.getItem("docmd_tier");
    if (storedTier && (storedTier === "solo" || storedTier === "team")) {
      const storedInterval = sessionStorage.getItem("docmd_interval");
      const interval = storedInterval === "annual" ? "year" : "month";
      sessionStorage.removeItem("docmd_tier");
      sessionStorage.removeItem("docmd_interval");
      try {
        const { checkout_url } = await billing.createCheckoutSession(
          storedTier,
          interval,
          `${window.location.origin}/onboarding`,
          `${window.location.origin}/login`
        );
        window.location.href = checkout_url;
        return;
      } catch (err) {
        console.error("Failed to create checkout session:", err);
        // Fall through to onboarding check
      }
    }

    // 2. Check onboarding status → redirect to /onboarding if incomplete
    try {
      const status = await onboarding.getStatus();
      if (!status.completed) {
        router.push("/onboarding");
        return;
      }
    } catch (err) {
      console.error("Failed to check onboarding status:", err);
      // Fall through to dashboard
    }

    // 3. Default → dashboard
    router.push("/documents");
    setLoading(false);
  };

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

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-lg text-white">
              MD
            </div>
            <span className="text-xl font-semibold text-slate-900">DocMD</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to continue to DocMD
            </p>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-800">{success}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-10"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="h-11 w-full bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-emerald-600 hover:text-emerald-700"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-8 border-t pt-6">
            <p className="text-center text-xs text-slate-400">
              By continuing, you agree to DocMD&apos;s Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
