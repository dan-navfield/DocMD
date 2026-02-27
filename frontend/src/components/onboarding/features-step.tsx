"use client";

import { Button } from "@/components/ui/button";
import { Upload, GitBranch, FileText } from "lucide-react";

interface FeaturesStepProps {
  onNext: () => void;
}

const FEATURES = [
  {
    icon: Upload,
    title: "Upload templates",
    description:
      "Upload your .docx Word templates with the styles and formatting your organisation uses.",
  },
  {
    icon: GitBranch,
    title: "Create mappings",
    description:
      "Map Markdown elements (headings, lists, code blocks) to your template's Word styles.",
  },
  {
    icon: FileText,
    title: "Convert documents",
    description:
      "Paste or upload Markdown and convert it to a perfectly styled Word document in seconds.",
  },
];

export function FeaturesStep({ onNext }: FeaturesStepProps) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-slate-900">How DocMD works</h2>
      <p className="mt-2 text-sm text-slate-500">
        Three simple steps to perfectly formatted documents
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-4">
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 rounded-xl border border-slate-200 p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <feature.icon className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-slate-900">
                  {feature.title}
                </h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onNext}
        className="mt-8 h-11 bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium px-8"
      >
        Got it, let&apos;s start
      </Button>
    </div>
  );
}
