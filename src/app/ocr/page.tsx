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
  const [showRawText, setShowRawText] = useState(false);
  const [showNullFields, setShowNullFields] = useState(false);
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

  const handleExport = () => {
    if (!batchId) return;
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
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
            >
              <option value="">ตรวจจับแม่แบบอัตโนมัติ</option>
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
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success text-sm font-medium rounded-lg hover:bg-success/20 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
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
                      setShowNullFields(false);
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

              {/* Extracted Data — only non-null by default */}
              {viewingResult.extracted_data && (() => {
                const entries = Object.entries(viewingResult.extracted_data!);
                const filled = entries.filter(([, v]) => v);
                const empty = entries.filter(([, v]) => !v);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">
                        ฟิลด์ที่สกัดได้
                        <span className="text-xs text-muted font-normal ml-2">
                          {filled.length} พบ / {entries.length} ทั้งหมด
                        </span>
                      </h4>
                      {empty.length > 0 && (
                        <button
                          onClick={() => setShowNullFields(!showNullFields)}
                          className="text-xs text-primary hover:underline"
                        >
                          {showNullFields ? "ซ่อน" : "แสดง"}ฟิลด์ว่าง ({empty.length})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filled.map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 py-3 bg-background rounded-lg border border-primary/20"
                        >
                          <p className="text-xs text-primary uppercase tracking-wide font-medium">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm font-semibold mt-1">{value}</p>
                        </div>
                      ))}
                      {showNullFields && empty.map(([key]) => (
                        <div
                          key={key}
                          className="px-4 py-3 bg-background rounded-lg border border-border opacity-50"
                        >
                          <p className="text-xs text-muted uppercase tracking-wide">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-muted italic mt-1">— ไม่พบข้อมูล</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Raw OCR Text — collapsed by default */}
              {viewingResult.raw_text && (
                <div>
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {showRawText ? "ซ่อน" : "แสดง"}ข้อความ OCR ดิบ
                  </button>
                  {showRawText && (
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
    </div>
  );
}
