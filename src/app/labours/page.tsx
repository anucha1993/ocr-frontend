"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Search,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";

import { apiFetch, API_BASE } from "@/lib/api";

interface Labour {
  id: number;
  document_type: string;
  id_card: string | null;
  passport_no: string | null;
  prefix: string | null;
  firstname: string;
  lastname: string;
  birthdate: string | null;
  address: string | null;
  nationality: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  photo: string | null;
  created_at: string;
  updated_at: string;
}

interface Batch {
  id: number;
  name: string;
  note: string | null;
  total_count: number;
  labours_count: number;
  created_at: string;
  labours?: Labour[];
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function fmtDate(raw: string | null): string {
  if (!raw) return "-";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-GB");
  } catch {
    return raw;
  }
}

function fmtDateTime(raw: string): string {
  try {
    return new Date(raw).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return raw;
  }
}

export default function LaboursPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [batchLabours, setBatchLabours] = useState<Record<number, Labour[]>>({});
  const [loadingBatch, setLoadingBatch] = useState<number | null>(null);
  const [selected, setSelected] = useState<Labour | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await apiFetch(`/scan-batches?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBatches(json.data || []);
      setPagination({
        current_page: json.current_page ?? 1,
        last_page: json.last_page ?? 1,
        per_page: json.per_page ?? 20,
        total: json.total ?? 0,
      });
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const toggleBatch = async (batchId: number) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);
    if (batchLabours[batchId]) return;
    setLoadingBatch(batchId);
    try {
      const res = await apiFetch(`/scan-batches/${batchId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBatchLabours((prev) => ({ ...prev, [batchId]: json.labours || [] }));
    } catch {
      /* ignore */
    } finally {
      setLoadingBatch(null);
    }
  };

  const handleDeleteBatch = async (id: number) => {
    if (!confirm("ต้องการลบชุดนี้? (ข้อมูลแรงงานจะถูกยกเลิกการผูกชุด แต่ไม่ถูกลบ)")) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/scan-batches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchBatches();
      if (expandedBatch === id) setExpandedBatch(null);
    } catch {
      alert("ลบไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  };

  const docBadge = (type: string) =>
    type === "passport"
      ? "bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium"
      : "bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            รายการบันทึก
          </h1>
          <p className="text-sm text-slate-500 mt-1">ชุดข้อมูลที่บันทึกจากเครื่องอ่านเอกสาร</p>
        </div>
        <button
          onClick={() => { setPage(1); fetchBatches(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          โหลดใหม่
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อชุด..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* Batch List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> กำลังโหลด...
          </div>
        ) : batches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-20 text-slate-400">ไม่พบข้อมูล</div>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Batch header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleBatch(batch.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{batch.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDateTime(batch.created_at)} &middot; {batch.labours_count} รายการ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    {batch.labours_count} คน
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`${API_BASE}/scan-batches/${batch.id}/export`, '_blank');
                    }}
                    className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                    title="Export Excel"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBatch(batch.id); }}
                    disabled={deleting === batch.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50"
                    title="ลบชุด"
                  >
                    {deleting === batch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                  {expandedBatch === batch.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {/* Expanded labours */}
              {expandedBatch === batch.id && (
                <div className="border-t border-slate-100">
                  {loadingBatch === batch.id ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลดรายการ...
                    </div>
                  ) : (batchLabours[batch.id] || []).length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">ไม่พบรายการในชุดนี้</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-500 text-left">
                            <th className="px-5 py-2.5 font-medium">#</th>
                            <th className="px-4 py-2.5 font-medium">ประเภท</th>
                            <th className="px-4 py-2.5 font-medium">เลขเอกสาร</th>
                            <th className="px-4 py-2.5 font-medium">ชื่อ</th>
                            <th className="px-4 py-2.5 font-medium">สัญชาติ</th>
                            <th className="px-4 py-2.5 font-medium">วันเกิด</th>
                            <th className="px-4 py-2.5 font-medium">หมดอายุ</th>
                            <th className="px-4 py-2.5 font-medium text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(batchLabours[batch.id] || []).map((l, i) => (
                            <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                              <td className="px-4 py-2.5">
                                <span className={docBadge(l.document_type)}>{l.document_type === "passport" ? "Passport" : "บัตร ปชช."}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs">{l.passport_no || l.id_card || "-"}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-700">{l.firstname} {l.lastname}</td>
                              <td className="px-4 py-2.5">{l.nationality || "-"}</td>
                              <td className="px-4 py-2.5">{fmtDate(l.birthdate)}</td>
                              <td className="px-4 py-2.5">{fmtDate(l.expiry_date)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <button
                                  onClick={() => setSelected(l)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                  title="ดูรายละเอียด"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>ทั้งหมด {pagination.total} ชุด — หน้า {pagination.current_page}/{pagination.last_page}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.current_page <= 1}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
              disabled={pagination.current_page >= pagination.last_page}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-lg text-slate-800">รายละเอียด</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {selected.photo && (
                <div className="flex justify-center">
                  <img src={selected.photo.startsWith("data:") ? selected.photo : `data:image/jpeg;base64,${selected.photo}`} alt="photo" className="w-28 h-36 object-cover rounded-xl border border-slate-200" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <DetailField label="ประเภท" value={selected.document_type === "passport" ? "Passport" : "บัตรประชาชน"} />
                <DetailField label="สัญชาติ" value={selected.nationality} />
                <DetailField label="เลขบัตร ปชช." value={selected.id_card} />
                <DetailField label="เลข Passport" value={selected.passport_no} />
                <DetailField label="ชื่อ" value={selected.firstname} />
                <DetailField label="นามสกุล" value={selected.lastname} />
                <DetailField label="วันเกิด" value={fmtDate(selected.birthdate)} />
                <DetailField label="วันออก" value={fmtDate(selected.issue_date)} />
                <DetailField label="วันหมดอายุ" value={fmtDate(selected.expiry_date)} />
                {selected.address && (
                  <div className="col-span-2">
                    <DetailField label="ที่อยู่" value={selected.address} />
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                สร้าง: {new Date(selected.created_at).toLocaleString("th-TH")} | แก้ไข: {new Date(selected.updated_at).toLocaleString("th-TH")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-slate-400 text-xs">{label}</span>
      <p className="text-slate-700 font-medium mt-0.5">{value || "-"}</p>
    </div>
  );
}
