"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Zap, Server } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Provider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  token_url: string | null;
  client_id: string | null;
  is_active: boolean;
  endpoints_count: number;
  created_at: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await apiFetch("/providers");
      if (res.ok) setProviders(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete provider "${name}"? All its endpoints will also be deleted.`)) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProviders((prev) => prev.filter((p) => p.id !== id));
        setMessage({ type: "success", text: `Provider "${name}" deleted.` });
      } else {
        setMessage({ type: "error", text: "Failed to delete provider." });
      }
    } catch {
      setMessage({ type: "error", text: "Cannot connect to server." });
    } finally {
      setDeleting(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const res = await apiFetch(`/providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      setMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch {
      setMessage({ type: "error", text: "Cannot connect to server." });
    } finally {
      setTesting(null);
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
          <h1 className="text-2xl font-bold">API Providers</h1>
          <p className="text-sm text-muted mt-1">Manage your API provider connections</p>
        </div>
        <Link
          href="/providers/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Provider
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

      {providers.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Server className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-medium mb-1">No API Providers</h3>
          <p className="text-sm text-muted mb-4">Get started by adding your first API provider.</p>
          <Link
            href="/providers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Base URL</th>
                <th className="text-center px-4 py-3 font-medium text-muted">Endpoints</th>
                <th className="text-center px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background/50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted truncate max-w-[300px]">{p.base_url}</td>
                  <td className="px-4 py-3 text-center">{p.endpoints_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        p.is_active ? "bg-success-light text-success" : "bg-danger-light text-danger"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(p.id)}
                        disabled={testing === p.id}
                        className="p-1.5 rounded-lg hover:bg-info-light text-info transition-colors disabled:opacity-50"
                        title="Test Connection"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/providers/${p.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-primary-light text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={deleting === p.id}
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
