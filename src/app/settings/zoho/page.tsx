"use client";

import { useState, useEffect } from "react";
import {
  Save,
  TestTube,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const apiDomains = [
  { label: "United States", value: "https://www.zohoapis.com" },
  { label: "Europe", value: "https://www.zohoapis.eu" },
  { label: "India", value: "https://www.zohoapis.in" },
  { label: "Australia", value: "https://www.zohoapis.com.au" },
  { label: "Japan", value: "https://www.zohoapis.jp" },
  { label: "China", value: "https://www.zohoapis.com.cn" },
];

export default function ZohoSettingsPage() {
  const [settings, setSettings] = useState({
    client_id: "",
    client_secret: "",
    refresh_token: "",
    api_domain: "https://www.zohoapis.com",
  });
  const [hasExisting, setHasExisting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [connectedUser, setConnectedUser] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch("/zoho/settings");
        if (res.ok) {
          const json = await res.json();
          if (json.exists && json.data) {
            setSettings({
              client_id: json.data.client_id || "",
              client_secret: "",
              refresh_token: "",
              api_domain: json.data.api_domain || "https://www.zohoapis.com",
            });
            setHasExisting(true);
            if (json.data.updated_at) setLastUpdated(json.data.updated_at);
          }
        }
      } catch {
        // server not reachable — keep empty form
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleChange = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!settings.client_id) {
      showMessage("error", "Please fill in Client ID.");
      return;
    }
    if (!hasExisting && (!settings.client_secret || !settings.refresh_token)) {
      showMessage("error", "Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        client_id: settings.client_id,
        api_domain: settings.api_domain,
      };
      if (settings.client_secret) payload.client_secret = settings.client_secret;
      if (settings.refresh_token) payload.refresh_token = settings.refresh_token;

      const res = await apiFetch("/zoho/settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setHasExisting(true);
        showMessage("success", "Settings saved successfully!");
      } else {
        const data = await res.json().catch(() => null);
        showMessage("error", data?.message || "Failed to save settings.");
      }
    } catch {
      showMessage("error", "Cannot connect to the server.");
    } finally {
      setSaving(false);
    }
  };
  

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await apiFetch("/zoho/test-connection", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus("connected");
        setConnectedUser(data.user || "");
        showMessage("success", "Connection successful!");
      } else {
        setConnectionStatus("error");
        showMessage("error", data.message || "Connection failed.");
      }
    } catch {
      setConnectionStatus("error");
      showMessage("error", "Cannot connect to the server.");
    } finally {
      setTesting(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/zoho/refresh-token", { method: "POST" });
      if (res.ok) {
        showMessage("success", "Token refreshed successfully!");
      } else {
        showMessage("error", "Failed to refresh token.");
      }
    } catch {
      showMessage("error", "Cannot connect to the server.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zoho Connection</h1>
        <p className="text-sm text-muted mt-1">Configure your Zoho OAuth API credentials</p>
      </div>

      {/* Existing settings indicator */}
      {hasExisting && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>
            Settings configured.{lastUpdated && <> Last updated: <strong>{lastUpdated}</strong></>}
            {" "}— Secret fields are hidden. Leave blank to keep current values.
          </span>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success" ? "bg-success-light text-success" : "bg-danger-light text-danger"
          }`}
        >
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-lg font-semibold">OAuth Credentials</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Client ID <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={settings.client_id}
              onChange={(e) => handleChange("client_id", e.target.value)}
              placeholder="Enter your Zoho Client ID"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Client Secret <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={settings.client_secret}
                onChange={(e) => handleChange("client_secret", e.target.value)}
                placeholder={hasExisting ? "Leave blank to keep current value" : "Enter your Zoho Client Secret"}
                className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Refresh Token <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={settings.refresh_token}
                onChange={(e) => handleChange("refresh_token", e.target.value)}
                placeholder={hasExisting ? "Leave blank to keep current value" : "Enter your Zoho Refresh Token"}
                className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">API Domain</label>
            <select
              value={settings.api_domain}
              onChange={(e) => handleChange("api_domain", e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              {apiDomains.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} — {d.value}
                </option>
              ))}
            </select>
          </div>

          {/* Connection Status */}
          {connectionStatus !== "unknown" && (
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
                connectionStatus === "connected" ? "bg-success-light text-success" : "bg-danger-light text-danger"
              }`}
            >
              {connectionStatus === "connected" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>
                {connectionStatus === "connected"
                  ? `Connected${connectedUser ? ` as ${connectedUser}` : ""}`
                  : "Connection failed"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <TestTube className="w-4 h-4" />
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={handleRefreshToken}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Token"}
            </button>
          </div>
        </div>

        {/* Help Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Setup Guide</h3>
          </div>
          <ol className="space-y-3 text-sm text-muted">
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">1.</span>
              <span>
                Go to the{" "}
                <a
                  href="https://api-console.zoho.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Zoho API Console <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">2.</span>
              <span>Create a Self Client application</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">3.</span>
              <span>Copy the Client ID and Client Secret</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">4.</span>
              <span>Generate a Refresh Token with the required scopes</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">5.</span>
              <span>Paste the credentials above and save</span>
            </li>
          </ol>

          <div className="mt-5 p-3 bg-primary-light rounded-lg">
            <p className="text-xs text-primary font-medium">Required Scopes</p>
            <p className="text-xs text-muted mt-1 font-mono">
              ZohoCRM.modules.ALL, ZohoBooks.fullaccess.all
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
