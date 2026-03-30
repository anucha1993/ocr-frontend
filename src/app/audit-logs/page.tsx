"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Filter,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  FileDown,
  Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
}

interface PaginatedResponse {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
}

const actionIcons: Record<string, { icon: React.ElementType; color: string }> = {
  login:    { icon: LogIn,   color: "text-success bg-success/10" },
  logout:   { icon: LogOut,  color: "text-muted bg-muted/10" },
  created:  { icon: Plus,    color: "text-primary bg-primary/10" },
  updated:  { icon: Pencil,  color: "text-warning bg-warning/10" },
  deleted:  { icon: Trash2,  color: "text-danger bg-danger/10" },
  exported: { icon: FileDown, color: "text-info bg-info/10" },
  viewed:   { icon: Eye,     color: "text-muted bg-muted/10" },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "30" });
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity_type", entityFilter);
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    apiFetch(`/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse) => {
        setLogs(data.data);
        setLastPage(data.last_page);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, [page, actionFilter, entityFilter, search, from, to]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Audit Log
        </h1>
        <p className="text-sm text-muted mt-1">
          บันทึกการใช้งานระบบทั้งหมด — {total} รายการ
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">ทั้งหมด</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="exported">Exported</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Entity</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">ทั้งหมด</option>
            <option value="User">User</option>
            <option value="Labour">Labour</option>
            <option value="ScanBatch">ScanBatch</option>
            <option value="OcrResult">OcrResult</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">จาก</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">ถึง</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">ค้นหา</label>
          <input
            type="text"
            placeholder="ชื่อผู้ใช้, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (() => { setPage(1); fetchLogs(); })()}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ไม่พบรายการ</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-card rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">ผู้ใช้</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const cfg = actionIcons[log.action] || actionIcons.viewed;
                const Icon = cfg.icon;
                const isExpanded = expanded === log.id;

                return (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-border/50 hover:bg-background/50 transition cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                    >
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("th-TH")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{log.user?.name ?? "System"}</p>
                        <p className="text-xs text-muted">{log.user?.email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{log.entity_type}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.entity_id ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted">{log.ip_address ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {(log.old_values || log.new_values) ? "▼" : ""}
                      </td>
                    </tr>
                    {isExpanded && (log.old_values || log.new_values) && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={8} className="px-6 py-4 bg-background/50">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {log.old_values && (
                              <div>
                                <p className="font-semibold text-danger mb-1">ค่าเดิม</p>
                                <pre className="bg-card p-3 rounded-lg overflow-x-auto border border-border max-h-48">
                                  {JSON.stringify(log.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_values && (
                              <div>
                                <p className="font-semibold text-success mb-1">ค่าใหม่</p>
                                <pre className="bg-card p-3 rounded-lg overflow-x-auto border border-border max-h-48">
                                  {JSON.stringify(log.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {log.user_agent && (
                            <p className="text-[10px] text-muted mt-2 truncate">
                              UA: {log.user_agent}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-background disabled:opacity-40 transition"
          >
            ก่อนหน้า
          </button>
          <span className="px-4 py-2 text-sm text-muted">
            หน้า {page} / {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-background disabled:opacity-40 transition"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
