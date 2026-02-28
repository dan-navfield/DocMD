"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Settings, PartyPopper } from "lucide-react";

interface CompletionStepProps {
  onComplete: () => void;
}

const QUICK_LINKS = [
  {
    icon: Upload,
    title: "Upload more templates",
    description: "Add your organisation's Word templates",
    href: "/templates",
  },
  {
    icon: FileText,
    title: "Browse documents",
    description: "View and manage your converted documents",
    href: "/documents",
  },
  {
    icon: Settings,
    title: "Explore settings",
    description: "Configure API keys, LLM, and more",
    href: "/settings",
  },
];

export function CompletionStep({ onComplete }: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <PartyPopper className="h-8 w-8 text-emerald-600" />
      </div>

      <h2 className="text-3xl font-bold text-slate-900">
        You&apos;re all set!
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        You&apos;re ready to start converting documents. Here are some quick
        links to get going.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <link.icon className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">{link.title}</h3>
              <p className="text-sm text-slate-500">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <Button
        onClick={onComplete}
        className="mt-8 h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-[#3b432f] text-sm font-medium px-8"
      >
        Go to dashboard
      </Button>
    </div>
  );
}
