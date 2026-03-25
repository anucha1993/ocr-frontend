"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ForeignRecord {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Full_Name_Labour?: string;
  National_ID?: string;
  Nationality?: string;
  Passport_ID?: string;
  VISA_ID?: string;
  Work_Permit_ID?: string;
  Mobile?: string;
  Email?: string;
  Foreigners_Status?: string;
  Days_Status?: string;
  Workpermit_Status?: string;
  VISA_Status?: string;
  Passport_Status?: string;
  Account_Name?: { name?: string; id?: string };
  [key: string]: unknown;
}

interface PageInfo {
  per_page?: number;
  count?: number;
  page?: number;
  more_records?: boolean;
}

// Status badge colors
const statusColor = (status: string | undefined) => {
  if (!status) return "bg-gray-100 text-gray-500";
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("valid") || s === "ทำงาน") return "bg-success-light text-success";
  if (s.includes("expire") || s.includes("หมดอายุ")) return "bg-danger-light text-danger";
  if (s.includes("pending") || s.includes("รอ")) return "bg-warning-light text-warning";
  return "bg-info-light text-info";
};

export default function ForeignDataPage() {
  const [records, setRecords] = useState<ForeignRecord[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ForeignRecord | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/foreign-data?page=${page}&per_page=20`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
        setPageInfo(json.info || {});
      } else {
        setError(json.message || "Failed to fetch data.");
      }
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Thefirst OCR</h1>
          <p className="text-sm text-muted mt-1">
            ข้อมูลจาก Zoho CRM Module: Foreign_Data
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          โหลดใหม่
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-danger-light text-danger text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {loading && records.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">กำลังโหลดข้อมูล...</span>
        </div>
      ) : records.length === 0 && !error ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Users className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-medium mb-1">ไม่พบข้อมูล</h3>
          <p className="text-sm text-muted">ไม่พบข้อมูลใน Foreign_Data module</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">ชื่อ</th>
                  <th className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">เลขบัตรปชช.</th>
                  <th className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">สัญชาติ</th>
                  <th className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">พาสปอร์ต</th>
                  <th className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">บริษัท</th>
                  <th className="text-center px-4 py-3 font-medium text-muted whitespace-nowrap">สถานะ</th>
                  <th className="text-center px-4 py-3 font-medium text-muted whitespace-nowrap">ใบอนุญาตทำงาน</th>
                  <th className="text-center px-4 py-3 font-medium text-muted whitespace-nowrap">วีซ่า</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-background/50"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {r.Full_Name_Labour || `${r.First_Name || ""} ${r.Last_Name || ""}`.trim() || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-xs whitespace-nowrap">
                      {r.National_ID || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.Nationality || "-"}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{r.Passport_ID || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.Account_Name?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={r.Foreigners_Status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={r.Workpermit_Status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={r.VISA_Status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedRecord(r)}
                        className="p-1.5 rounded-lg hover:bg-primary-light text-primary transition-colors"
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

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background">
            <p className="text-xs text-muted">
              หน้า {page} • {records.length} รายการ
              {pageInfo.more_records ? " • มีหน้าถัดไป" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-border hover:bg-card disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium px-2">{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pageInfo.more_records || loading}
                className="p-1.5 rounded-lg border border-border hover:bg-card disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <RecordDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

function StatusBadge({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-muted">-</span>;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${statusColor(value)}`}>
      {value}
    </span>
  );
}

function RecordDetail({ record, onClose }: { record: ForeignRecord; onClose: () => void }) {
  // Group fields for display
  const sections = [
    {
      title: "ข้อมูลส่วนตัว",
      fields: [
        ["First Name", record.First_Name],
        ["Last Name", record.Last_Name],
        ["ชื่อ (ไทย)", record.field4],
        ["Full Name", record.Full_Name_Labour],
        ["Gender", record.Gender],
        ["Birthday", record.Birthday],
        ["Nationality", record.Nationality],
        ["National ID", record.National_ID],
        ["Mobile", record.Mobile],
        ["Email", record.Email],
      ],
    },
    {
      title: "Passport & VISA",
      fields: [
        ["Passport ID", record.Passport_ID],
        ["Passport Status", record.Passport_Status],
        ["Passport Expire", record.Passport_Expire],
        ["VISA ID", record.VISA_ID],
        ["VISA Status", record.VISA_Status],
        ["VISA Start", record.VISA_Start_Date_0],
        ["VISA End", record.VISA_End_Date_0],
      ],
    },
    {
      title: "Work Permit",
      fields: [
        ["Work Permit ID", record.Work_Permit_ID],
        ["Workpermit Status", record.Workpermit_Status],
        ["Work Start Date", record.Work_Start_Date],
        ["Work End Date", record.Work_End_Date],
        ["WP Start", record.WP_Start_Date_0],
        ["WP End", record.WP_End_Date_0],
      ],
    },
    {
      title: "สถานะ & บริษัท",
      fields: [
        ["Foreigners Status", record.Foreigners_Status],
        ["Days Status", record.Days_Status],
        ["Account (Company)", record.Account_Name?.name],
        ["Immigrant Type", record.Immigrant_Type],
        ["Country/Region", record.Country_Region],
        ["Account Type", record.Account_Type],
      ],
    },
    {
      title: "ที่อยู่",
      fields: [
        ["Address Province", record.Address_Province],
        ["Address State", record.Address_State],
        ["Address City", record.Address_City],
        ["Address Street", record.Address_Street],
        ["Address Code", record.Address_Code],
        ["Immigration Bureau", record.Immigration_Bureau],
        ["Immigration Province", record.Immigration_Bureau_Province],
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card flex items-center justify-between px-6 py-4 border-b border-border z-10">
          <div>
            <h2 className="text-lg font-bold">
              {record.Full_Name_Labour ||
                `${record.First_Name || ""} ${record.Last_Name || ""}`.trim() ||
                "Record Detail"}
            </h2>
            <p className="text-xs text-muted mt-0.5">ID: {record.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {sections.map((section) => {
            const hasValues = section.fields.some(([, v]) => v != null && v !== "");
            if (!hasValues) return null;
            return (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-muted mb-3">{section.title}</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {section.fields.map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-xs text-muted">{label as string}</span>
                      <span className="text-xs font-medium text-right">
                        {value != null && value !== "" ? String(value) : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
