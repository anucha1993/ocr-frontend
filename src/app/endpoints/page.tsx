"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Provider {
  id: number;
  name: string;
}

interface Endpoint {
  id: number;
  provider_id: number;
  name: string;
  method: string;
  endpoint: string;
  description: string | null;
  is_active: boolean;
  provider?: Provider;
}

const methodColors: Record<string, string> = {
  GET: "bg-success-light text-success",
  POST: "bg-primary-light text-primary",
  PUT: "bg-warning-light text-warning",
  PATCH: "bg-info-light text-info",
  DELETE: "bg-danger-light text-danger",
};

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filterProvider, setFilterProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [endpointsRes, providersRes] = await Promise.all([
        apiFetch(`/endpoints${filterProvider ? `?provider_id=${filterProvider}` : ""}`),
        apiFetch("/providers"),
      ]);
      if (endpointsRes.ok) setEndpoints(await endpointsRes.json());
      if (providersRes.ok) setProviders(await providersRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProvider]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete endpoint "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/endpoints/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEndpoints((prev) => prev.filter((e) => e.id !== id));
        setMessage({ type: "success", text: `Endpoint "${name}" deleted.` });
      } else {
        setMessage({ type: "error", text: "Failed to delete endpoint." });
      }
    } catch {
      setMessage({ type: "error", text: "Cannot connect to server." });
    } finally {
      setDeleting(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Endpoints</h1>
          <p className="text-sm text-muted mt-1">Manage API endpoint configurations</p>
        </div>
        <Link
          href="/endpoints/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Endpoint
        </Link>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success" ? "bg-success-light text-success" : "bg-danger-light text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {endpoints.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <GitBranch className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-medium mb-1">No Endpoints</h3>
          <p className="text-sm text-muted mb-4">Add endpoints to start making API calls.</p>
          <Link
            href="/endpoints/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Endpoint
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left px-4 py-3 font-medium text-muted">Method</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Endpoint</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Provider</th>
                <th className="text-center px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} className="border-b border-border last:border-0 hover:bg-background/50">
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded ${methodColors[ep.method] ?? "bg-gray-100 text-gray-600"}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{ep.name}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{ep.endpoint}</td>
                  <td className="px-4 py-3 text-muted">{ep.provider?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        ep.is_active ? "bg-success-light text-success" : "bg-danger-light text-danger"
                      }`}
                    >
                      {ep.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/endpoints/${ep.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-primary-light text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(ep.id, ep.name)}
                        disabled={deleting === ep.id}
                        className="p-1.5 rounded-lg hover:bg-danger-light text-danger transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
