"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Provider {
  id: number;
  name: string;
}

export default function EditEndpointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    provider_id: "",
    name: "",
    method: "GET",
    endpoint: "",
    description: "",
    default_headers: "",
    default_body: "",
    is_active: true,
  });

  useEffect(() => {
    Promise.all([
      apiFetch(`/endpoints/${id}`).then((r) => r.json()),
      apiFetch("/providers").then((r) => r.json()),
    ])
      .then(([endpoint, providersData]) => {
        setForm({
          provider_id: String(endpoint.provider_id),
          name: endpoint.name || "",
          method: endpoint.method || "GET",
          endpoint: endpoint.endpoint || "",
          description: endpoint.description || "",
          default_headers: endpoint.default_headers ? JSON.stringify(endpoint.default_headers, null, 2) : "",
          default_body: endpoint.default_body ? JSON.stringify(endpoint.default_body, null, 2) : "",
          is_active: endpoint.is_active ?? true,
        });
        setProviders(providersData);
      })
      .catch(() => router.push("/endpoints"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const payload: Record<string, unknown> = {
      ...form,
      provider_id: Number(form.provider_id),
      default_headers: form.default_headers || null,
      default_body: form.default_body || null,
    };

    try {
      const res = await apiFetch(`/endpoints/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/endpoints");
      } else if (res.status === 422) {
        const data = await res.json();
        setErrors(data.errors || {});
      } else {
        setErrors({ general: ["Failed to update endpoint."] });
      }
    } catch {
      setErrors({ general: ["Cannot connect to server."] });
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/endpoints" className="p-2 rounded-lg hover:bg-background transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Endpoint</h1>
          <p className="text-sm text-muted mt-1">Update endpoint configuration</p>
        </div>
      </div>

      {errors.general && (
        <div className="px-4 py-3 rounded-lg bg-danger-light text-danger text-sm">{errors.general[0]}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <FormField label="Provider" required error={errors.provider_id}>
          <select
            value={form.provider_id}
            onChange={(e) => handleChange("provider_id", e.target.value)}
            className="form-input"
          >
            <option value="">Select a provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Endpoint Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. Get Leads"
            className="form-input"
          />
        </FormField>

        <div className="grid grid-cols-4 gap-4">
          <FormField label="Method" required error={errors.method}>
            <select value={form.method} onChange={(e) => handleChange("method", e.target.value)} className="form-input">
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
          <div className="col-span-3">
            <FormField label="Endpoint Path" required error={errors.endpoint}>
              <input
                type="text"
                value={form.endpoint}
                onChange={(e) => handleChange("endpoint", e.target.value)}
                placeholder="/crm/v2/Leads"
                className="form-input"
              />
            </FormField>
          </div>
        </div>

        <FormField label="Description" error={errors.description}>
          <input
            type="text"
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Brief description of this endpoint"
            className="form-input"
          />
        </FormField>

        <FormField label="Default Headers (JSON)" error={errors.default_headers}>
          <textarea
            value={form.default_headers}
            onChange={(e) => handleChange("default_headers", e.target.value)}
            placeholder='{"Content-Type": "application/json"}'
            rows={3}
            className="form-input font-mono text-xs"
          />
        </FormField>

        <FormField label="Default Body (JSON)" error={errors.default_body}>
          <textarea
            value={form.default_body}
            onChange={(e) => handleChange("default_body", e.target.value)}
            placeholder='{"data": [{}]}'
            rows={3}
            className="form-input font-mono text-xs"
          />
        </FormField>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
          <span className="text-sm font-medium">Active</span>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          <Link href="/endpoints" className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error[0]}</p>}
    </div>
  );
}
