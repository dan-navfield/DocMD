"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { billing, onboarding } from "@/lib/api";
import { toast } from "sonner";
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
      sessionStorage.setItem("mddoc_tier", urlTier);
    }
    const urlInterval = searchParams.get("interval");
    if (urlInterval && (urlInterval === "monthly" || urlInterval === "annual")) {
      sessionStorage.setItem("mddoc_interval", urlInterval);
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
    const storedTier = sessionStorage.getItem("mddoc_tier");
    if (storedTier && (storedTier === "solo" || storedTier === "team")) {
      const storedInterval = sessionStorage.getItem("mddoc_interval");
      const interval = storedInterval === "annual" ? "year" : "month";
      sessionStorage.removeItem("mddoc_tier");
      sessionStorage.removeItem("mddoc_interval");
      try {
        const { checkout_url } = await billing.createCheckoutSession(
          storedTier,
          interval,
          `${window.location.origin}/onboarding`,
          `${window.location.origin}/login`
        );
        window.location.href = checkout_url;
        return;
      } catch {
        toast.error("Failed to create checkout session");
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
    } catch {
      toast.error("Failed to check onboarding status");
      // Fall through to dashboard
    }

    // 3. Default → dashboard
    router.push("/documents");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between bg-[#3b432f] p-10 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur font-bold text-lg">
              MD
            </div>
            <span className="text-xl font-semibold">MDDoc</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Markdown in.
              <br />
              Word out.
              <br />
              <span className="text-[#fafd99]">Perfectly styled.</span>
            </h1>
            <p className="mt-4 text-lg text-white/70 leading-relaxed">
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
                  <feature.icon className="h-4 w-4 text-[#fafd99]" />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-sm text-white/50">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#fafd99]/50">
          <FileText className="h-4 w-4" />
          <span>Trusted by teams who care about document quality</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4c573e] font-bold text-lg text-white">
              MD
            </div>
            <span className="text-xl font-semibold text-[#3b432f]">MDDoc</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#3b432f]">Welcome back</h2>
            <p className="mt-1.5 text-sm text-[#94908a]">
              Sign in to continue to MDDoc
            </p>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-[#fafd99]/10 border border-[#d8db6e] p-4">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#6b7f5a]" />
              <p className="text-sm text-[#3b432f]">{success}</p>
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
              <label className="mb-1.5 block text-sm font-medium text-[#44403a]">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94908a]" />
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
                <label className="text-sm font-medium text-[#44403a]">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-[#6b7f5a] hover:text-[#3b432f]"
                  onClick={async () => {
                    if (!email) {
                      setError("Enter your email address first, then click Forgot password.");
                      return;
                    }
                    setError("");
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/login`,
                    });
                    if (error) {
                      setError(error.message);
                    } else {
                      setSuccess("Password reset email sent. Check your inbox.");
                    }
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94908a]" />
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
              className="h-11 w-full bg-[#fafd99] hover:bg-[#f0f47a] text-sm font-medium"
              style={{ color: "#3b432f" }}
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
            <p className="text-sm text-[#94908a]">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-[#6b7f5a] hover:text-[#3b432f]"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-8 border-t pt-6">
            <p className="text-center text-xs text-[#94908a]">
              By continuing, you agree to MDDoc&apos;s Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
