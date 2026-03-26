"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  X,
  ScanSearch,
  Save,
  Lock,
  Globe,
  Tag,
  ClipboardCopy,
} from "lucide-react";
import { apiFetch, apiUploadStream, API_BASE } from "@/lib/api";

interface FieldMapping {
  id: number;
  name: string;
  is_active: boolean;
}

interface OcrResultItem {
  id: number;
  batch_id: string;
  original_filename: string;
  file_type: string;
  page_count: number;
  page_number: number | null;
  raw_text: string | null;
  extracted_data: Record<string, string | null> | null;
  ocr_confidence: number | null;
  field_mapping?: { id: number; name: string } | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
}

interface SaveForm {
  batch_name: string;
  label: string;
  note: string;
  visibility: "private" | "public";
  selectedIds: Set<number>;
}

export default function OcrProcessPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<OcrResultItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingResult, setViewingResult] = useState<OcrResultItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showRawText, setShowRawText] = useState<"mapped" | "raw" | false>(false);
  const [templateUsed, setTemplateUsed] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [progress, setProgress] = useState<{
    file: string;
    fileIndex: number;
    fileTotal: number;
    page: number;
    totalPages: number;
    phase: "uploading" | "ocr" | "extracting" | "done";
  } | null>(null);
  // Save to labours
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({
    batch_name: "",
    label: "",
    note: "",
    visibility: "private",
    selectedIds: new Set(),
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/ocr/field-mappings")
      .then((r) => r.json())
      .then((data) => setFieldMappings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/bmp",
      "image/webp",
    ];
    const valid = Array.from(newFiles).filter((f) => allowed.includes(f.type));
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleProcess = async () => {
    if (files.length === 0) return;
    if (!selectedMappingId) {
      setError("กรุณาเลือกแม่แบบก่อนเริ่มสแกน");
      return;
    }
    setProcessing(true);
    setError(null);
    setResults([]);
    setBatchId(null);
    setProgress({ file: "", fileIndex: 0, fileTotal: files.length, page: 0, totalPages: 0, phase: "uploading" });

    const formData = new FormData();
    files.forEach((f) => formData.append("files[]", f));
    if (selectedMappingId) {
      formData.append("field_mapping_id", selectedMappingId);
    }

    try {
      await apiUploadStream("/ocr/process", formData, (event) => {
        const ev = event as Record<string, unknown>;
        switch (ev.event) {
          case "file_start":
            setProgress((p) => ({
              ...p!,
              file: ev.file as string,
              fileIndex: ev.file_index as number,
              fileTotal: ev.file_total as number,
              page: 0,
              totalPages: 0,
              phase: "ocr",
            }));
            break;
          case "ocr_done":
            setProgress((p) => ({
              ...p!,
              totalPages: ev.total_pages as number,
              page: 0,
              phase: "extracting",
            }));
            break;
          case "page_done":
          case "page_skip":
            setProgress((p) => ({
              ...p!,
              page: ev.page as number,
              totalPages: ev.total as number,
            }));
            // Append result immediately for real-time display
            if (ev.event === "page_done" && ev.result) {
              setResults((prev) => [...prev, ev.result as OcrResultItem]);
            }
            break;
          case "file_error":
            if (ev.result) {
              setResults((prev) => [...prev, ev.result as OcrResultItem]);
            }
            break;
          case "complete":
            // Results already built up via page_done events
            // Just finalise batch metadata
            setBatchId(ev.batch_id as string);
            setTemplateUsed((ev.template as string) || null);
            setAutoDetected((ev.auto_detected as boolean) || false);
            setFiles([]);
            setProgress((p) => ({ ...p!, phase: "done" }));
            // Pre-fill save form
            setSaveForm((f) => ({
              ...f,
              batch_name: `OCR ${new Date().toLocaleDateString("th-TH")}`,
              selectedIds: new Set<number>(),
            }));
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  const handleSaveLabours = async () => {
    if (!batchId || saving) return;
    setSaving(true);
    setSaveSuccess(null);
    try {
      const completedResults = results.filter((r) => r.status === "completed");
      const ids = saveForm.selectedIds.size > 0
        ? Array.from(saveForm.selectedIds)
        : completedResults.map((r) => r.id);

      const res = await apiFetch(`/ocr/batch/${batchId}/save-labours`, {
        method: "POST",
        body: JSON.stringify({
          batch_name: saveForm.batch_name || `OCR ${new Date().toLocaleDateString("th-TH")}`,
          label: saveForm.label || undefined,
          note: saveForm.note || undefined,
          visibility: saveForm.visibility,
          result_ids: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      setSaveSuccess(data.message);
      setShowSaveModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {    if (!batchId) return;
    const token = localStorage.getItem("token");
    // Stream download via direct fetch
    fetch(`${API_BASE}/ocr/batch/${batchId}/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ocr_batch_${batchId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Export failed"));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const completedCount = results.filter((r) => r.status === "completed").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="w-7 h-7 text-primary" />
            ประมวลผล OCR
          </h1>
          <p className="text-sm text-muted mt-1">
            อัพโหลดไฟล์ PDF หรือรูปภาพ — สกัด OCR ด้วย Google Cloud Vision API
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">อัพโหลดไฟล์</h2>
          <div className="flex items-center gap-3">
            <select
              value={selectedMappingId}
              onChange={(e) => setSelectedMappingId(e.target.value)}
              className={`px-3 py-2 bg-background border rounded-lg text-sm ${!selectedMappingId ? 'border-destructive text-muted' : 'border-border'}`}
            >
              <option value="" disabled>— เลือกแม่แบบ —</option>
              {fieldMappings
                .filter((m) => m.is_active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-background"
          }`}
        >
          <Upload
            className={`w-10 h-10 mx-auto mb-3 ${
              dragOver ? "text-primary" : "text-muted"
            }`}
          />
          <p className="text-sm font-medium">
            ลากไฟล์มาวางที่นี่ หรือ{" "}
            <span className="text-primary">เรียกดูไฟล์</span>
          </p>
          <p className="text-xs text-muted mt-1">
            PDF, JPG, PNG, TIFF, BMP, WebP — ไม่เกิน 50MB ต่อไฟล์
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                เลือกแล้ว {files.length} ไฟล์
              </p>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-danger hover:underline"
              >
                ล้างทั้งหมด
              </button>
            </div>
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 bg-background rounded-lg border border-border"
              >
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted">
                    {f.type.split("/")[1]?.toUpperCase()} •{" "}
                    {formatFileSize(f.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="p-1 hover:bg-danger-light rounded text-muted hover:text-danger"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={handleProcess}
              disabled={processing}
              className="w-full mt-3 px-4 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <ScanSearch className="w-5 h-5" />
                  ประมวล {files.length} ไฟล์ด้วย OCR
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {processing && progress && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {progress.phase === "uploading" && "กำลังอัพโหลดไฟล์..."}
                {progress.phase === "ocr" && `อ่าน: ${progress.file} (ไฟล์ ${progress.fileIndex}/${progress.fileTotal})`}
                {progress.phase === "extracting" && `สกัดข้อมูล: ${progress.file} — หน้า ${progress.page}/${progress.totalPages}`}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {progress.phase === "uploading" && "ส่งไฟล์ไปยังเซิร์ฟเวอร์..."}
                {progress.phase === "ocr" && "ประมวล OCR ด้วย Google Cloud Vision API..."}
                {progress.phase === "extracting" && `ไฟล์ ${progress.fileIndex}/${progress.fileTotal}`}
              </p>
            </div>
          </div>
          {progress.totalPages > 0 && progress.phase === "extracting" && (
            <div className="w-full bg-background rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.round((progress.page / progress.totalPages) * 100)}%` }}
              />
            </div>
          )}
          {progress.totalPages > 0 && progress.phase === "extracting" && (
            <p className="text-xs text-muted text-right mt-1">
              {progress.page}/{progress.totalPages} pages ({Math.round((progress.page / progress.totalPages) * 100)}%)
            </p>
          )}
          {progress.phase === "ocr" && (
            <div className="w-full bg-background rounded-full h-3 overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full animate-pulse w-full" />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger-light border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Results — show live as they stream in */}
      {results.length > 0 && (
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                ผลลัพธ์
                {processing && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    กำลังสตรีมสด...
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {completedCount} สำเร็จ • {failedCount} ล้มเหลว • รวม {results.length} รายการ
                {templateUsed && (
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${
                    autoDetected
                      ? "bg-success/10 text-success"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {autoDetected ? "ตรวจจับอัตโนมัติ" : "แม่แบบ"}: {templateUsed}
                  </span>
                )}
              </p>
            </div>
            {completedCount > 0 && !processing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSaveForm((f) => ({
                      ...f,
                      selectedIds: new Set(results.filter((r) => r.status === "completed").map((r) => r.id)),
                    }));
                    setShowSaveModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-medium rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  บันทึกข้อมูลแรงงาน
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success text-sm font-medium rounded-lg hover:bg-success/20 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-border">
            {results.map((r) => (
              <div
                key={r.id}
                className="animate-fade-in flex items-start gap-4 px-6 py-4 hover:bg-background/50 transition-colors"
              >
                {/* Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {r.status === "completed" ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : r.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-danger" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted animate-spin" />
                  )}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate max-w-xs">{r.original_filename}</p>
                    <span className="text-xs text-muted">
                      {r.file_type.toUpperCase()}
                      {r.page_number ? ` • หน้า ${r.page_number}/${r.page_count}` : ` • ${r.page_count} หน้า`}
                    </span>
                    {/* Confidence badge */}
                    {r.ocr_confidence !== null && r.ocr_confidence !== undefined && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        r.ocr_confidence >= 0.95 ? "bg-success/10 text-success" :
                        r.ocr_confidence >= 0.80 ? "bg-warning/10 text-warning" :
                                                    "bg-danger/10 text-danger"
                      }`}>
                        {Math.round(r.ocr_confidence * 100)}%
                      </span>
                    )}
                    {autoDetected && r.field_mapping && (
                      <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
                        {r.field_mapping.name}
                      </span>
                    )}
                  </div>

                  {/* Extracted fields — inline mini grid */}
                  {r.status === "completed" && r.extracted_data && (() => {
                    const filled = Object.entries(r.extracted_data!).filter(([, v]) => v);
                    return filled.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {filled.slice(0, 6).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border rounded text-xs"
                          >
                            <span className="text-muted">{k.replace(/_/g, " ")}:</span>
                            <span className="font-medium">{v}</span>
                          </span>
                        ))}
                        {filled.length > 6 && (
                          <span className="text-xs text-muted px-1 py-0.5">+{filled.length - 6} เพิ่มเติม</span>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {r.status === "failed" && r.error_message && (
                    <p className="text-xs text-danger mt-1">{r.error_message}</p>
                  )}
                </div>

                {/* View Button */}
                {r.status === "completed" && (
                  <button
                    onClick={() => {
                      setShowRawText(false);
                      setViewingResult(r);
                    }}
                    className="p-2 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors shrink-0"
                    title="ดูรายละเอียด"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Live placeholder while still processing */}
            {processing && (
              <div className="flex items-center gap-4 px-6 py-4 bg-primary/5">
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <p className="text-sm text-primary">
                  {progress?.phase === "ocr"
                    ? `กำลังอ่าน OCR: ${progress.file}`
                    : progress?.phase === "extracting"
                    ? `สกัดข้อมูลหน้า ${progress?.page}/${progress?.totalPages}: ${progress?.file}`
                    : "กำลังประมวลผล..."
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setViewingResult(null)}
        >
          <div
            className="bg-card w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold">
                  {viewingResult.original_filename}
                </h3>
                <p className="text-xs text-muted">
                  {viewingResult.file_type.toUpperCase()} •{" "}
                  {viewingResult.page_number
                    ? `หน้า ${viewingResult.page_number}/${viewingResult.page_count}`
                    : `${viewingResult.page_count} หน้า`}{" "}
                  {viewingResult.ocr_confidence !== null && viewingResult.ocr_confidence !== undefined && (
                    <>• ความแม่นยำ {Math.round((viewingResult.ocr_confidence ?? 0) * 100)}%{" "}</>
                  )}
                  •{" "}
                  {new Date(viewingResult.created_at).toLocaleString("th-TH")}
                </p>
              </div>
              <button
                onClick={() => setViewingResult(null)}
                className="p-2 hover:bg-background rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Template info */}
              {viewingResult.field_mapping && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Template:</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                    {viewingResult.field_mapping.name}
                  </span>
                </div>
              )}

              {/* Extracted Data — mapped text view */}
              {viewingResult.extracted_data && (() => {
                const entries = Object.entries(viewingResult.extracted_data!);
                const filled = entries.filter(([, v]) => v);
                const mappedText = entries
                  .map(([key, value]) => `${key.replace(/_/g, " ")} => ${value ?? "—"}`)
                  .join("\n");
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">
                        ข้อมูลที่ Mapping แล้ว
                        <span className="text-xs text-muted font-normal ml-2">
                          {filled.length} พบ / {entries.length} ทั้งหมด
                        </span>
                      </h4>
                      <button
                        onClick={() => { navigator.clipboard.writeText(mappedText); }}
                        className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
                        title="คัดลอก"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        คัดลอก
                      </button>
                    </div>
                    <pre className="p-4 bg-background rounded-lg border border-border text-sm leading-relaxed whitespace-pre-wrap font-mono">
                      {mappedText}
                    </pre>
                  </div>
                );
              })()}

              {/* Raw OCR Text — collapsed */}
              {viewingResult.raw_text && (
                <div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowRawText(prev => prev === "raw" ? false : "raw")}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {showRawText === "raw" ? "ซ่อน" : "แสดง"}ข้อความ OCR ดิบ
                    </button>
                    {showRawText === "raw" && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(viewingResult.raw_text!); }}
                        className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
                        title="คัดลอก"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        คัดลอก
                      </button>
                    )}
                  </div>
                  {showRawText === "raw" && (
                    <pre className="mt-3 p-4 bg-background rounded-lg border border-border text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                      {viewingResult.raw_text}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="bg-success/10 border border-success/20 text-success rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {saveSuccess}
          <button onClick={() => setSaveSuccess(null)} className="ml-auto p-1 hover:bg-success/20 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Save to Labours Modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Save className="w-5 h-5 text-primary" />
                บันทึกข้อมูลแรงงาน
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="p-2 hover:bg-background rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* batch_name */}
              <div>
                <label className="text-sm font-medium">ชื่อกลุ่ม <span className="text-danger">*</span></label>
                <input
                  value={saveForm.batch_name}
                  onChange={(e) => setSaveForm((f) => ({ ...f, batch_name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="เช่น OCR Batch มีนาคม 2026"
                />
              </div>

              {/* label */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> ป้ายกำกับ
                </label>
                <input
                  value={saveForm.label}
                  onChange={(e) => setSaveForm((f) => ({ ...f, label: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="เช่น พนักงานโรงงาน, กลุ่ม A"
                />
              </div>

              {/* note */}
              <div>
                <label className="text-sm font-medium">หมายเหตุ</label>
                <textarea
                  value={saveForm.note}
                  onChange={(e) => setSaveForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
                />
              </div>

              {/* visibility */}
              <div>
                <label className="text-sm font-medium mb-2 block">สิทธิ์การมองเห็น</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSaveForm((f) => ({ ...f, visibility: "private" }))}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      saveForm.visibility === "private"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border hover:bg-background"
                    }`}
                  >
                    <Lock className="w-4 h-4" /> เฉพาะฉัน
                  </button>
                  <button
                    onClick={() => setSaveForm((f) => ({ ...f, visibility: "public" }))}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      saveForm.visibility === "public"
                        ? "bg-success/10 border-success text-success"
                        : "border-border hover:bg-background"
                    }`}
                  >
                    <Globe className="w-4 h-4" /> ทุกคนในระบบ
                  </button>
                </div>
              </div>

              {/* result selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    เลือกรายการที่จะบันทึก ({saveForm.selectedIds.size}/{results.filter((r) => r.status === "completed").length})
                  </label>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const all = results.filter((r) => r.status === "completed").map((r) => r.id);
                      setSaveForm((f) => ({
                        ...f,
                        selectedIds:
                          f.selectedIds.size === all.length ? new Set() : new Set(all),
                      }));
                    }}
                  >
                    {saveForm.selectedIds.size === results.filter((r) => r.status === "completed").length
                      ? "ยกเลิกทั้งหมด"
                      : "เลือกทั้งหมด"}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {results
                    .filter((r) => r.status === "completed")
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={saveForm.selectedIds.has(r.id)}
                          onChange={(e) =>
                            setSaveForm((f) => {
                              const s = new Set(f.selectedIds);
                              if (e.target.checked) { s.add(r.id); } else { s.delete(r.id); }
                              return { ...f, selectedIds: s };
                            })
                          }
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm truncate">{r.original_filename}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-background"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveLabours}
                disabled={saving || !saveForm.batch_name || saveForm.selectedIds.size === 0}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึก {saveForm.selectedIds.size} รายการ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
