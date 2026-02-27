"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { billing } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface WelcomeStepProps {
  userName: string;
  onNext: () => void;
}

export function WelcomeStep({ userName, onNext }: WelcomeStepProps) {
  const [planInfo, setPlanInfo] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    billing
      .getSubscription()
      .then((sub) => {
        setPlanInfo(`${sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)} plan`);
        if (sub.trial_end) {
          const trialEnd = new Date(sub.trial_end);
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          );
          setTrialInfo(`${daysLeft} days left in your trial`);
        }
      })
      .catch(() => {
        // Subscription might not exist yet
      })
      .finally(() => setLoading(false));
  }, []);

  const displayName = userName || "there";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
        <span className="text-2xl font-bold text-emerald-700">MD</span>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">Welcome to DocMD!</h1>

      <p className="mt-3 text-lg text-slate-600">
        Hi {displayName}, let&apos;s get you set up in under 2 minutes.
      </p>

      {loading ? (
        <div className="mt-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : (
        (planInfo || trialInfo) && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2">
            {planInfo && (
              <span className="text-sm font-medium text-emerald-800">
                {planInfo}
              </span>
            )}
            {planInfo && trialInfo && (
              <span className="text-emerald-300">|</span>
            )}
            {trialInfo && (
              <span className="text-sm text-emerald-600">{trialInfo}</span>
            )}
          </div>
        )
      )}

      <Button
        onClick={onNext}
        className="mt-8 h-11 bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium px-8"
      >
        Let&apos;s go
      </Button>
    </div>
  );
}
