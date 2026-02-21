import Link from "next/link";
import { FileText, LayoutTemplate, GitBranch, FolderKanban, Zap, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rounded-xl bg-white border p-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome to DocMD
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Turn Markdown into professionally styled Word documents — reliably,
          repeatably, and without manual reformatting.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/documents?new=true">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <FileText className="mr-2 h-4 w-4" />
              New Document
            </Button>
          </Link>
          <Link href="/templates">
            <Button variant="outline">
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Explore Templates
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-base">Documents</CardTitle>
            <CardDescription>Upload and manage your Markdown files</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/documents" className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700">
              View documents <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <LayoutTemplate className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>Word templates that define your output styles</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/templates" className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700">
              Manage templates <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-base">Agent</CardTitle>
            <CardDescription>AI-powered document classification and routing</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings" className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700">
              Configure agent <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { step: "1", title: "Upload Markdown", desc: "Paste or upload your .md file" },
            { step: "2", title: "Choose Template", desc: "Pick a Word template for styling" },
            { step: "3", title: "Convert", desc: "Generate a styled Word document" },
            { step: "4", title: "Export", desc: "Download or send to SharePoint" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
