"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { onboarding } from "@/lib/api";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { FeaturesStep } from "@/components/onboarding/features-step";
import { TemplateUploadStep } from "@/components/onboarding/template-upload-step";
import { MappingStep } from "@/components/onboarding/mapping-step";
import { ConversionStep } from "@/components/onboarding/conversion-step";
import { CompletionStep } from "@/components/onboarding/completion-step";
import { Loader2 } from "lucide-react";

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // Wizard state passed between steps
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [mappingId, setMappingId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Get user info
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserName(
        user.user_metadata?.full_name || user.email?.split("@")[0] || ""
      );

      // Check if onboarding is already complete
      try {
        const status = await onboarding.getStatus();
        if (status.completed) {
          router.push("/documents");
          return;
        }
      } catch {
        // Continue with onboarding
      }

      setLoading(false);
    }

    init();
  }, [router]);

  const handleSkip = async () => {
    try {
      await onboarding.markComplete();
    } catch {
      // Best effort
    }
    router.push("/documents");
  };

  const handleComplete = async () => {
    try {
      await onboarding.markComplete();
    } catch {
      // Best effort
    }
    router.push("/documents");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Progress bar */}
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-sm text-white">
              MD
            </div>
            <span className="text-sm font-medium text-slate-600">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i <= step ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <WelcomeStep
              userName={userName}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && <FeaturesStep onNext={() => setStep(2)} />}
          {step === 2 && (
            <TemplateUploadStep
              onNext={(id) => {
                setTemplateId(id);
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <MappingStep
              templateId={templateId}
              onNext={(id) => {
                setMappingId(id);
                setStep(4);
              }}
            />
          )}
          {step === 4 && (
            <ConversionStep
              templateId={templateId}
              mappingId={mappingId}
              onNext={() => setStep(5)}
            />
          )}
          {step === 5 && <CompletionStep onComplete={handleComplete} />}
        </div>
      </div>

      {/* Skip link */}
      {step < 5 && (
        <div className="border-t bg-white px-6 py-3 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Skip setup
          </button>
        </div>
      )}
    </div>
  );
}
