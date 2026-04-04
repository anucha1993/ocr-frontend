"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { apiFetch, API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface OcrResultItem {
  id: number;
  batch_id: string;
  original_filename: string;
  file_type: string;
  page_count: number;
  raw_text: string | null;
  extracted_data: Record<string, string | null> | null;
  ocr_confidence: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  field_mapping?: { id: number; name: string } | null;
  created_at: string;
}

interface PaginatedResponse {
  data: OcrResultItem[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export default function OcrResultsPage() {
  const [results, setResults] = useState<OcrResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewingResult, setViewingResult] = useState<OcrResultItem | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const fetchResults = async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), per_page: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await apiFetch(`/ocr/results?${params}`);
      const data: PaginatedResponse = await res.json();
      setResults(data.data);
      setPage(data.current_page);
      setLastPage(data.last_page);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ลบผล OCR นี้?")) return;
    await apiFetch(`/ocr/results/${id}`, { method: "DELETE" });
    fetchResults();
  };

  const handleExportBatch = (batchId: string) => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/ocr/batch/${batchId}/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
      .catch(() => alert("ส่งออกไม่สำเร็จ"));
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed:  "bg-success/10 text-success",
      failed:     "bg-danger/10 text-danger",
      processing: "bg-warning/10 text-warning",
      pending:    "bg-muted/10 text-muted",
    };
    const labels: Record<string, string> = {
      completed:  "สำเร็จ",
      failed:     "ล้มเหลว",
      processing: "กำลังประมวล",
      pending:    "รอดำเนินการ",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ""}`}
      >
        {status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
        {status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
        {labels[status] ?? status}
      </span>
    );
  };

  const confidenceBadge = (confidence: number | null) => {
    if (confidence === null) return <span className="text-xs text-muted">-</span>;
    const pct = Math.round(confidence * 100);
    const color =
      pct >= 95 ? "bg-success/10 text-success" :
      pct >= 80 ? "bg-warning/10 text-warning" :
                  "bg-danger/10 text-danger";
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>
        {pct}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          ผลลัพธ์ OCR
        </h1>
        <p className="text-sm text-muted mt-1">
          ทั้งหมด {total} รายการ — ดู, ส่งออก หรือจัดการข้อมูล OCR
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อไฟล์..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm"
          />
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="completed">สำเร็จ</option>
          <option value="failed">ล้มเหลว</option>
          <option value="processing">กำลังประมวล</option>
          <option value="pending">รอดำเนินการ</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">
            ไม่พบผล OCR
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-background border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted">ไฟล์</th>
                    <th className="px-4 py-3 font-medium text-muted">ประเภท</th>
                    <th className="px-4 py-3 font-medium text-muted">หน้า</th>
                    <th className="px-4 py-3 font-medium text-muted">สถานะ</th>
                    <th className="px-4 py-3 font-medium text-muted">ความแม่นยำ</th>
                    <th className="px-4 py-3 font-medium text-muted">แม่แบบ</th>
                    <th className="px-4 py-3 font-medium text-muted">Batch</th>
                    <th className="px-4 py-3 font-medium text-muted">วันที่</th>
                    <th className="px-4 py-3 font-medium text-muted text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate max-w-[200px]">{r.original_filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 uppercase text-xs">{r.file_type}</td>
                      <td className="px-4 py-3">{r.page_count}</td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3">{confidenceBadge(r.ocr_confidence)}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {r.field_mapping?.name || "ค่าเริ่มต้น"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted">
                          {r.batch_id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "completed" && (
                            <>
                              <button
                                onClick={() => setViewingResult(r)}
                                className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary"
                                title="ดู"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleExportBatch(r.batch_id)}
                                className="p-1.5 rounded hover:bg-success/10 text-muted hover:text-success"
                                title="ส่งออก"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted">
                  หน้า {page} / {lastPage} (ทั้งหมด {total} รายการ)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => fetchResults(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded hover:bg-background disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchResults(page + 1)}
                    disabled={page >= lastPage}
                    className="p-1.5 rounded hover:bg-background disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold">
                  {viewingResult.original_filename}
                </h3>
                <p className="text-xs text-muted">
                  {viewingResult.file_type.toUpperCase()} •{" "}
                  {viewingResult.page_count} หน้า •{" "}
                  {viewingResult.ocr_confidence !== null && viewingResult.ocr_confidence !== undefined && (
                    <>ความแม่นยำ {Math.round((viewingResult.ocr_confidence ?? 0) * 100)}% •{" "}</>
                  )}
                  {new Date(viewingResult.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setViewingResult(null)}
                className="p-2 hover:bg-background rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {viewingResult.extracted_data && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">ข้อมูลที่ดึงได้</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(viewingResult.extracted_data).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="px-4 py-3 bg-background rounded-lg border border-border"
                        >
                          <p className="text-xs text-muted uppercase tracking-wide">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm font-medium mt-1">
                            {value || <span className="text-muted italic">—</span>}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {viewingResult.raw_text && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">ข้อความ OCR ดิบ</h4>
                  <pre className="p-4 bg-background rounded-lg border border-border text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                    {viewingResult.raw_text}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
