"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  read_at: string | null;
  created_at: string;
}

interface PaginatedResponse {
  data: Notification[];
  current_page: number;
  last_page: number;
  total: number;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  expired:         { icon: AlertCircle,   color: "text-danger bg-danger/10",   label: "หมดอายุแล้ว" },
  expiry_critical: { icon: AlertTriangle, color: "text-warning bg-warning/10", label: "ใกล้หมดอายุ (≤30 วัน)" },
  expiry_warning:  { icon: Clock,         color: "text-info bg-info/10",       label: "แจ้งเตือนล่วงหน้า" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (filter) params.set("type", filter);
    if (unreadOnly) params.set("unread_only", "1");

    apiFetch(`/notifications?${params}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse) => {
        setNotifications(data.data);
        setLastPage(data.last_page);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchNotifications(); }, [page, filter, unreadOnly]);

  const markAsRead = async (id: number) => {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  const markAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };

  const deleteNotification = async (id: number) => {
    await apiFetch(`/notifications/${id}`, { method: "DELETE" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => t - 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            การแจ้งเตือน
          </h1>
          <p className="text-sm text-muted mt-1">ทั้งหมด {total} รายการ</p>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          <CheckCheck className="w-4 h-4" />
          อ่านทั้งหมด
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">ทุกประเภท</option>
            <option value="expired">หมดอายุแล้ว</option>
            <option value="expiry_critical">ใกล้หมดอายุ (≤30 วัน)</option>
            <option value="expiry_warning">แจ้งเตือนล่วงหน้า</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-border accent-primary"
          />
          เฉพาะยังไม่อ่าน
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.expiry_warning;
            const Icon = cfg.icon;
            const isUnread = !n.read_at;

            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition ${
                  isUnread
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${isUnread ? "text-foreground" : "text-muted"}`}>
                      {n.title}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-1">{n.message}</p>
                  <p className="text-xs text-muted/60 mt-1">
                    {new Date(n.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isUnread && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      title="อ่านแล้ว"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    title="ลบ"
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-muted hover:text-danger transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
