"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  ScanSearch,
  Loader2,
  Plus,
  Minus,
  Save,
  X,
  FileText,
  Pencil,
  Trash2,
  Eye,
  Copy,
} from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";

/* ── Types ────────────────────────────────────── */

interface DetectedPair {
  key: string;
  value: string;
}

type TransformType = "remove_spaces" | "uppercase" | "lowercase" | "trim" | "digits_only" | "alphanumeric" | "normalize_gender" | "normalize_nationality";

const TRANSFORM_OPTIONS: { value: TransformType; label: string }[] = [
  { value: "remove_spaces", label: "ตัดวรรค" },
  { value: "uppercase", label: "พิมพ์ใหญ่" },
  { value: "lowercase", label: "พิมพ์เล็ก" },
  { value: "trim", label: "ตัดช่องว่างหัวท้าย" },
  { value: "digits_only", label: "ตัวเลขเท่านั้น" },
  { value: "alphanumeric", label: "ตัวอักษร+เลข" },
  { value: "normalize_gender", label: "แปลงเพศ (M→Male)" },
  { value: "normalize_nationality", label: "แก้สัญชาติ (LA0→LAO)" },
];

const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ไม่แปลง" },
  { value: "date:DD/MM/YYYY", label: "วันที่ DD/MM/YYYY (ค.ศ.)" },
  { value: "date:YYYY-MM-DD", label: "วันที่ YYYY-MM-DD (ค.ศ.)" },
  { value: "date:DD/MM/YYYY+543", label: "วันที่ DD/MM/YYYY (พ.ศ.)" },
  { value: "date:DD MON YYYY", label: "วันที่ DD MON YYYY" },
  { value: "date:DD MON YYYY+543", label: "วันที่ DD MON YYYY (พ.ศ.)" },
  { value: "date:DD เดือนไทย YYYY+543", label: "วันที่ DD เดือนไทย พ.ศ." },
];

interface MappingRow {
  sourceKey: string;
  targetField: string;
  extractionMode: "auto" | "same_line" | "next_line";
  transform: TransformType[];
  format: string;
}

interface FieldDef {
  key: string;
  label: string;
  keywords: string[];
  regex: string | null;
  extraction_mode: "auto" | "same_line" | "next_line";
  transform?: TransformType[];
  format?: string;
}

interface LandmarkDef {
  type: "mrz" | "keyword" | "regex" | "not_keyword";
  value: string | null;
  weight: number;
}

interface SavedTemplate {
  id: number;
  name: string;
  fields: FieldDef[];
  detection_landmarks: LandmarkDef[] | null;
  is_active: boolean;
  created_at: string;
}

/* ── Component ────────────────────────────────── */

export default function OcrTemplatesPage() {
  // Template list
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");

  // Preview / OCR
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [detectedPairs, setDetectedPairs] = useState<DetectedPair[]>([]);
  const [pageCount, setPageCount] = useState(0);

  // Field mapping rows
  const [mappings, setMappings] = useState<MappingRow[]>([]);

  // Detection landmarks
  const [landmarks, setLandmarks] = useState<LandmarkDef[]>([]);

  // Save
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // View raw text
  const [showRawText, setShowRawText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Load templates ─────────────────────────── */

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await apiFetch("/ocr/field-mappings");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  /* ── Builder helpers ────────────────────────── */

  const openNewBuilder = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setPreviewFile(null);
    setPreviewUrl(null);
    setRawText(null);
    setDetectedPairs([]);
    setMappings([]);
    setLandmarks([]);
    setPageCount(0);
    setError(null);
    setSuccess(null);
    setBuilderOpen(true);
  };

  const openEditBuilder = (t: SavedTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateName(t.name);
    setPreviewFile(null);
    setPreviewUrl(null);
    setRawText(null);
    setDetectedPairs([]);
    setPageCount(0);
    setError(null);
    setSuccess(null);

    // Reconstruct mapping rows from saved fields
    const rows: MappingRow[] = t.fields.map((f) => ({
      sourceKey: f.keywords?.[0] || f.label,
      targetField: f.key,
      extractionMode: f.extraction_mode || "auto",
      transform: f.transform || [],
      format: f.format || "",
    }));
    setMappings(rows);
    setLandmarks(t.detection_landmarks ? t.detection_landmarks.map((l) => ({ ...l })) : []);
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };

  /* ── File upload + Extract ──────────────────── */

  const handleFileSelect = (file: File) => {
    setPreviewFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null); // PDF — no image preview
    }

    // Reset extracted data
    setRawText(null);
    setDetectedPairs([]);
    setPageCount(0);
  };

  const handleExtract = async () => {
    if (!previewFile) return;
    setExtracting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", previewFile);

    try {
      const res = await apiUpload("/ocr/preview", formData);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Extraction failed");
        return;
      }

      setRawText(data.raw_text);
      setDetectedPairs(data.detected_pairs || []);
      setPageCount(data.page_count || 1);

      // Auto-populate mappings if empty
      if (mappings.length === 0 && data.detected_pairs?.length > 0) {
        setMappings(
          data.detected_pairs.map((p: DetectedPair) => ({
            sourceKey: p.key,
            targetField: toSnakeCase(p.key),
            extractionMode: "auto" as const,
            transform: [] as TransformType[],
            format: "",
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setExtracting(false);
    }
  };

  /* ── Mapping row operations ─────────────────── */

  const addMappingRow = () => {
    setMappings((prev) => [...prev, { sourceKey: "", targetField: "", extractionMode: "auto", transform: [], format: "" }]);
  };

  const removeMappingRow = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof MappingRow, value: string) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addDetectedToMapping = (pair: DetectedPair) => {
    // Check if already mapped
    if (mappings.some((m) => m.sourceKey === pair.key)) return;
    setMappings((prev) => [
      ...prev,
      { sourceKey: pair.key, targetField: toSnakeCase(pair.key), extractionMode: "auto", transform: [], format: "" },
    ]);
  };

  /* ── Save template ──────────────────────────── */

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError("กรุณาใส่ชื่อแม่แบบ");
      return;
    }
    if (mappings.length === 0) {
      setError("กรุณาเพิ่มการจับคู่อย่างน้อย 1 รายการ");
      return;
    }

    const validMappings = mappings.filter(
      (m) => m.sourceKey.trim() && m.targetField.trim()
    );
    if (validMappings.length === 0) {
      setError("แถวการจับคู่ทุกแถวว่างเปล่า");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    // Convert mapping rows to field definitions
    const fields = validMappings.map((m) => ({
      key: m.targetField,
      label: m.sourceKey,
      keywords: [m.sourceKey],
      regex: null,
      extraction_mode: m.extractionMode,
      ...(m.transform.length > 0 ? { transform: m.transform } : {}),
      ...(m.format ? { format: m.format } : {}),
    }));

    const body = {
      name: templateName,
      fields,
      detection_landmarks: landmarks.length > 0 ? landmarks : null,
      is_active: true,
    };

    try {
      let res;
      if (editingTemplateId) {
        res = await apiFetch(`/ocr/field-mappings/${editingTemplateId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch("/ocr/field-mappings", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }

      setSuccess("บันทึกแม่แบบเรียบร้อยแล้ว!");
      fetchTemplates();
      setTimeout(() => closeBuilder(), 1000);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ลบแม่แบบนี้?")) return;
    await apiFetch(`/ocr/field-mappings/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="w-7 h-7 text-primary" />
            แม่แบบ OCR
          </h1>
          <p className="text-sm text-muted mt-1">
            อัปโหลดเอกสารตัวอย่าง ดึงข้อมูล และกำหนดการจับคู่แพทเพื่อสร้างแม่แบบที่ใช้ซ้ำได้
          </p>
        </div>
        <button
          onClick={openNewBuilder}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          แม่แบบใหม่
        </button>
      </div>

      {/* Template List */}
      <div className="space-y-3">
        {loadingTemplates ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-card rounded-xl border border-border text-center py-20">
            <ScanSearch className="w-12 h-12 mx-auto text-muted mb-3" />
            <p className="text-muted text-sm">ยังไม่มีแม่แบบ</p>
            <p className="text-muted text-xs mt-1">
              สร้างโดยอัปโหลดเอกสารตัวอย่าง
            </p>
          </div>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-xl border border-border p-5 flex items-center justify-between hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t.name}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {t.fields.length} ฟิลด์ •{" "}
                    {(t.detection_landmarks?.length || 0) > 0 && (
                      <>{t.detection_landmarks!.length} ไมล์ส์โตน •{" "}</>
                    )}
                    <span className={t.is_active ? "text-success" : "text-muted"}>
                      {t.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>{" "}
                    • สร้าง {new Date(t.created_at).toLocaleDateString("th-TH")}
                  </p>
                  {/* Field pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {t.fields.slice(0, 6).map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-background rounded border border-border"
                      >
                        {f.label}
                      </span>
                    ))}
                    {t.fields.length > 6 && (
                      <span className="px-2 py-0.5 text-xs text-muted">
                        +{t.fields.length - 6} เพิ่มเติม
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditBuilder(t)}
                  className="p-2 rounded-lg hover:bg-primary/10 text-muted hover:text-primary"
                  title="แก้ไข"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 rounded-lg hover:bg-danger/10 text-muted hover:text-danger"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Builder Modal ──────────────────────── */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 overflow-y-auto">
          <div
            className="bg-card w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden mb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingTemplateId ? "แก้ไขแม่แบบ" : "สร้างแม่แบบ OCR"}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  อัปโหลดภาพตัวอย่าง ดึงข้อมูล และจับคู่ฟิลด์เพื่อบันทึกเป็นแม่แบบ
                </p>
              </div>
              <button
                onClick={closeBuilder}
                className="p-2 hover:bg-background rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body — two columns */}
            <div className="flex flex-col lg:flex-row">
              {/* ── Left: Upload + Extracted Data ── */}
              <div className="lg:w-[420px] border-r border-border p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Upload area */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-2">
                    เอกสารตัวอย่าง
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-background transition-all"
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg border border-border"
                      />
                    ) : previewFile ? (
                      <div className="py-4">
                        <FileText className="w-10 h-10 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium truncate">
                          {previewFile.name}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {previewFile.type.includes("pdf") ? "PDF" : "Image"} •{" "}
                          {(previewFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted mb-2" />
                        <p className="text-sm text-muted">
                          คลิกเพื่ออัปโหลดเอกสาร
                        </p>
                        <p className="text-xs text-muted mt-1">
                          PDF, JPG, PNG
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {previewFile && (
                    <button
                      onClick={handleExtract}
                      disabled={extracting}
                      className="w-full mt-3 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {extracting ? (
                      <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          กำลังดึงข้อมูล...
                        </>
                      ) : (
                        <>
                          <ScanSearch className="w-4 h-4" />
                          ดึงข้อมูล
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Extracted Data */}
                {detectedPairs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">ข้อมูลที่สกัดได้</h3>
                      <span className="text-xs text-muted">
                        {pageCount} หน้า • {detectedPairs.length} ฟิลด์
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {detectedPairs.map((pair, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 group"
                        >
                          <div className="flex-1 px-3 py-2 bg-background rounded-lg border border-border text-sm">
                            <span className="text-primary font-medium">
                              {pair.key}
                            </span>
                            <span className="text-muted mx-1">:</span>
                            <span>{pair.value}</span>
                          </div>
                          <button
                            onClick={() => addDetectedToMapping(pair)}
                            className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="เพิ่มไปยังการจับคู่"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Toggle raw text */}
                    <button
                      onClick={() => setShowRawText(!showRawText)}
                      className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      {showRawText ? "ซ่อน" : "แสดง"} ข้อความ OCR ดิบ
                    </button>

                    {showRawText && rawText && (
                      <pre className="mt-2 p-3 bg-background rounded-lg border border-border text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                        {rawText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* ── Right: Field Mapping ── */}
              <div className="flex-1 p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Template name */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    ชื่อแม่แบบ
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="เช่น Myanmar Passport, Thai ID Card"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  />
                </div>

                {/* Mapping table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">การจับคู่ฟิลด์</h3>
                    <div className="flex items-center gap-3">
                      {mappings.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const mode = e.target.value as MappingRow["extractionMode"];
                            if (!mode) return;
                            setMappings((prev) => prev.map((m) => ({ ...m, extractionMode: mode })));
                          }}
                          className="px-2 py-1 bg-background border border-border rounded text-xs"
                        >
                          <option value="">กำหนดโหมดทั้งหมด...</option>
                          <option value="auto">อัตโนมัติ</option>
                          <option value="same_line">บรรทัดเดียวกัน</option>
                          <option value="next_line">บรรทัดถัดไป</option>
                        </select>
                      )}
                      <button
                        onClick={addMappingRow}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Plus className="w-3 h-3" /> เพิ่มแถว
                      </button>
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_40px_1fr_120px_40px] gap-2 mb-2 px-1">
                    <span className="text-xs font-medium text-muted">
                      คีย์สำหรับดึงค่า
                    </span>
                    <span />
                    <span className="text-xs font-medium text-muted">
                      ฟิลด์ผลลัพธ์
                    </span>
                    <span className="text-xs font-medium text-muted">
                      โหมด
                    </span>
                    <span />
                  </div>

                  {/* Rows */}
                  <div className="space-y-2">
                    {mappings.length === 0 ? (
                      <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-xl">
                        {detectedPairs.length > 0
                          ? "คลิก + บนข้อมูลที่ดึงได้เพื่อเพิ่มการจับคู่"
                          : "อัปโหลดและดึงข้อมูลก่อน หรือเพิ่มแถวด้วยตนเอง"}
                      </div>
                    ) : (
                      mappings.map((row, i) => (
                        <div
                          key={i}
                          className="border border-border rounded-lg p-2 space-y-2 bg-background/30"
                        >
                          {/* Row 1: key → field, mode, remove */}
                          <div className="grid grid-cols-[1fr_40px_1fr_120px_40px] gap-2 items-center">
                          {/* Source key with dropdown */}
                          <div className="relative">
                            <input
                              type="text"
                              value={row.sourceKey}
                              onChange={(e) =>
                                updateMapping(i, "sourceKey", e.target.value)
                              }
                              placeholder="คีย์ OCR"
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm pr-8"
                              list={`source-keys-${i}`}
                            />
                            {detectedPairs.length > 0 && (
                              <datalist id={`source-keys-${i}`}>
                                {detectedPairs.map((p, j) => (
                                  <option key={j} value={p.key} />
                                ))}
                              </datalist>
                            )}
                            {/* Copy icon */}
                            <Copy className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                          </div>

                          {/* Arrow */}
                          <div className="flex items-center justify-center text-muted">
                            →
                          </div>

                          {/* Target field */}
                          <input
                            type="text"
                            value={row.targetField}
                            onChange={(e) =>
                              updateMapping(i, "targetField", e.target.value)
                            }
                            placeholder="ชื่อ_ฟิลด์"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
                          />

                          {/* Extraction mode */}
                          <select
                            value={row.extractionMode}
                            onChange={(e) => {
                              const updated = [...mappings];
                              updated[i] = { ...updated[i], extractionMode: e.target.value as MappingRow["extractionMode"] };
                              setMappings(updated);
                            }}
                            className="w-full px-1.5 py-2 bg-background border border-border rounded-lg text-xs"
                            title="Extraction mode"
                          >
                            <option value="auto">อัตโนมัติ</option>
                            <option value="same_line">บรรทัดเดียวกัน</option>
                            <option value="next_line">บรรทัดถัดไป</option>
                          </select>

                          {/* Remove button */}
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => removeMappingRow(i)}
                              className="p-1.5 rounded-full hover:bg-danger/10 text-muted hover:text-danger transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                          </div>

                          {/* Row 2: Transform + Format (optional row, shown inline) */}
                          <div className="flex items-start gap-3 pl-1">
                            {/* Transform */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted font-medium shrink-0">แปลงค่า:</span>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const val = e.target.value as TransformType;
                                    if (!val) return;
                                    setMappings((prev) => {
                                      const updated = [...prev];
                                      const cur = updated[i].transform || [];
                                      if (!cur.includes(val)) {
                                        updated[i] = { ...updated[i], transform: [...cur, val] };
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="px-1.5 py-1 bg-background border border-border rounded text-[11px]"
                                >
                                  <option value="">{row.transform.length > 0 ? "เพิ่ม..." : "ไม่แปลง"}</option>
                                  {TRANSFORM_OPTIONS.filter((t) => !row.transform.includes(t.value)).map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                                {row.transform.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {row.transform.map((t) => (
                                      <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                                        {TRANSFORM_OPTIONS.find((o) => o.value === t)?.label}
                                        <button
                                          onClick={() => {
                                            setMappings((prev) => {
                                              const updated = [...prev];
                                              updated[i] = { ...updated[i], transform: updated[i].transform.filter((x) => x !== t) };
                                              return updated;
                                            });
                                          }}
                                          className="ml-0.5 hover:text-danger"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Format */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted font-medium">รูปแบบ:</span>
                              <select
                                value={row.format}
                                onChange={(e) => {
                                  setMappings((prev) => {
                                    const updated = [...prev];
                                    updated[i] = { ...updated[i], format: e.target.value };
                                    return updated;
                                  });
                                }}
                                className="px-1.5 py-1 bg-background border border-border rounded text-[11px]"
                              >
                                {FORMAT_OPTIONS.map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {mappings.length > 0 && (
                    <button
                      onClick={addMappingRow}
                      className="mt-3 w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> เพิ่มฟิลด์
                    </button>
                  )}
                </div>

                {/* Detection Landmarks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">
                      จุดสังเกตการจดจำแม่แบบ
                      <span className="text-xs text-muted font-normal ml-1">({landmarks.length})</span>
                    </h3>
                    <button
                      onClick={() =>
                        setLandmarks((prev) => [...prev, { type: "keyword", value: "", weight: 30 }])
                      }
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>

                  <p className="text-xs text-muted mb-3">
                    จุดสังเกตช่วยให้ระบบเลือกแม่แบบที่ถูกต้องโดยอัตโนมัติ
                  </p>

                  <div className="space-y-2">
                    {landmarks.map((lm, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border"
                      >
                        <select
                          value={lm.type}
                          onChange={(e) => {
                            const next = [...landmarks];
                            next[i] = { ...next[i], type: e.target.value as LandmarkDef["type"] };
                            if (e.target.value === "mrz") next[i].value = null;
                            setLandmarks(next);
                          }}
                          className="px-2 py-1.5 bg-card border border-border rounded text-xs w-28"
                        >
                          <option value="mrz">MRZ</option>
                          <option value="keyword">Keyword</option>
                          <option value="not_keyword">Not Keyword</option>
                          <option value="regex">Regex</option>
                        </select>

                        {lm.type !== "mrz" ? (
                          <input
                            type="text"
                            value={lm.value || ""}
                            onChange={(e) => {
                              const next = [...landmarks];
                              next[i] = { ...next[i], value: e.target.value };
                              setLandmarks(next);
                            }}
                            placeholder={lm.type === "regex" ? "รูปแบบ regex" : "คีย์เวิร์ด"}
                            className="flex-1 px-2 py-1.5 bg-card border border-border rounded text-xs"
                          />
                        ) : (
                          <span className="flex-1 text-xs text-muted italic">
                            ตรวจจับ MRZ (เครื่องอ่านหนังสือเดินทาง)
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted">W:</span>
                          <input
                            type="number"
                            value={lm.weight}
                            onChange={(e) => {
                              const next = [...landmarks];
                              next[i] = { ...next[i], weight: parseInt(e.target.value) || 0 };
                              setLandmarks(next);
                            }}
                            className="w-14 px-2 py-1.5 bg-card border border-border rounded text-xs text-center"
                            min={-200}
                            max={200}
                          />
                        </div>

                        <button
                          onClick={() => setLandmarks((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {landmarks.length === 0 && (
                      <div className="text-center py-4 text-xs text-muted border border-dashed border-border rounded-lg">
                        ไม่มีจุดสังเกต — แม่แบบจะไม่ถูกตรวจจับโดยอัตโนมัติ
                      </div>
                    )}
                  </div>
                </div>

                {/* Errors / Success */}
                {error && (
                  <div className="bg-danger-light border border-danger/20 text-danger rounded-lg px-4 py-2 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-success/10 border border-success/20 text-success rounded-lg px-4 py-2 text-sm">
                    {success}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={closeBuilder}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────── */

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}
