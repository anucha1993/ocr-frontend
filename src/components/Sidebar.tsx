"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Settings, LayoutDashboard, Server, GitBranch, TestTube, ChevronDown,
  Users, CreditCard, Scan, Map, ClipboardList, Search, UserCog,
  ScanSearch, FileText, Settings2, FileCog, Cloud, IdCard, Bell, Shield,
  Calculator,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ────────────── ข้อมูลแรงงาน ──────────────
const labourNav = [
  // { name: "ข้อมูลแรงงานต่างด้าว", href: "/foreign-data", icon: Users },
  // { name: "ค้นหาข้อมูลแรงงาน", href: "/foreign-data/search", icon: Search },
  { name: "รายการบันทึก", href: "/labours", icon: ClipboardList },
];

// ────────────── เครื่องอ่าน MRZ ──────────────
const mrzNav = [
  { name: "อ่านเอกสาร (MRZ)", href: "/id-card-reader", icon: CreditCard },
];

// ────────────── Google Cloud Vision OCR ──────────────
const ocrNav = [
  { name: "ประมวลผล OCR", href: "/ocr", icon: ScanSearch },
  { name: "ผลลัพธ์ OCR", href: "/ocr/results", icon: FileText },
];

const ocrAdminNav = [
  { name: "แม่แบบ OCR", href: "/ocr/templates", icon: FileCog },
];

// ────────────── ตั้งค่า (Admin) ──────────────
const adminNav = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "จัดการผู้ใช้งาน", href: "/users", icon: UserCog },
  { name: "Audit Log", href: "/audit-logs", icon: Shield },
];

const mrzSettingsNav = [
  { name: "ตั้งค่าเครื่องอ่าน MRZ", href: "/settings/id-card-reader", icon: Scan },
  { name: "Passport Mapping", href: "/settings/passport-mappings", icon: Map },
  { name: "API Providers", href: "/providers", icon: Server },
  { name: "API Endpoints", href: "/endpoints", icon: GitBranch },
  { name: "ทดสอบ API", href: "/test-api", icon: TestTube },
];

const ocrSettingsNav = [
  { name: "OCR Field Mappings", href: "/settings/ocr-fields", icon: Settings2 },
  { name: "คำนวณวันออกบัตร", href: "/settings/document-type-rules", icon: Calculator },
];

function NavLink({ href, icon: Icon, name, size = "md" }: { href: string; icon: React.ElementType; name: string; size?: "sm" | "md" }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg text-sm transition-colors ${
        size === "sm" ? "px-3 py-2" : "px-3 py-2.5"
      } ${
        isActive
          ? "bg-sidebar-active text-white font-medium"
          : size === "sm"
          ? "text-slate-400 hover:bg-white/10 hover:text-white"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className={`shrink-0 ${size === "sm" ? "w-4 h-4" : "w-5 h-5"}`} />
      <span>{name}</span>
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
      {label}
    </p>
  );
}

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[260px] bg-sidebar-bg text-white flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-xs">
          OCR
        </div>
        <div>
          <h1 className="text-sm font-semibold">Thefirst OCR</h1>
          <p className="text-[11px] text-slate-400">ระบบจัดการเอกสาร</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">

        {/* ── ข้อมูลแรงงาน ── */}
        <SectionLabel label="ข้อมูลแรงงาน" />
        {labourNav.map((item) => <NavLink key={item.href} {...item} />)}

        {/* ── เครื่องอ่าน MRZ ── */}
        <SectionLabel label="เครื่องอ่าน MRZ" />
        <div className="mx-3 mb-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 leading-tight">เชื่อมต่อผ่าน API Provider</p>
        </div>
        {mrzNav.map((item) => <NavLink key={item.href} {...item} />)}

        {/* ── Google Cloud Vision OCR ── */}
        <SectionLabel label="OCR (Google Cloud Vision)" />
        <div className="mx-3 mb-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 flex items-center gap-1.5">
          <Cloud className="w-3 h-3 text-blue-400 shrink-0" />
          <p className="text-[10px] text-blue-400 leading-tight">ประมวลผลผ่าน Cloud API</p>
        </div>
        {ocrNav.map((item) => <NavLink key={item.href} {...item} />)}
        {isAdmin && ocrAdminNav.map((item) => <NavLink key={item.href} {...item} />)}

        {/* ── แจ้งเตือน ── */}
        <SectionLabel label="แจ้งเตือน" />
        <NavLink href="/notifications" icon={Bell} name="การแจ้งเตือน" />

        {/* ── ตั้งค่า / ผู้ดูแล (Admin only) ── */}
        {isAdmin && (
          <div className="border-t border-white/10 mt-2 pt-1">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3">
                <Settings className="w-5 h-5 shrink-0" />
                <span className="font-medium">ตั้งค่า / ผู้ดูแล</span>
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>

            {settingsOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                {adminNav.map((item) => <NavLink key={item.href} {...item} size="sm" />)}

                {/* MRZ settings sub-group */}
                <p className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-500/70 select-none flex items-center gap-1">
                  <IdCard className="w-3 h-3" /> เครื่องอ่าน MRZ
                </p>
                {mrzSettingsNav.map((item) => <NavLink key={item.href} {...item} size="sm" />)}

                {/* OCR settings sub-group */}
                <p className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-400/70 select-none flex items-center gap-1">
                  <Cloud className="w-3 h-3" /> Google Cloud Vision
                </p>
                {ocrSettingsNav.map((item) => <NavLink key={item.href} {...item} size="sm" />)}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
