"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FieldDef {
  key: string;
  label: string;
  keywords: string[];
  regex: string | null;
  extraction_mode: "auto" | "same_line" | "next_line";
}

interface LandmarkDef {
  type: "mrz" | "keyword" | "regex" | "not_keyword";
  value: string | null;
  weight: number;
}

interface FieldMapping {
  id: number;
  name: string;
  fields: FieldDef[];
  detection_landmarks: LandmarkDef[] | null;
  is_active: boolean;
  created_at: string;
}

const emptyField: FieldDef = { key: "", label: "", keywords: [], regex: null, extraction_mode: "auto" };

export default function OcrFieldMappingsPage() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMapping, setEditingMapping] = useState<Partial<FieldMapping> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/ocr/field-mappings");
      setMappings(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const openCreate = () => {
    setEditingMapping({
      name: "",
      fields: [{ ...emptyField }],
      detection_landmarks: [],
      is_active: true,
    });
    setIsNew(true);
    setError(null);
  };

  const openEdit = (m: FieldMapping) => {
    setEditingMapping({
      ...m,
      fields: m.fields.map((f) => ({ ...f })),
      detection_landmarks: (m.detection_landmarks || []).map((l) => ({ ...l })),
    });
    setIsNew(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!editingMapping) return;
    setSaving(true);
    setError(null);

    try {
      const body = {
        name: editingMapping.name,
        fields: editingMapping.fields,
        detection_landmarks: editingMapping.detection_landmarks?.length ? editingMapping.detection_landmarks : null,
        is_active: editingMapping.is_active ?? true,
      };

      let res;
      if (isNew) {
        res = await apiFetch("/ocr/field-mappings", {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch(`/ocr/field-mappings/${editingMapping.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Save failed");
        return;
      }

      setEditingMapping(null);
      fetchMappings();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this field mapping?")) return;
    await apiFetch(`/ocr/field-mappings/${id}`, { method: "DELETE" });
    fetchMappings();
  };

  // Field editing helpers
  const updateField = (index: number, partial: Partial<FieldDef>) => {
    if (!editingMapping?.fields) return;
    const fields = [...editingMapping.fields];
    fields[index] = { ...fields[index], ...partial };
    setEditingMapping({ ...editingMapping, fields });
  };

  const addField = () => {
    if (!editingMapping) return;
    setEditingMapping({
      ...editingMapping,
      fields: [...(editingMapping.fields || []), { ...emptyField }],
    });
  };

  const removeField = (index: number) => {
    if (!editingMapping?.fields) return;
    const fields = editingMapping.fields.filter((_, i) => i !== index);
    setEditingMapping({ ...editingMapping, fields });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-primary" />
            OCR Field Mappings
          </h1>
          <p className="text-sm text-muted mt-1">
            Configure which fields to extract from OCR documents
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Mapping
        </button>
      </div>

      {/* Mappings List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="bg-card rounded-xl border border-border text-center py-20 text-muted text-sm">
            No field mappings yet
          </div>
        ) : (
          mappings.map((m) => (
            <div
              key={m.id}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-background/50 transition-colors"
                onClick={() =>
                  setExpandedId(expandedId === m.id ? null : m.id)
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${m.is_active ? "bg-success" : "bg-muted"}`}
                  />
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted">
                      {m.fields.length} field(s) •{" "}
                      {(m.detection_landmarks?.length || 0) > 0
                        ? `${m.detection_landmarks!.length} landmark(s)`
                        : "No landmarks"}{" "}
                      •{" "}
                      {m.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(m);
                    }}
                    className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(m.id);
                    }}
                    className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedId === m.id ? (
                    <ChevronUp className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                </div>
              </div>

              {/* Expanded fields preview */}
              {expandedId === m.id && (
                <div className="border-t border-border px-5 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted border-b border-border">
                          <th className="pb-2 pr-3">Key</th>
                          <th className="pb-2 pr-3">Label</th>
                          <th className="pb-2 pr-3">Keywords</th>
                          <th className="pb-2 pr-3">Mode</th>
                          <th className="pb-2">Regex</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.fields.map((f, i) => (
                          <tr
                            key={i}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-2 pr-3 font-mono">{f.key}</td>
                            <td className="py-2 pr-3">{f.label}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {f.keywords?.map((kw, j) => (
                                  <span
                                    key={j}
                                    className="px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                f.extraction_mode === 'same_line' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : f.extraction_mode === 'next_line' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {f.extraction_mode === 'same_line' ? 'Same Line' : f.extraction_mode === 'next_line' ? 'Next Line' : 'Auto'}
                              </span>
                            </td>
                            <td className="py-2 font-mono text-muted max-w-[200px] truncate">
                              {f.regex || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit/Create Modal */}
      {editingMapping && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditingMapping(null)}
        >
          <div
            className="bg-card w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">
                {isNew ? "New Field Mapping" : `Edit: ${editingMapping.name}`}
              </h3>
              <button
                onClick={() => setEditingMapping(null)}
                className="p-2 hover:bg-background rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="bg-danger-light border border-danger/20 text-danger rounded-lg px-4 py-2 text-sm">
                  {error}
                </div>
              )}

              {/* Name + Active */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Mapping Name
                  </label>
                  <input
                    type="text"
                    value={editingMapping.name || ""}
                    onChange={(e) =>
                      setEditingMapping({ ...editingMapping, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    placeholder="e.g. Passport (Default)"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingMapping.is_active ?? true}
                      onChange={(e) =>
                        setEditingMapping({
                          ...editingMapping,
                          is_active: e.target.checked,
                        })
                      }
                      className="rounded border-border"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-muted">
                    Fields ({editingMapping.fields?.length || 0})
                  </label>
                  <button
                    onClick={addField}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Field
                  </button>
                </div>

                <div className="space-y-3">
                  {editingMapping.fields?.map((field, i) => (
                    <div
                      key={i}
                      className="p-4 bg-background rounded-lg border border-border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted">
                          Field #{i + 1}
                        </span>
                        <button
                          onClick={() => removeField(i)}
                          className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted mb-1">
                            Key (snake_case)
                          </label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) =>
                              updateField(i, { key: e.target.value })
                            }
                            className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm font-mono"
                            placeholder="full_name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">
                            Label
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              updateField(i, { label: e.target.value })
                            }
                            className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm"
                            placeholder="Full Name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">
                          Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={field.keywords?.join(", ") || ""}
                          onChange={(e) =>
                            updateField(i, {
                              keywords: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm"
                          placeholder="Name:, Full Name:, Given Name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">
                          Regex (optional — group 1 = value)
                        </label>
                        <input
                          type="text"
                          value={field.regex || ""}
                          onChange={(e) =>
                            updateField(i, {
                              regex: e.target.value || null,
                            })
                          }
                          className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm font-mono"
                          placeholder="(?:Name)\s*[:：]?\s*(.+)"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">
                          Extraction Mode
                        </label>
                        <select
                          value={field.extraction_mode || "auto"}
                          onChange={(e) =>
                            updateField(i, {
                              extraction_mode: e.target.value as FieldDef["extraction_mode"],
                            })
                          }
                          className="w-full px-3 py-1.5 bg-card border border-border rounded text-sm"
                        >
                          <option value="auto">Auto (try both)</option>
                          <option value="same_line">Same Line — value on same line as label</option>
                          <option value="next_line">Next Line — value on line below label</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detection Landmarks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-muted">
                    Detection Landmarks ({editingMapping.detection_landmarks?.length || 0})
                  </label>
                  <button
                    onClick={() => {
                      if (!editingMapping) return;
                      setEditingMapping({
                        ...editingMapping,
                        detection_landmarks: [
                          ...(editingMapping.detection_landmarks || []),
                          { type: "keyword", value: "", weight: 30 },
                        ],
                      });
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Landmark
                  </button>
                </div>

                <p className="text-xs text-muted mb-3">
                  Landmarks help auto-detect which template to use. The system scores OCR text against these rules and picks the best match.
                </p>

                <div className="space-y-2">
                  {(editingMapping.detection_landmarks || []).map((lm, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border"
                    >
                      <select
                        value={lm.type}
                        onChange={(e) => {
                          const landmarks = [...(editingMapping.detection_landmarks || [])];
                          landmarks[i] = { ...landmarks[i], type: e.target.value as LandmarkDef["type"] };
                          if (e.target.value === "mrz") landmarks[i].value = null;
                          setEditingMapping({ ...editingMapping, detection_landmarks: landmarks });
                        }}
                        className="px-2 py-1.5 bg-card border border-border rounded text-xs w-32"
                      >
                        <option value="mrz">MRZ</option>
                        <option value="keyword">Keyword</option>
                        <option value="not_keyword">Not Keyword</option>
                        <option value="regex">Regex</option>
                      </select>

                      {lm.type !== "mrz" && (
                        <input
                          type="text"
                          value={lm.value || ""}
                          onChange={(e) => {
                            const landmarks = [...(editingMapping.detection_landmarks || [])];
                            landmarks[i] = { ...landmarks[i], value: e.target.value };
                            setEditingMapping({ ...editingMapping, detection_landmarks: landmarks });
                          }}
                          placeholder={lm.type === "regex" ? "regex pattern" : "keyword text"}
                          className="flex-1 px-2 py-1.5 bg-card border border-border rounded text-xs"
                        />
                      )}

                      {lm.type === "mrz" && (
                        <span className="flex-1 text-xs text-muted italic">
                          Detects MRZ lines (passport machine-readable zone)
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">W:</span>
                        <input
                          type="number"
                          value={lm.weight}
                          onChange={(e) => {
                            const landmarks = [...(editingMapping.detection_landmarks || [])];
                            landmarks[i] = { ...landmarks[i], weight: parseInt(e.target.value) || 0 };
                            setEditingMapping({ ...editingMapping, detection_landmarks: landmarks });
                          }}
                          className="w-16 px-2 py-1.5 bg-card border border-border rounded text-xs text-center"
                          min={-200}
                          max={200}
                        />
                      </div>

                      <button
                        onClick={() => {
                          const landmarks = (editingMapping.detection_landmarks || []).filter((_, j) => j !== i);
                          setEditingMapping({ ...editingMapping, detection_landmarks: landmarks });
                        }}
                        className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setEditingMapping(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
