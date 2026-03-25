"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function NewProviderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    token_url: "",
    client_id: "",
    client_secret: "",
    refresh_token: "",
    is_active: true,
  });

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const res = await apiFetch("/providers", {
        method: "POST",
        body: JSON.stringify(form),
      });

      if (res.ok) {
        router.push("/providers");
      } else if (res.status === 422) {
        const data = await res.json();
        setErrors(data.errors || {});
      } else {
        setErrors({ general: ["Failed to create provider."] });
      }
    } catch {
      setErrors({ general: ["Cannot connect to server."] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/providers" className="p-2 rounded-lg hover:bg-background transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New API Provider</h1>
          <p className="text-sm text-muted mt-1">Add a new API provider connection</p>
        </div>
      </div>

      {errors.general && (
        <div className="px-4 py-3 rounded-lg bg-danger-light text-danger text-sm">{errors.general[0]}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <FormField label="Provider Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. Zoho CRM"
            className="form-input"
          />
        </FormField>

        <FormField label="Base URL" required error={errors.base_url}>
          <input
            type="url"
            value={form.base_url}
            onChange={(e) => handleChange("base_url", e.target.value)}
            placeholder="https://www.zohoapis.com"
            className="form-input"
          />
        </FormField>

        <FormField label="Token URL" error={errors.token_url}>
          <input
            type="url"
            value={form.token_url}
            onChange={(e) => handleChange("token_url", e.target.value)}
            placeholder="https://accounts.zoho.com/oauth/v2/token"
            className="form-input"
          />
        </FormField>

        <FormField label="Client ID" error={errors.client_id}>
          <input
            type="text"
            value={form.client_id}
            onChange={(e) => handleChange("client_id", e.target.value)}
            placeholder="Enter Client ID"
            className="form-input"
          />
        </FormField>

        <FormField label="Client Secret" error={errors.client_secret}>
          <input
            type="password"
            value={form.client_secret}
            onChange={(e) => handleChange("client_secret", e.target.value)}
            placeholder="Enter Client Secret"
            className="form-input"
          />
        </FormField>

        <FormField label="Refresh Token" error={errors.refresh_token}>
          <input
            type="password"
            value={form.refresh_token}
            onChange={(e) => handleChange("refresh_token", e.target.value)}
            placeholder="Enter Refresh Token"
            className="form-input"
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
            Create Provider
          </button>
          <Link href="/providers" className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">
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
