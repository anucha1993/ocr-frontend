"use client";

import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Provider {
  id: number;
  name: string;
  base_url: string;
}

interface Endpoint {
  id: number;
  name: string;
  method: string;
  endpoint: string;
  default_headers: Record<string, string> | null;
  default_body: Record<string, unknown> | null;
}

interface ApiResponse {
  status: number;
  body: unknown;
  duration_ms: number;
  headers?: Record<string, string>;
}

export default function TestApiPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  const handleProviderChange = async (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedEndpoint("");
    setEndpoints([]);
    if (providerId) {
      try {
        const res = await apiFetch(`/providers/${providerId}/endpoints`);
        if (res.ok) setEndpoints(await res.json());
      } catch {
        /* ignore */
      }
    }
  };

  const handleEndpointChange = (endpointId: string) => {
    setSelectedEndpoint(endpointId);
    const ep = endpoints.find((e) => String(e.id) === endpointId);
    if (ep) {
      setMethod(ep.method);
      setUrl(ep.endpoint);
      if (ep.default_headers) setHeaders(JSON.stringify(ep.default_headers, null, 2));
      if (ep.default_body) setBody(JSON.stringify(ep.default_body, null, 2));
    }
  };

  const handleSend = async () => {
    if (!selectedProvider || !url) {
      setError("Please select a provider and enter a URL.");
      return;
    }
    setSending(true);
    setError("");
    setResponse(null);

    try {
      const res = await apiFetch("/test/execute", {
        method: "POST",
        body: JSON.stringify({
          provider_id: Number(selectedProvider),
          method,
          url,
          headers: headers || null,
          body: body || null,
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setSending(false);
    }
  };

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-success";
    if (status >= 400 && status < 500) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Test API</h1>
        <p className="text-sm text-muted mt-1">Test your API endpoints with a Postman-like interface</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Panel */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold">Request</h2>

          {/* Provider & Endpoint selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="form-input text-sm"
              >
                <option value="">Select provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Endpoint (optional)</label>
              <select
                value={selectedEndpoint}
                onChange={(e) => handleEndpointChange(e.target.value)}
                disabled={!selectedProvider}
                className="form-input text-sm disabled:opacity-50"
              >
                <option value="">Custom URL</option>
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    [{ep.method}] {ep.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Method + URL */}
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="form-input w-28 text-sm font-bold"
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/crm/v2/Leads"
              className="form-input flex-1 font-mono text-sm"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>

          {/* Headers */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Headers (JSON)</label>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Content-Type": "application/json"}'
              rows={4}
              className="form-input font-mono text-xs"
            />
          </div>

          {/* Body */}
          {method !== "GET" && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Body (JSON)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"data": [{}]}'
                rows={6}
                className="form-input font-mono text-xs"
              />
            </div>
          )}

          {error && <div className="px-3 py-2 rounded-lg bg-danger-light text-danger text-sm">{error}</div>}
        </div>

        {/* Response Panel */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold">Response</h2>

          {!response && !sending ? (
            <div className="flex items-center justify-center py-16 text-muted text-sm">
              Send a request to see the response
            </div>
          ) : sending ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted">Sending request...</span>
            </div>
          ) : response ? (
            <>
              {/* Status Bar */}
              <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-background text-sm">
                <span className={`font-bold ${statusColor(response.status)}`}>
                  {response.status}
                </span>
                <span className="text-muted">{response.duration_ms}ms</span>
              </div>

              {/* Response Body */}
              <div className="relative">
                <pre className="p-4 rounded-lg bg-background border border-border text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap break-words">
                  {typeof response.body === "string"
                    ? response.body
                    : JSON.stringify(response.body, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
