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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fafd99]/20">
        <PartyPopper className="h-8 w-8 text-[#4c573e]" />
      </div>

      <h2 className="text-3xl font-bold text-[#3b432f]">
        You&apos;re all set!
      </h2>
      <p className="mt-2 text-sm text-[#94908a]">
        You&apos;re ready to start converting documents. Here are some quick
        links to get going.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-4 rounded-xl border border-[#dddacc] p-4 transition hover:border-[#d8db6e] hover:bg-[#fafd99]/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edebe0]">
              <link.icon className="h-5 w-5 text-[#6b665e]" />
            </div>
            <div>
              <h3 className="font-medium text-[#3b432f]">{link.title}</h3>
              <p className="text-sm text-[#94908a]">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <Button
        onClick={onComplete}
        className="mt-8 h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-sm font-medium px-8"
        style={{ color: "#3b432f" }}
      >
        Go to dashboard
      </Button>
    </div>
  );
}
