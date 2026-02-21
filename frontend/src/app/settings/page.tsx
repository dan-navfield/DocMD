"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Copy,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { settings as settingsApi } from "@/lib/api";

export default function SettingsPage() {
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmKey, setLlmKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [apiKeys, setApiKeys] = useState<
    { id: string; name: string; key_prefix: string }[]
  >([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.getLLM().then((data) => {
      setLlmProvider(data.provider);
      setHasKey(data.has_key);
    }).catch(() => {});
    settingsApi.getMicrosoft().then((data) => {
      setMicrosoftConnected(data.connected);
    }).catch(() => {});
    settingsApi.getApiKeys().then(setApiKeys).catch(() => []);
  }, []);

  const handleSaveLLM = async () => {
    if (!llmKey) return;
    setSaving(true);
    try {
      await settingsApi.updateLLM(llmProvider, llmKey);
      setHasKey(true);
      setLlmKey("");
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
        { id: result.id, name: result.name, key_prefix: result.key.slice(0, 12) + "..." },
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>

      {/* LLM Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Provider</label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              API Key
              {hasKey && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Configured
                </Badge>
              )}
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder={hasKey ? "Enter new key to replace..." : "Enter API key..."}
                className="flex-1"
              />
              <Button
                onClick={handleSaveLLM}
                disabled={!llmKey || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Microsoft Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Microsoft SharePoint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {microsoftConnected ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-emerald-700">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Not connected</span>
                </>
              )}
            </div>
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/microsoft`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                {microsoftConnected ? "Reconnect" : "Connect Microsoft"}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Generate API keys for MCP integration and automated pipelines.
          </p>

          <div className="flex gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. CI Pipeline)"
              className="flex-1"
            />
            <Button
              variant="outline"
              disabled={!newKeyName}
              onClick={handleCreateApiKey}
            >
              Generate Key
            </Button>
          </div>

          {createdKey && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800 mb-1">
                Copy this key now — it won't be shown again!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-2 py-1 text-xs font-mono">
                  {createdKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(createdKey)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y rounded-lg border">
            {apiKeys.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">
                No API keys yet
              </p>
            ) : (
              apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {key.key_prefix}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteApiKey(key.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
