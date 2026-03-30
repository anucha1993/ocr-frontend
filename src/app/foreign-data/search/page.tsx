"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  User,
  Shield,
  Wifi,
  WifiOff,
  Zap,
  CreditCard,
  ChevronDown,
  Briefcase,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 5;

/* ── Types ── */

interface ZohoRecord {
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
  Passport_Expire?: string;
  VISA_Start_Date_0?: string;
  VISA_End_Date_0?: string;
  Work_Start_Date?: string;
  Work_End_Date?: string;
  WP_Start_Date_0?: string;
  WP_End_Date_0?: string;
  Account_Name?: { name?: string; id?: string };
  Gender?: string;
  Birthday?: string;
  Country_Region?: string;
  Immigrant_Type?: string;
  Account_Type?: string;
  Address_Province?: string;
  Address_State?: string;
  Address_City?: string;
  Address_Street?: string;
  Address_Code?: string;
  Immigration_Bureau?: string;
  Immigration_Bureau_Province?: string;
  Immigration_ID?: string;
  Days_Start_Date?: string;
  Days_End_Date?: string;
  field4?: string;
  [key: string]: unknown;
}

interface ReaderInfo { name: string; type: "idcard" | "passport"; }
type WsStatus = "disconnected" | "connecting" | "connected";

interface PPMapping {
  id: number;
  doc_type_code: string;
  country_code: string;
  field_map: { index: number; field: string }[];
  date_format: string;
  separator: string;
  is_active: boolean;
}

/* ── Passport date helpers ── */

/** Format any date string to dd/mm/yyyy */
function fmtDate(raw: string | undefined | null): string {
  if (!raw || raw === "—") return "—";
  const s = raw.trim();

  // YYMMDD (6 digits) — e.g. 911004 → 04/10/1991
  if (/^\d{6}$/.test(s)) {
    const yy = parseInt(s.substring(0, 2));
    const y = yy > 50 ? `19${s.substring(0, 2)}` : `20${s.substring(0, 2)}`;
    return `${s.substring(4, 6)}/${s.substring(2, 4)}/${y}`;
  }

  // ISO yyyy-mm-dd — e.g. 2025-07-17 → 17/07/2025
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.substring(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }

  // Already dd/mm/yyyy or other
  return s;
}

function formatMappedDate(raw: string, fmt: string): string {
  if (!raw) return "";
  try {
    if (fmt === "YYMMDD" && raw.length >= 6) {
      const yy = parseInt(raw.substring(0, 2));
      const y = yy > 50 ? `19${raw.substring(0, 2)}` : `20${raw.substring(0, 2)}`;
      return `${raw.substring(4, 6)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "YYYYMMDD" && raw.length >= 8)
      return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
    if (fmt === "DDMMYY" && raw.length >= 6) {
      const yy = parseInt(raw.substring(4, 6));
      const y = yy > 50 ? `19${raw.substring(4, 6)}` : `20${raw.substring(4, 6)}`;
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "DDMMYYYY" && raw.length >= 8)
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${raw.substring(4, 8)}`;
  } catch { /* ignore */ }
  return raw;
}

function parsePPWithMapping(text: string, mapping: PPMapping): Record<string, string> {
  const parts = text.split(mapping.separator);
  const result: Record<string, string> = {};
  const dateFields = ["birthdate", "expiry_date", "issue_date"];
  for (const fm of mapping.field_map) {
    const val = (parts[fm.index] || "").trim();
    if (fm.field === "_skip" || fm.field === "doc_type") continue;
    if (dateFields.includes(fm.field)) {
      result[fm.field] = formatMappedDate(val, mapping.date_format);
    } else if (fm.field === "firstname") {
      result.firstname = val;
    } else if (fm.field === "lastname") {
      result.lastname = val;
    } else {
      result[fm.field] = val;
    }
  }
  return result;
}

function findMapping(text: string, mappings: PPMapping[], separator = "#"): PPMapping | null {
  const parts = text.split(separator);
  const docType = (parts[0] || "").trim().toUpperCase();
  const country = (parts[1] || "").trim().toUpperCase();
  let match = mappings.find(
    (m) => m.doc_type_code.toUpperCase() === docType && m.country_code.toUpperCase() === country
  );
  if (match) return match;
  match = mappings.find((m) => m.country_code.toUpperCase() === country);
  return match || null;
}

function parseMRZ(mrz1: string, mrz2: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (mrz2 && mrz2.length >= 28) {
    result.passport_no = mrz2.substring(0, 9).replace(/</g, "").trim();
    result.nationality = mrz2.substring(10, 13).replace(/</g, "").trim();
  }
  void mrz1;
  return result;
}

/* ── Status color ── */
const statusColor = (v: string) => {
  const lower = v.toLowerCase();
  if (["active", "valid", "ถูกต้อง", "ปกติ", "ทำงาน"].some((k) => lower.includes(k)))
    return "bg-emerald-100 text-emerald-700";
  if (["expired", "หมดอายุ", "ไม่ถูกต้อง"].some((k) => lower.includes(k)))
    return "bg-red-100 text-red-700";
  if (["pending", "รอ"].some((k) => lower.includes(k)))
    return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

/* ── Data comparison helpers ── */

interface FieldMismatch {
  label: string;
  field: string;
  scanned: string;
  system: string;
}

/** Normalize values for comparison: trim, uppercase, strip separators */
function norm(v: string | undefined | null): string {
  if (!v || v === "—" || v === "-") return "";
  return v.trim().toUpperCase().replace(/[<\s]+/g, " ").replace(/\s+/g, " ");
}

const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  JANUARY: "01", FEBRUARY: "02", MARCH: "03", APRIL: "04",
  JUNE: "06", JULY: "07", AUGUST: "08", SEPTEMBER: "09",
  OCTOBER: "10", NOVEMBER: "11", DECEMBER: "12",
};

/** Normalize date values — convert all formats to YYYY-MM-DD for comparison */
function normDate(v: string | undefined | null): string {
  if (!v || v === "—") return "";
  const s = v.trim();

  // YYMMDD (6 digits)
  if (/^\d{6}$/.test(s)) {
    const yy = parseInt(s.substring(0, 2));
    const y = yy > 50 ? `19${s.substring(0, 2)}` : `20${s.substring(0, 2)}`;
    return `${y}-${s.substring(2, 4)}-${s.substring(4, 6)}`;
  }

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }

  // "15 JUN 2002" or "15 JUNE 2002"
  const mdy = s.toUpperCase().match(/^(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/);
  if (mdy) {
    const mm = MONTH_MAP[mdy[2]];
    if (mm) return `${mdy[3]}-${mm}-${mdy[1].padStart(2, "0")}`;
  }

  // "JUN 15, 2002" variant
  const mdy2 = s.toUpperCase().match(/^([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy2) {
    const mm = MONTH_MAP[mdy2[1]];
    if (mm) return `${mdy2[3]}-${mm}-${mdy2[2].padStart(2, "0")}`;
  }

  return s.toUpperCase();
}

/** Normalize gender to canonical form */
function normGender(v: string | undefined | null): string {
  if (!v) return "";
  const s = v.trim().toUpperCase();
  if (["M", "MALE", "ชาย"].includes(s)) return "M";
  if (["F", "FEMALE", "หญิง"].includes(s)) return "F";
  return s;
}

/** Normalize nationality — map English/Thai names to ISO code */
const NATIONALITY_MAP: Record<string, string> = {
  MYANMAR: "MMR", BURMA: "MMR", "เมียนมา": "MMR", "พม่า": "MMR", MMR: "MMR",
  CAMBODIA: "KHM", CAMBODIAN: "KHM", "กัมพูชา": "KHM", KHM: "KHM",
  LAOS: "LAO", LAO: "LAO", LAOTIAN: "LAO", "ลาว": "LAO", LA0: "LAO",
  VIETNAM: "VNM", VIETNAMESE: "VNM", "เวียดนาม": "VNM", VNM: "VNM",
  THAILAND: "THA", THAI: "THA", "ไทย": "THA", THA: "THA",
  CHINA: "CHN", CHINESE: "CHN", "จีน": "CHN", CHN: "CHN",
  INDIA: "IND", INDIAN: "IND", "อินเดีย": "IND", IND: "IND", "1ND": "IND",
  NEPAL: "NPL", NEPALESE: "NPL", "เนปาล": "NPL", NPL: "NPL",
  PHILIPPINES: "PHL", FILIPINO: "PHL", "ฟิลิปปินส์": "PHL", PHL: "PHL",
};

function normNationality(v: string | undefined | null): string {
  if (!v) return "";
  const s = v.trim().toUpperCase();
  return NATIONALITY_MAP[s] || s;
}

/** Compare scanned passport data vs Zoho record, return mismatches */
function compareData(
  scanned: { passport_no: string; firstname: string; lastname: string; nationality?: string; birthdate?: string; expiry_date?: string; sex?: string } | null,
  zoho: ZohoRecord | null
): FieldMismatch[] {
  if (!scanned || !zoho) return [];

  const mismatches: FieldMismatch[] = [];

  // ── Smart name comparison ──
  // Zoho sometimes stores full name in First_Name (e.g. "CHANTHA THOEURN")
  // or splits differently. Some nationalities (e.g. Lao) put surname first.
  // Compare combined full name in both orders.
  const scannedFullName = norm(`${scanned.firstname} ${scanned.lastname}`);
  const scannedReversed = norm(`${scanned.lastname} ${scanned.firstname}`);
  const zohoFullName = norm(`${zoho.First_Name || ""} ${zoho.Last_Name || ""}`);
  const zohoReversed = norm(`${zoho.Last_Name || ""} ${zoho.First_Name || ""}`);
  const zohoAltFullName = norm(zoho.Full_Name_Labour || "");

  // Collect all name tokens from both sides for containment check
  const scannedParts = [norm(scanned.firstname), norm(scanned.lastname)].filter(Boolean);
  const zohoParts = [norm(zoho.First_Name), norm(zoho.Last_Name)].filter(Boolean);

  const nameMatch =
    scannedFullName === zohoFullName ||
    scannedFullName === zohoReversed ||
    scannedReversed === zohoFullName ||
    scannedReversed === zohoReversed ||
    scannedFullName === zohoAltFullName ||
    scannedReversed === zohoAltFullName ||
    // Zoho First_Name contains both first+last (e.g. "CHANTHA THOEURN" in First_Name only)
    norm(zoho.First_Name) === scannedFullName ||
    norm(zoho.First_Name) === scannedReversed ||
    // All parts of scanned name exist in Zoho combined name (regardless of order/split)
    (scannedParts.length === 2 &&
      scannedParts.every((p) => zohoFullName.includes(p))) ||
    // All Zoho parts exist in scanned combined name
    (zohoParts.length === 2 &&
      zohoParts.every((p) => scannedFullName.includes(p)));

  if (scannedFullName && zohoFullName && !nameMatch) {
    mismatches.push({
      label: "ชื่อ-นามสกุล (Full Name)",
      field: "fullname",
      scanned: `${scanned.firstname} ${scanned.lastname}`.trim(),
      system: `${zoho.First_Name || ""} ${zoho.Last_Name || ""}`.trim(),
    });
  }

  // ── Other field checks ──
  const checks: { label: string; field: string; scannedVal: string | undefined; systemVal: string | undefined; isDate?: boolean; isGender?: boolean; isNat?: boolean }[] = [
    { label: "Passport No.", field: "passport_no", scannedVal: scanned.passport_no, systemVal: zoho.Passport_ID },
    { label: "สัญชาติ (Nationality)", field: "nationality", scannedVal: scanned.nationality, systemVal: zoho.Nationality, isNat: true },
    { label: "วันเกิด (Date of Birth)", field: "birthdate", scannedVal: scanned.birthdate, systemVal: zoho.Birthday, isDate: true },
    { label: "วันหมดอายุ (Date of Expiry)", field: "expiry_date", scannedVal: scanned.expiry_date, systemVal: zoho.Passport_Expire, isDate: true },
    { label: "เพศ (Sex)", field: "sex", scannedVal: scanned.sex, systemVal: zoho.Gender, isGender: true },
  ];

  for (const c of checks) {
    const sv = c.isDate ? normDate(c.scannedVal) : c.isGender ? normGender(c.scannedVal) : c.isNat ? normNationality(c.scannedVal) : norm(c.scannedVal);
    const zv = c.isDate ? normDate(c.systemVal) : c.isGender ? normGender(c.systemVal) : c.isNat ? normNationality(c.systemVal) : norm(c.systemVal);

    // Only compare if both have values
    if (sv && zv && sv !== zv) {
      mismatches.push({
        label: c.label,
        field: c.field,
        scanned: c.scannedVal || "",
        system: c.systemVal || "",
      });
    }
  }

  return mismatches;
}

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function ForeignDataSearchPage() {
  const searchParams = useSearchParams();

  /* ── Search state ── */
  const [query, setQuery] = useState(searchParams.get("passport_no") || "");
  const [data, setData] = useState<ZohoRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  /* ── Scanner state ── */
  const [wsUrl, setWsUrl] = useState("");
  const [autoConnect, setAutoConnect] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [ppMappings, setPpMappings] = useState<PPMapping[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [readerSelected, setReaderSelected] = useState(false);
  const [, setReaders] = useState<ReaderInfo[]>([]);
  const [selectedReader, setSelectedReader] = useState("");
  const [, setSelectedReaderType] = useState<"idcard" | "passport" | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [scannedPassport, setScannedPassport] = useState<{
    passport_no: string; firstname: string; lastname: string; photo: string;
    nationality?: string; birthdate?: string; expiry_date?: string;
    sex?: string; issuing_country?: string;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerSelectedRef = useRef(false);
  const selectedReaderTypeRef = useRef<"idcard" | "passport" | null>(null);
  const readingRef = useRef(false);
  const selectedReaderRef = useRef("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMessageRef = useRef<(event: MessageEvent) => void>(null as any);

  /* ── Helpers ── */

  const showMsg = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (wsRef.current) {
      wsRef.current.onopen = null; wsRef.current.onclose = null;
      wsRef.current.onerror = null; wsRef.current.onmessage = null;
      wsRef.current.close(); wsRef.current = null;
    }
  }, []);

  const wsSend = useCallback((obj: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(obj));
  }, []);

  /* ── Zoho search ── */
  const doSearch = useCallback(async (passportNo: string) => {
    if (!passportNo.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    setSearched(true);
    try {
      const res = await apiFetch(
        `/foreign-data/search?passport_no=${encodeURIComponent(passportNo.trim())}`
      );
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setData(json.data[0]);
      } else {
        setError("ไม่พบข้อมูลใน Thefirst OCR");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อ Zoho ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search if passport_no is in URL
  useEffect(() => {
    const pp = searchParams.get("passport_no");
    if (pp) { setQuery(pp); doSearch(pp); }
  }, [searchParams, doSearch]);

  /* ── Extract passport_no from scanned data and auto-search ── */
  const extractAndSearch = useCallback((ppData: Record<string, string>, photo: string) => {
    const passportNo = ppData.passport_no || "";
    if (!passportNo) return;
    setScannedPassport({
      passport_no: passportNo,
      firstname: ppData.firstname || "",
      lastname: ppData.lastname || "",
      photo,
      nationality: ppData.nationality,
      birthdate: ppData.birthdate,
      expiry_date: ppData.expiry_date,
      sex: ppData.sex,
      issuing_country: ppData.issuing_country,
    });
    setQuery(passportNo);
    doSearch(passportNo);
  }, [doSearch]);

  /* ── WebSocket message handler (passport-focused) ── */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      const msgType: string = msg.Message || "";
      const status: number = msg.Status ?? 0;

      if (msgType === "AgentStatusE") {
        if (status === 1) {
          showMsg("success", `IDW Agent: ${msg.AgentInfo || "Connected"}`);
          wsSend({ Command: "GetPPReaderList" });
        } else {
          showMsg("error", `Agent Error: ${status}`);
        }
        return;
      }

      if (msgType === "GetPPReaderListR") {
        if (status > 0 && msg.ReaderList) {
          const list: ReaderInfo[] = (msg.ReaderList as string[]).map((n: string) => ({ name: n, type: "passport" as const }));
          setReaders(list);
          if (list.length > 0) {
            wsSend({ Command: "SelectPPReader", ReaderName: list[0].name });
          }
          showMsg("info", `พบเครื่องอ่าน Passport ${list.length} เครื่อง`);
        } else {
          setReaders([]);
          showMsg("error", "ไม่พบเครื่องอ่าน Passport");
        }
        return;
      }

      if (msgType === "SelectPPReaderR") {
        if (status >= 0) {
          setSelectedReader(msg.ReaderName || "");
          selectedReaderRef.current = msg.ReaderName || "";
          setSelectedReaderType("passport");
          selectedReaderTypeRef.current = "passport";
          setReaderSelected(true);
          readerSelectedRef.current = true;
          showMsg("success", `เลือกเครื่องอ่าน: ${msg.ReaderName}`);
        } else {
          setReaderSelected(false);
          readerSelectedRef.current = false;
          showMsg("error", `SelectPPReader Error: ${status}`);
        }
        return;
      }

      if (msgType === "ReadingProgressE" || msgType === "PPReadingProgressE") {
        if (status === 0) {
          setProgress(msg.Progress || 0);
        } else {
          setReading(false); readingRef.current = false; setProgress(0);
        }
        return;
      }

      if (msgType === "ReadPassportR" || msgType === "AutoReadPassportE") {
        setReading(false);
        readingRef.current = false;
        setProgress(0);

        if (status === 0) {
          const allTextFields = [
            msg.PPMRZ1, msg.PPMrz1, msg.MRZ1,
            msg.PPMRZ2, msg.PPMrz2, msg.MRZ2,
            msg.PPMRZText, msg.PPMRZ, msg.MRZText,
            msg.PPText, msg.PPAText,
          ].filter(Boolean);
          const ppText = allTextFields.find((t: string) => t.includes("#")) || "";
          const photo = msg.PPPhoto || msg.Photo || "";

          let ppParsed: Record<string, string> = {};

          if (ppText) {
            const mapping = findMapping(ppText, ppMappings);
            if (mapping) {
              ppParsed = parsePPWithMapping(ppText, mapping);
              // Also keep issuing_country from the mapping match
              ppParsed.issuing_country = mapping.country_code;
            } else {
              const parts = ppText.split("#");
              ppParsed.passport_no = (parts[4] || "").trim();
              ppParsed.firstname = (parts[2] || "").trim();
              ppParsed.lastname = (parts[3] || "").trim();
            }
          }

          // Fallback from MRZ
          if (!ppParsed.passport_no) {
            const mrzLine2 = msg.PPMRZ2 || msg.PPMrz2 || msg.MRZ2 || "";
            const mrzFull = msg.PPMRZText || msg.PPMRZ || msg.MRZText || "";
            let mrz2 = mrzLine2;
            if (!mrz2 && mrzFull) {
              const lines = mrzFull.split(/[\r\n]+/).filter(Boolean);
              mrz2 = lines[1] || "";
            }
            if (mrz2) {
              const mrzData = parseMRZ("", mrz2);
              ppParsed.passport_no = mrzData.passport_no || "";
              if (mrzData.nationality) ppParsed.nationality = mrzData.nationality;
            }
          }

          if (ppParsed.passport_no) {
            extractAndSearch(ppParsed, photo);
            showMsg("success", `สแกนสำเร็จ: ${ppParsed.passport_no}`);
          } else {
            showMsg("error", "ไม่สามารถอ่านหมายเลข Passport ได้");
          }
        } else if (status === -16) {
          showMsg("error", "ไม่พบ Passport บนเครื่องอ่าน");
        } else {
          showMsg("error", `ReadPassport Error: ${status}`);
        }
        return;
      }

      if (msgType === "PPStatusChangeE") {
        if (status === 1) {
          showMsg("info", "ตรวจพบ Passport บนเครื่องอ่าน");
        }
        return;
      }
    } catch {
      setReading(false); readingRef.current = false;
      showMsg("error", "ข้อมูลจากเครื่องอ่านไม่ถูกต้อง");
    }
  }, [showMsg, ppMappings, wsSend, extractAndSearch]);

  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  /* ── Connect / Disconnect ── */
  const connect = useCallback(() => {
    if (!wsUrl) { showMsg("error", "ยังไม่ได้ตั้งค่า WebSocket — ไปที่ Settings > ID Card Reader"); return; }
    cleanup();
    setWsStatus("connecting");
    setReaderSelected(false); readerSelectedRef.current = false;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => { setWsStatus("connected"); reconnectCountRef.current = 0; showMsg("success", "เชื่อมต่อ IDW Agent สำเร็จ"); };
      ws.onmessage = (e) => handleMessageRef.current(e);
      ws.onclose = () => {
        setWsStatus("disconnected"); setReaders([]); setSelectedReader("");
        setSelectedReaderType(null); setReaderSelected(false); readerSelectedRef.current = false;
        if (reconnectCountRef.current < MAX_RECONNECT) {
          reconnectCountRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
        }
      };
      ws.onerror = () => { showMsg("error", "ไม่สามารถเชื่อมต่อ IDW Agent ได้"); };
    } catch { setWsStatus("disconnected"); showMsg("error", "WebSocket error"); }
  }, [cleanup, wsUrl, showMsg]);

  const disconnect = useCallback(() => {
    reconnectCountRef.current = MAX_RECONNECT;
    cleanup();
    setWsStatus("disconnected"); setReaders([]); setSelectedReader("");
    setSelectedReaderType(null); setReaderSelected(false); readerSelectedRef.current = false;
  }, [cleanup]);

  /* ── Scan passport ── */
  const scanPassport = useCallback(() => {
    if (!wsRef.current || wsStatus !== "connected") { showMsg("error", "ยังไม่ได้เชื่อมต่อ IDW Agent"); return; }
    if (!readerSelected) { showMsg("error", "ไม่พบเครื่องอ่าน Passport"); return; }
    setReading(true); readingRef.current = true; setProgress(0);
    wsSend({ Command: "ReadPassport", eMRZRead: true, FacePhotoRead: true, AccessControl: 0, ApduType: 1 });
  }, [wsStatus, readerSelected, wsSend, showMsg]);

  /* ── One-click: connect → select → scan ── */
  const oneClickScan = useCallback(async () => {
    if (!wsRef.current || wsStatus !== "connected") { showMsg("error", "ยังไม่ได้เชื่อมต่อ IDW Agent"); return; }
    setReading(true); readingRef.current = true; setProgress(0);
    const waitFor = (name: string, ms: number) =>
      new Promise<Record<string, unknown>>((resolve) => {
        const orig = wsRef.current?.onmessage;
        const ws = wsRef.current;
        const t = setTimeout(() => { if (ws) ws.onmessage = orig || null; resolve({ Message: name, Status: -999 }); }, ms);
        if (ws) {
          ws.onmessage = (evt: MessageEvent) => {
            const m = JSON.parse(evt.data);
            if (m.Message === name) { clearTimeout(t); ws.onmessage = orig || null; handleMessage(evt); resolve(m); }
            else { handleMessage(evt); }
          };
        }
      });
    wsSend({ Command: "GetPPReaderList" });
    const ppResult = await waitFor("GetPPReaderListR", 5000);
    const ppList: ReaderInfo[] = (ppResult.Status as number) > 0 && ppResult.ReaderList
      ? (ppResult.ReaderList as string[]).map((n: string) => ({ name: n, type: "passport" as const }))
      : [];
    if (ppList.length === 0) { setReading(false); readingRef.current = false; showMsg("error", "ไม่พบเครื่องอ่าน Passport"); return; }
    wsSend({ Command: "SelectPPReader", ReaderName: ppList[0].name });
    const sel = await waitFor("SelectPPReaderR", 5000);
    if ((sel.Status as number) < 0) { setReading(false); readingRef.current = false; showMsg("error", "เลือกเครื่องอ่านไม่สำเร็จ"); return; }
    wsSend({ Command: "ReadPassport", eMRZRead: true, FacePhotoRead: true, AccessControl: 0, ApduType: 1 });
    await waitFor("ReadPassportR", 40000);
    setReading(false); readingRef.current = false;
  }, [wsStatus, wsSend, handleMessage, showMsg]);

  /* ── Load settings on mount ── */
  useEffect(() => {
    Promise.all([
      apiFetch(`/idcard-reader-settings`).then((r) => r.json()).catch(() => null),
      apiFetch(`/passport-mappings`).then((r) => r.json()).catch(() => []),
    ]).then(([settings, mappings]) => {
      if (settings) {
        setWsUrl(`ws://${settings.ws_host || "127.0.0.1"}:${settings.ws_port || 14820}/IDWAgent`);
        setAutoConnect(settings.auto_connect || false);
      } else {
        setWsUrl("ws://127.0.0.1:14820/IDWAgent");
      }
      if (Array.isArray(mappings)) {
        setPpMappings(mappings.filter((m: PPMapping) => m.is_active !== false));
      }
      setSettingsLoaded(true);
    });
    return () => { reconnectCountRef.current = MAX_RECONNECT; cleanup(); };
  }, [cleanup]);

  useEffect(() => {
    if (settingsLoaded && autoConnect && wsUrl) connect();
  }, [settingsLoaded, autoConnect, wsUrl, connect]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query); };

  /* ══════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* ── Compact toolbar ── */}
      <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Scanner status dot + connect/scan */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            wsStatus === "connected" ? "bg-emerald-500" : wsStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-300"
          }`} />
          {wsStatus !== "connected" ? (
            <button
              onClick={connect}
              disabled={wsStatus === "connecting"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {wsStatus === "connecting" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              เชื่อมต่อเครื่องอ่าน
            </button>
          ) : (
            <>
              {selectedReader && (
                <span className="text-xs text-muted">
                  {selectedReader}
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">PASSPORT</span>
                </span>
              )}
              <button
                onClick={scanPassport}
                disabled={reading || !readerSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {reading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                สแกน
              </button>
              <button
                onClick={oneClickScan}
                disabled={reading}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                title="One-click scan"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button onClick={disconnect} className="text-[11px] text-muted hover:text-red-500 transition-colors ml-1">
                <WifiOff className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Progress */}
        {reading && progress > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <div className="h-1.5 flex-1 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-muted">{progress}%</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Manual search toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          ค้นหาด้วย Passport No.
          <ChevronDown className={`w-3 h-3 transition-transform ${showSearch ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── Collapsible search ── */}
      {showSearch && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="กรอกหมายเลข Passport..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ค้นหา
          </button>
        </form>
      )}

      {/* ── Toast ── */}
      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
          message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Reading indicator ── */}
      {reading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-indigo-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          วาง Passport บนเครื่องอ่าน...
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted">กำลังค้นหาใน Zoho...</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-muted">{error}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !data && !searched && !reading && (
        <div className="bg-card rounded-xl border border-border p-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-indigo-300" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">สแกน Passport เพื่อค้นหา</h3>
          <p className="text-sm text-muted">วาง Passport บนเครื่องอ่านแล้วกดสแกน</p>
        </div>
      )}

      {/* ══════════════ Passport Template ══════════════ */}
      {!loading && data && (() => {
        const firstName = data.First_Name || "";
        const lastName = data.Last_Name || "";
        const mismatches = compareData(scannedPassport, data);
        const mismatchFields = new Set(mismatches.map((m) => m.field));
        return (
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ── Data Comparison Result ── */}
          {scannedPassport && (
            <div className={`rounded-xl border-2 overflow-hidden ${
              mismatches.length > 0
                ? "border-red-300 bg-red-50"
                : "border-emerald-300 bg-emerald-50"
            }`}>
              <div className={`px-4 py-2.5 flex items-center gap-2 ${
                mismatches.length > 0
                  ? "bg-red-100"
                  : "bg-emerald-100"
              }`}>
                {mismatches.length > 0 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">
                      พบข้อมูลไม่ตรงกัน {mismatches.length} รายการ — กรุณาตรวจสอบ
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">
                      ข้อมูลจากเครื่องอ่านตรงกับข้อมูลในระบบ
                    </span>
                  </>
                )}
              </div>
              {mismatches.length > 0 && (
                <div className="px-4 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-red-500/70">
                        <th className="pb-2 font-medium">ฟิลด์</th>
                        <th className="pb-2 font-medium">ข้อมูลจากเครื่องอ่าน</th>
                        <th className="pb-2 font-medium">ข้อมูลในระบบ (Zoho)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mismatches.map((m) => (
                        <tr key={m.field} className="border-t border-red-200/60">
                          <td className="py-2 pr-3 font-medium text-red-800">{m.label}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-xs">
                              {m.scanned || "—"}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-xs">
                              {m.system || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="bg-[#f5f0e8] rounded-2xl border-2 border-[#c4b89a] overflow-hidden shadow-lg">
            {/* Top band */}
            <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2a5a8c] px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-amber-300/60 flex items-center justify-center">
                  <span className="text-amber-300 text-[10px] font-bold">&#9733;</span>
                </div>
                <div>
                  <p className="text-[9px] text-blue-200 uppercase tracking-[0.2em] font-medium">Thefirst OCR Record</p>
                  <p className="text-[11px] text-white font-semibold tracking-wider">{data.Nationality || "PASSPORT"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    window.open(`https://crm.zoho.com/crm/org853559971/tab/CustomModule2/${data.id}`, "_blank");
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  title="เปิดใน Zoho CRM"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => doSearch(query)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  title="โหลดใหม่"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main passport body */}
            <div className="p-5 sm:p-6">
              <div className="flex gap-5">
                {/* Photo */}
                <div className="shrink-0">
                  <div className="w-24 sm:w-28 aspect-[3/4] rounded-md border-2 border-[#c4b89a] bg-white overflow-hidden shadow-inner">
                    {scannedPassport?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${scannedPassport.photo}`}
                        alt="Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#f0ece4]">
                        <User className="w-10 h-10 text-[#c4b89a]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal fields */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                    <PPField label="Type" value="P" />
                    <PPField label="Country Code" value={scannedPassport?.issuing_country?.toUpperCase() || data.Country_Region?.toUpperCase() || "—"} />
                    <PPField label="Surname / ชื่อสกุล" value={scannedPassport?.lastname?.toUpperCase() || lastName.toUpperCase() || "—"} full warn={mismatchFields.has("fullname")} />
                    <PPField label="Given Names / ชื่อ" value={scannedPassport?.firstname?.toUpperCase() || firstName.toUpperCase() || "—"} full warn={mismatchFields.has("fullname")} />
                    <PPField label="Nationality" value={scannedPassport?.nationality || data.Nationality || "—"} warn={mismatchFields.has("nationality")} />
                    <PPField label="Date of Birth" value={fmtDate(scannedPassport?.birthdate || data.Birthday)} warn={mismatchFields.has("birthdate")} />
                    <PPField label="Sex" value={scannedPassport?.sex || data.Gender || "—"} warn={mismatchFields.has("sex")} />
                    <PPField label="National ID" value={data.National_ID || "—"} mono />
                  </div>
                </div>
              </div>

              {/* Passport number */}
              <div className="mt-4 pt-3 border-t-2 border-dashed border-[#c4b89a]/60 flex items-center justify-between">
                <PPField label="Passport No." value={scannedPassport?.passport_no || data.Passport_ID || "—"} large mono warn={mismatchFields.has("passport_no")} />
                <div className="text-right">
                  <PPField label="Date of Expiry" value={fmtDate(scannedPassport?.expiry_date || (data.Passport_Expire as string))} warn={mismatchFields.has("expiry_date")} />
                </div>
              </div>

              {/* MRZ zone */}
              {(() => {
                const mrzCountry = (scannedPassport?.issuing_country || data.Country_Region || "XXX").toUpperCase();
                const mrzLast = (scannedPassport?.lastname || lastName).toUpperCase().replace(/\s/g, "");
                const mrzFirst = (scannedPassport?.firstname || firstName).toUpperCase().replace(/\s/g, "<");
                const mrzPP = (scannedPassport?.passport_no || data.Passport_ID || "").toUpperCase().padEnd(9, "<");
                const mrzDob = (data.Birthday || "000000").replace(/[-/]/g, "").substring(0, 6);
                return (
                <div className="mt-3 bg-[#e8e2d6] rounded-md px-3 py-2 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] text-[#3a3a3a] leading-relaxed overflow-x-auto select-all">
                  <div>P&lt;{mrzCountry}{mrzLast}&lt;&lt;{mrzFirst}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
                  <div>{mrzPP}&lt;{mrzCountry}{mrzDob}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
                </div>
                );
              })()}

              {/* ── Status badges ── */}
              <div className="flex flex-wrap items-center gap-1.5 mt-4">
                <StatusBadge value={data.Foreigners_Status} />
                <StatusBadge value={data.Passport_Status} prefix="PP" />
                <StatusBadge value={data.VISA_Status} prefix="VISA" />
                <StatusBadge value={data.Workpermit_Status} prefix="WP" />
                <StatusBadge value={data.Days_Status} prefix="90D" />
              </div>

              {/* ── VISA / Work Permit / Company / 90 Days ── */}
              <div className="mt-4 pt-3 border-t-2 border-dashed border-[#c4b89a]/60">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* VISA */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3.5 h-3.5 text-violet-600" />
                      <span className="text-[10px] text-[#8a7e6b] uppercase tracking-wider font-semibold">VISA</span>
                    </div>
                    <PPField label="เลขที่" value={data.VISA_ID || "—"} mono />
                    <div className="mt-1"><PPField label="สถานะ" value={data.VISA_Status || "—"} /></div>
                    <div className="mt-1"><PPField label="เริ่มต้น" value={fmtDate(data.VISA_Start_Date_0)} /></div>
                    <div className="mt-1"><PPField label="สิ้นสุด" value={fmtDate(data.VISA_End_Date_0)} /></div>
                  </div>

                  {/* Work Permit */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] text-[#8a7e6b] uppercase tracking-wider font-semibold">ใบอนุญาตทำงาน</span>
                    </div>
                    <PPField label="เลขที่" value={data.Work_Permit_ID || "—"} mono />
                    <div className="mt-1"><PPField label="สถานะ" value={data.Workpermit_Status || "—"} /></div>
                    <div className="mt-1"><PPField label="เริ่มต้น" value={fmtDate(data.WP_Start_Date_0)} /></div>
                    <div className="mt-1"><PPField label="สิ้นสุด" value={fmtDate(data.WP_End_Date_0)} /></div>
                  </div>

                  {/* 90 Days */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                      <span className="text-[10px] text-[#8a7e6b] uppercase tracking-wider font-semibold">90 Days</span>
                    </div>
                    <PPField label="เริ่มต้น" value={fmtDate(data.Days_Start_Date)} />
                    <div className="mt-1"><PPField label="สิ้นสุด" value={fmtDate(data.Days_End_Date)} /></div>
                    <div className="mt-1"><PPField label="เลขที่ ตม." value={data.Immigration_Bureau || "—"} mono /></div>
                    <div className="mt-1"><PPField label="ตม. จังหวัด" value={data.Immigration_Bureau_Province || "—"} /></div>
                  </div>

                  {/* Company */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] text-[#8a7e6b] uppercase tracking-wider font-semibold">บริษัท</span>
                    </div>
                    <PPField label="บริษัท" value={data.Account_Name?.name || "—"} />
                    <div className="mt-1"><PPField label="Agency" value={(data.Agency as {name?: string})?.name || "—"} /></div>
                    <div className="mt-1"><PPField label="ประเภทแรงงาน" value={(data.Immigrant_Type as string) || "—"} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

/* ── Sub-components ── */

function PPField({ label, value, full, large, mono, warn }: {
  label: string; value: string; full?: boolean; large?: boolean; mono?: boolean; warn?: boolean;
}) {
  return (
    <div className={`${full ? "col-span-2" : ""} ${warn ? "relative rounded-md px-1.5 py-0.5 -mx-1.5 bg-red-100/80 ring-1 ring-red-300" : ""}`}>
      <p className={`text-[9px] sm:text-[10px] uppercase tracking-wider leading-none mb-0.5 ${warn ? "text-red-500 font-semibold" : "text-[#8a7e6b]"}`}>
        {warn && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 align-middle" />}
        {label}
      </p>
      <p className={`leading-tight truncate ${
        large ? "text-lg sm:text-xl font-bold" : "text-sm font-semibold"
      } ${mono ? "font-mono tracking-wider" : ""} ${warn ? "text-red-700" : "text-[#1a1a1a]"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ value, prefix }: { value?: string; prefix?: string }) {
  if (!value) return null;
  const label = prefix ? `${prefix}: ${value}` : value;
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${statusColor(value)}`}>
      {label}
    </span>
  );
}


