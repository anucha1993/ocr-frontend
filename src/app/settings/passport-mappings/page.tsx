"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Pencil, X, GripVertical,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const AVAILABLE_FIELDS = [
  { value: "doc_type", label: "Document Type" },
  { value: "issuing_country", label: "Issuing Country" },
  { value: "firstname", label: "ชื่อ (Given Name)" },
  { value: "lastname", label: "นามสกุล (Surname)" },
  { value: "passport_no", label: "หมายเลข Passport" },
  { value: "nationality", label: "สัญชาติ" },
  { value: "birthdate", label: "วันเกิด" },
  { value: "gender", label: "เพศ" },
  { value: "expiry_date", label: "วันหมดอายุ" },
  { value: "issue_date", label: "วันออกเอกสาร" },
  { value: "personal_no", label: "เลขประจำตัว" },
  { value: "issue_place", label: "สถานที่ออก" },
  { value: "address", label: "ที่อยู่" },
  { value: "prefix", label: "คำนำหน้า" },
  { value: "middlename", label: "ชื่อกลาง" },
  { value: "_skip", label: "— ข้ามช่องนี้ —" },
];

interface FieldMapEntry {
  index: number;
  field: string;
}

interface Mapping {
  id?: number;
  name: string;
  doc_type_code: string;
  country_code: string;
  field_map: FieldMapEntry[];
  date_format: string;
  separator: string;
  is_active: boolean;
}

const emptyMapping: Mapping = {
  name: "",
  doc_type_code: "",
  country_code: "",
  field_map: [
    { index: 0, field: "doc_type" },
    { index: 1, field: "issuing_country" },
  ],
  date_format: "YYMMDD",
  separator: "#",
  is_active: true,
};

export default function PassportMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/passport-mappings`, {
        headers: { "Accept": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setMappings(data);
      }
    } catch {
      showMsg("error", "ไม่สามารถโหลด Mapping ได้");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name || !editing.doc_type_code || !editing.country_code) {
      showMsg("error", "กรุณากรอกชื่อ, Doc Type Code และ Country Code");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...editing,
        field_map: editing.field_map.filter((f) => f.field !== "_skip"),
      };
      const isNew = !editing.id;
      const url = isNew
        ? `${API_URL}/passport-mappings`
        : `${API_URL}/passport-mappings/${editing.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      showMsg("success", isNew ? "สร้าง Mapping สำเร็จ" : "บันทึก Mapping สำเร็จ");
      setEditing(null);
      fetchMappings();
    } catch (err) {
      showMsg("error", `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ต้องการลบ Mapping นี้?")) return;
    try {
      const res = await fetch(`${API_URL}/passport-mappings/${id}`, {
        method: "DELETE",
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) throw new Error("Delete failed");
      showMsg("success", "ลบ Mapping สำเร็จ");
      fetchMappings();
    } catch {
      showMsg("error", "ลบไม่สำเร็จ");
    }
  };

  const addField = () => {
    if (!editing) return;
    const nextIndex = editing.field_map.length > 0
      ? Math.max(...editing.field_map.map((f) => f.index)) + 1
      : 0;
    setEditing({
      ...editing,
      field_map: [...editing.field_map, { index: nextIndex, field: "_skip" }],
    });
  };

  const removeField = (idx: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      field_map: editing.field_map.filter((_, i) => i !== idx),
    });
  };

  const updateField = (idx: number, key: "index" | "field", value: string | number) => {
    if (!editing) return;
    const newMap = [...editing.field_map];
    newMap[idx] = { ...newMap[idx], [key]: value };
    setEditing({ ...editing, field_map: newMap });
  };

  /* ── Test parsing ── */
  const runTest = () => {
    if (!editing || !testInput) return;
    const sep = editing.separator || "#";
    const parts = testInput.split(sep);
    const result: Record<string, string> = {};
    editing.field_map.forEach((fm) => {
      if (fm.field === "_skip") return;
      const val = parts[fm.index] || "";
      if (fm.field === "birthdate" || fm.field === "expiry_date" || fm.field === "issue_date") {
        result[fm.field] = formatTestDate(val, editing.date_format);
      } else if (fm.field === "gender") {
        result[fm.field] = val === "M" ? "ชาย (M)" : val === "F" ? "หญิง (F)" : val;
      } else {
        result[fm.field] = val;
      }
    });
    // Show unmapped fields
    parts.forEach((p, i) => {
      const mapped = editing.field_map.find((f) => f.index === i);
      if (!mapped) result[`[${i}] unmapped`] = p;
    });
    setTestResult(result);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Passport Field Mapping</h1>
          <p className="text-sm text-muted mt-1">
            กำหนด Mapping ข้อมูลจากเครื่องอ่าน Passport สำหรับแต่ละสัญชาติ
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing({ ...emptyMapping })}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Mapping
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
          message.type === "success" ? "bg-success-light text-green-800" : "bg-danger-light text-red-800"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {editing.id ? "แก้ไข Mapping" : "เพิ่ม Mapping ใหม่"}
            </h2>
            <button onClick={() => { setEditing(null); setTestResult(null); setTestInput(""); }}
              className="p-1 text-muted hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">ชื่อ Mapping</label>
                <input type="text" className="form-input" placeholder="e.g. Thai Passport"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Doc Type Code</label>
                <input type="text" className="form-input" placeholder="e.g. P, PJ"
                  value={editing.doc_type_code}
                  onChange={(e) => setEditing({ ...editing, doc_type_code: e.target.value.toUpperCase() })} />
                <p className="text-xs text-muted mt-1">ค่าแรกของข้อมูล (index 0)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Country Code</label>
                <input type="text" className="form-input" placeholder="e.g. THA, MMR"
                  value={editing.country_code}
                  onChange={(e) => setEditing({ ...editing, country_code: e.target.value.toUpperCase() })} />
                <p className="text-xs text-muted mt-1">ค่าที่สองของข้อมูล (index 1)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">ตัวคั่น (Separator)</label>
                <input type="text" className="form-input w-20" maxLength={5}
                  value={editing.separator}
                  onChange={(e) => setEditing({ ...editing, separator: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">รูปแบบวันที่</label>
                <select className="form-input"
                  value={editing.date_format}
                  onChange={(e) => setEditing({ ...editing, date_format: e.target.value })}>
                  <option value="YYMMDD">YYMMDD (e.g. 930416)</option>
                  <option value="YYYYMMDD">YYYYMMDD (e.g. 19930416)</option>
                  <option value="DDMMYY">DDMMYY (e.g. 160493)</option>
                  <option value="DDMMYYYY">DDMMYYYY (e.g. 16041993)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border text-primary"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                  <span className="text-sm font-medium text-foreground">เปิดใช้งาน</span>
                </label>
              </div>
            </div>

            {/* Field mapping table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-foreground">Field Mapping</label>
                <button onClick={addField}
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> เพิ่ม Field
                </button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted w-24">Index</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted">Field</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted w-16">ลบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.field_map.map((fm, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted">
                          <GripVertical className="w-4 h-4" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={0}
                            className="form-input w-16 text-center text-sm"
                            value={fm.index}
                            onChange={(e) => updateField(i, "index", parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="px-3 py-2">
                          <select className="form-input text-sm"
                            value={fm.field}
                            onChange={(e) => updateField(i, "field", e.target.value)}>
                            {AVAILABLE_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeField(i)}
                            className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Test area */}
            <div className="bg-background rounded-lg border border-border p-4">
              <label className="text-sm font-semibold text-foreground mb-2 block">ทดสอบ Mapping</label>
              <div className="flex gap-2">
                <input type="text" className="form-input flex-1 font-mono text-xs"
                  placeholder="วางข้อมูลดิบ เช่น P#THA#YOTHANAN#ANUCHA#AD1183103#THA#930416#M#281007#1339900294349"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)} />
                <button onClick={runTest}
                  disabled={!testInput}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors">
                  ทดสอบ
                </button>
              </div>
              {testResult && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(testResult).map(([key, val]) => (
                    <div key={key} className="bg-card rounded-lg px-3 py-2 border border-border">
                      <dt className="text-[10px] text-muted">{AVAILABLE_FIELDS.find((f) => f.value === key)?.label || key}</dt>
                      <dd className="text-sm font-medium text-foreground">{val || "-"}</dd>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setEditing(null); setTestResult(null); setTestInput(""); }}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping list */}
      {!editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mappings.length === 0 ? (
            <div className="md:col-span-2 bg-card rounded-xl border border-border p-12 text-center">
              <p className="text-muted text-sm">ยังไม่มี Mapping — กดปุ่ม &quot;เพิ่ม Mapping&quot; เพื่อเริ่มต้น</p>
            </div>
          ) : (
            mappings.map((m) => (
              <div key={m.id} className={`bg-card rounded-xl border p-5 ${m.is_active ? "border-border" : "border-border opacity-60"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
                        {m.doc_type_code}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono">
                        {m.country_code}
                      </span>
                      {!m.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">ปิดใช้งาน</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing({ ...m }); setTestResult(null); setTestInput(""); }}
                      className="p-1.5 text-muted hover:text-primary transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => m.id && handleDelete(m.id)}
                      className="p-1.5 text-muted hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-muted space-y-1">
                  <p>ตัวคั่น: <span className="font-mono text-foreground">{m.separator}</span> | วันที่: <span className="font-mono text-foreground">{m.date_format}</span></p>
                  <p>
                    Fields: {(m.field_map || [])
                      .filter((f: FieldMapEntry) => f.field !== "doc_type" && f.field !== "issuing_country" && f.field !== "_skip")
                      .map((f: FieldMapEntry) => AVAILABLE_FIELDS.find((a) => a.value === f.field)?.label || f.field)
                      .join(", ")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatTestDate(raw: string, fmt: string): string {
  if (!raw) return "-";
  try {
    if (fmt === "YYMMDD" && raw.length >= 6) {
      const yy = parseInt(raw.substring(0, 2));
      const y = yy > 50 ? `19${raw.substring(0, 2)}` : `20${raw.substring(0, 2)}`;
      return `${raw.substring(4, 6)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "YYYYMMDD" && raw.length >= 8) {
      return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
    }
    if (fmt === "DDMMYY" && raw.length >= 6) {
      const yy = parseInt(raw.substring(4, 6));
      const y = yy > 50 ? `19${raw.substring(4, 6)}` : `20${raw.substring(4, 6)}`;
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "DDMMYYYY" && raw.length >= 8) {
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${raw.substring(4, 8)}`;
    }
  } catch { /* ignore */ }
  return raw;
}
