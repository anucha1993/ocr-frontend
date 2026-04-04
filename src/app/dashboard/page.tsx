"use client";

import { useState, useEffect } from "react";
import {
  ScanSearch,
  PackageOpen,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CalendarClock,
  TrendingUp,
  FileWarning,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  ocr: {
    total: number;
    today: number;
    this_month: number;
    completed: number;
    failed: number;
  };
  batches: {
    total: number;
    today: number;
  };
  labours: {
    total: number;
    expiring_30: number;
    expiring_60: number;
    expired: number;
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  color: "primary" | "success" | "warning" | "danger" | "info";
  href?: string;
}) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger:  "bg-danger/10  text-danger",
    info:    "bg-info/10    text-info",
  };

  const card = (
    <div className="bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow cursor-pointer">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value.toLocaleString("th-TH")}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats;
  const ocrRate =
    s && s.ocr.total > 0 ? Math.round((s.ocr.completed / s.ocr.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-sm text-muted mt-1">ภาพรวมการใช้งานระบบ OCR</p>
      </div>

      {/* Expiry alerts */}
      {s && (s.labours.expired > 0 || s.labours.expiring_30 > 0) && (
        <div className="space-y-2">
          {s.labours.expired > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-danger-light border border-danger/20 rounded-xl text-sm text-danger">
              <FileWarning className="w-5 h-5 shrink-0" />
              <span>
                <strong>{s.labours.expired.toLocaleString("th-TH")} รายการ</strong>{" "}
                เอกสารหมดอายุแล้ว —{" "}
                <Link href="/labours" className="underline font-medium">
                  ดูรายการ
                </Link>
              </span>
            </div>
          )}
          {s.labours.expiring_30 > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-warning-light border border-warning/20 rounded-xl text-sm text-warning">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                <strong>{s.labours.expiring_30.toLocaleString("th-TH")} รายการ</strong>{" "}
                เอกสารจะหมดอายุภายใน 30 วัน —{" "}
                <Link href="/labours" className="underline font-medium">
                  ดูรายการ
                </Link>
              </span>
            </div>
          )}
        </div>
      )}

      {/* OCR stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ScanSearch}
          label="OCR ทั้งหมด"
          value={s?.ocr.total ?? 0}
          sub={`วันนี้: ${s?.ocr.today ?? 0} รายการ`}
          color="primary"
          href="/ocr/results"
        />
        <StatCard
          icon={CheckCircle}
          label="สำเร็จ"
          value={s?.ocr.completed ?? 0}
          sub={`อัตราสำเร็จ: ${ocrRate}%`}
          color="success"
          href="/ocr/results"
        />
        <StatCard
          icon={XCircle}
          label="ล้มเหลว"
          value={s?.ocr.failed ?? 0}
          sub="ตรวจสอบใน OCR Results"
          color="danger"
          href="/ocr/results"
        />
        <StatCard
          icon={TrendingUp}
          label="เดือนนี้"
          value={s?.ocr.this_month ?? 0}
          sub="รายการที่ประมวลผลแล้ว"
          color="info"
        />
      </div>

      {/* Labour stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={PackageOpen}
          label="ชุดข้อมูลทั้งหมด"
          value={s?.batches.total ?? 0}
          sub={`วันนี้: ${s?.batches.today ?? 0} ชุด`}
          color="primary"
          href="/labours"
        />
        <StatCard
          icon={Users}
          label="รายการแรงงาน"
          value={s?.labours.total ?? 0}
          color="success"
          href="/labours"
        />
        <StatCard
          icon={CalendarClock}
          label="หมดอายุใน 60 วัน"
          value={s?.labours.expiring_60 ?? 0}
          sub={`เร่งด่วน (30 วัน): ${s?.labours.expiring_30 ?? 0}`}
          color={s && s.labours.expiring_30 > 0 ? "warning" : "info"}
          href="/labours"
        />
      </div>

      {/* Quick links */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">เมนูลัด</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
          {[
            { label: "ประมวลผล OCR ใหม่",    href: "/ocr",           icon: ScanSearch,  color: "text-primary" },
            { label: "ดูผลลัพธ์ OCR",        href: "/ocr/results",  icon: CheckCircle, color: "text-success" },
            { label: "รายการแรงงาน",         href: "/labours",      icon: PackageOpen, color: "text-info"    },
            // { label: "ข้อมูลแรงงานต่างด้าว", href: "/foreign-data", icon: Users,       color: "text-warning" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 py-6 px-4 hover:bg-background transition-colors text-center"
            >
              <item.icon className={`w-6 h-6 ${item.color}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}


