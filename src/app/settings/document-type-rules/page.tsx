"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Save, Calculator } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Rule {
  id: number;
  document_type: string;
  label: string;
  validity_years: number;
  offset_days: number;
  is_active: boolean;
}

const emptyRule: Omit<Rule, "id"> = {
  document_type: "",
  label: "",
  validity_years: 5,
  offset_days: -1,
  is_active: true,
};

export default function DocumentTypeRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/document-type-rules");
      if (res.ok) setRules(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openNew = () => {
    setEditing({ id: 0, ...emptyRule });
    setIsNew(true);
  };

  const openEdit = (rule: Rule) => {
    setEditing({ ...rule });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {
        document_type: editing.document_type.trim().toUpperCase(),
        label: editing.label.trim(),
        validity_years: editing.validity_years,
        offset_days: editing.offset_days,
        is_active: editing.is_active,
      };
      const url = isNew ? "/document-type-rules" : `/document-type-rules/${editing.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "บันทึกไม่สำเร็จ");
        return;
      }
      setEditing(null);
      fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`ลบกฎ "${rule.label}" ?`)) return;
    await apiFetch(`/document-type-rules/${rule.id}`, { method: "DELETE" });
    fetchRules();
  };

  const describeFormula = (r: Rule) => {
    if (r.offset_days === 0) {
      return `วันออกบัตร = วันหมดอายุ − ${r.validity_years} ปี`;
    }
    const absOffset = Math.abs(r.offset_days);
    const sign = r.offset_days > 0 ? "+" : "−";
    return `วันออกบัตร = วันหมดอายุ − ${r.validity_years} ปี ${sign} ${absOffset} วัน`;
  };

  // Live preview: given expiry = 25/09/2024
  const previewCalc = (r: Rule) => {
    const expiry = new Date(2024, 8, 25); // 25 Sep 2024 (month 0-indexed)
    const issue = new Date(expiry);
    issue.setFullYear(issue.getFullYear() - r.validity_years);
    issue.setDate(issue.getDate() - r.offset_days);
    const dd = String(issue.getDate()).padStart(2, "0");
    const mm = String(issue.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${issue.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-primary" />
            คำนวณวันออกบัตรอัตโนมัติ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            กำหนดสูตรคำนวณ Date of Issue จาก Date of Expiry ตามประเภทเอกสาร — ใช้กับ /id-card-reader
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition font-medium">
          <Plus className="w-4 h-4" /> เพิ่มกฎใหม่
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-slate-400">ยังไม่มีกฎ — กดเพิ่มเพื่อเริ่มต้น</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500">
                <th className="px-5 py-3 text-left font-medium">ประเภทเอกสาร</th>
                <th className="px-4 py-3 text-left font-medium">ชื่อแสดง</th>
                <th className="px-4 py-3 text-center font-medium">อายุ (ปี)</th>
                <th className="px-4 py-3 text-center font-medium">Offset (วัน)</th>
                <th className="px-4 py-3 text-left font-medium">สูตรคำนวณ</th>
                <th className="px-4 py-3 text-center font-medium">ตัวอย่าง</th>
                <th className="px-4 py-3 text-center font-medium">สถานะ</th>
                <th className="px-4 py-3 text-center font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3 font-mono font-bold text-primary">{r.document_type}</td>
                  <td className="px-4 py-3">{r.label}</td>
                  <td className="px-4 py-3 text-center">{r.validity_years}</td>
                  <td className="px-4 py-3 text-center">{r.offset_days}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{describeFormula(r)}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    <span className="text-slate-400">หมดอายุ 25/09/2024 →</span>{" "}
                    <span className="font-medium text-green-700">{previewCalc(r)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.is_active ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="แก้ไข">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="ลบ">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>วิธีคิด:</strong> เมื่อเครื่องอ่าน MRZ อ่านได้ <code>expiry_date</code> + <code>document_type</code> → ระบบจะคำนวณ
        <code> issue_date = expiry_date − validity_years + offset_days</code><br />
        <strong>ตัวอย่าง PJ:</strong> หมดอายุ 25/09/2024, อายุ 5 ปี, offset -1 วัน → วันออก = 26/09/2019
      </div>

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">{isNew ? "เพิ่มกฎใหม่" : "แก้ไขกฎ"}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทเอกสาร (Document Type Code)</label>
                <input
                  value={editing.document_type}
                  onChange={(e) => setEditing({ ...editing, document_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="เช่น PJ, CI, P, PW, PINK"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อแสดง (Label)</label>
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="เช่น PJ (Passport for Job)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">อายุเอกสาร (ปี)</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={editing.validity_years}
                    onChange={(e) => setEditing({ ...editing, validity_years: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Offset (วัน)</label>
                  <input
                    type="number"
                    value={editing.offset_days}
                    onChange={(e) => setEditing({ ...editing, offset_days: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">0 = วันเกิดเดียวกัน, -1 = ก่อน 1 วัน</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">เปิดใช้งาน</label>
              </div>

              {/* Live preview */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                <div><strong>สูตร:</strong> {describeFormula(editing)}</div>
                <div className="mt-1">
                  <strong>Preview:</strong> หมดอายุ 25/09/2024 →{" "}
                  <span className="text-green-700 font-medium">วันออก {previewCalc(editing)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100">ยกเลิก</button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.document_type.trim() || !editing.label.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
