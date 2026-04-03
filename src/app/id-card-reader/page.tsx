"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Wifi, WifiOff, CreditCard, Loader2, RefreshCw, AlertCircle, CheckCircle2, Settings2, Zap, BookOpen, Trash2, Upload, X, Search, ExternalLink } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 5;

interface DocumentData {
  document_type: "idcard" | "passport";
  id_card: string;
  prefix: string;
  firstname: string;
  middlename: string;
  lastname: string;
  firstname_en: string;
  middlename_en: string;
  lastname_en: string;
  birthdate: string;
  gender: string;
  address: string;
  issue_date: string;
  expiry_date: string;
  issue_place: string;
  photo: string;
  // Passport
  passport_no: string;
  nationality: string;
  mrz1: string;
  mrz2: string;
}

interface ReaderInfo {
  name: string;
  type: "idcard" | "passport";
}

type WsStatus = "disconnected" | "connecting" | "connected";

/* ── IDW SDK date parser: YYYYMMDD → DD/MM/YYYY ── */
function formatDate(raw: string): string {
  if (!raw || raw.length < 8) return raw || "";
  const y = raw.substring(0, 4);
  const m = raw.substring(4, 6);
  const d = raw.substring(6, 8);
  return `${d}/${m}/${y}`;
}

/* ── Passport date parser: YYMMDD → DD/MM/YYYY ── */
function formatPPDate(raw: string): string {
  if (!raw || raw.length < 6) return raw || "";
  const yy = parseInt(raw.substring(0, 2));
  const y = yy > 50 ? `19${raw.substring(0, 2)}` : `20${raw.substring(0, 2)}`;
  const m = raw.substring(2, 4);
  const d = raw.substring(4, 6);
  return `${d}/${m}/${y}`;
}

/* ── Mapping-based date formatter ── */
function formatMappedDate(raw: string, fmt: string): string {
  if (!raw) return "";
  try {
    if (fmt === "YYMMDD" && raw.length >= 6) {
      const yy = parseInt(raw.substring(0, 2));
      const y = yy > 50 ? `19${raw.substring(0, 2)}` : `20${raw.substring(0, 2)}`;
      return `${raw.substring(4, 6)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "YYYYMMDD" && raw.length >= 8) {
      return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
    }
    if (fmt === "DDMMYY" && raw.length >= 6) {
      const yy = parseInt(raw.substring(4, 6));
      const y = yy > 50 ? `19${raw.substring(4, 6)}` : `20${raw.substring(4, 6)}`;
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${y}`;
    }
    if (fmt === "DDMMYYYY" && raw.length >= 8) {
      return `${raw.substring(0, 2)}/${raw.substring(2, 4)}/${raw.substring(4, 8)}`;
    }
  } catch { /* ignore */ }
  return raw;
}

interface PPMapping {
  id: number;
  doc_type_code: string;
  country_code: string;
  field_map: { index: number; field: string }[];
  date_format: string;
  separator: string;
  is_active: boolean;
}

/* ── Parse passport text using dynamic mapping ── */
function parsePPWithMapping(text: string, mapping: PPMapping): Partial<DocumentData> {
  const parts = text.split(mapping.separator);
  const result: Partial<DocumentData> = {};
  const dateFields = ["birthdate", "expiry_date", "issue_date"];

  for (const fm of mapping.field_map) {
    const val = (parts[fm.index] || "").trim();
    if (fm.field === "_skip" || fm.field === "doc_type" || fm.field === "issuing_country") continue;

    if (dateFields.includes(fm.field)) {
      (result as Record<string, string>)[fm.field] = formatMappedDate(val, mapping.date_format);
    } else if (fm.field === "gender") {
      result.gender = val;
    } else if (fm.field === "firstname") {
      result.firstname = val;
      result.firstname_en = val;
    } else if (fm.field === "lastname") {
      result.lastname = val;
      result.lastname_en = val;
    } else if (fm.field === "personal_no") {
      result.id_card = val;
    } else if (fm.field === "issue_place") {
      result.issue_place = val;
    } else {
      (result as Record<string, string>)[fm.field] = val;
    }
  }
  return result;
}

/* ── Find matching mapping by detecting doc_type + country from raw text ── */
function findMapping(text: string, mappings: PPMapping[], separator = "#"): PPMapping | null {
  const parts = text.split(separator);
  const docType = (parts[0] || "").trim().toUpperCase();
  const country = (parts[1] || "").trim().toUpperCase();

  // Try exact match first
  let match = mappings.find(
    (m) => m.doc_type_code.toUpperCase() === docType && m.country_code.toUpperCase() === country
  );
  if (match) return match;

  // Try by country only
  match = mappings.find((m) => m.country_code.toUpperCase() === country);
  return match || null;
}

/* ── Parse standard MRZ lines (44-char ICAO format) ── */
function parseMRZ(mrz1: string, mrz2: string): Partial<DocumentData> {
  const result: Partial<DocumentData> = {};
  if (mrz1 && mrz1.length >= 5) {
    const countryEnd = 5;
    result.issue_place = mrz1.substring(2, countryEnd).replace(/</g, "").trim();
    const namePart = mrz1.substring(countryEnd).replace(/<+$/g, "");
    const nameParts = namePart.split("<<");
    if (nameParts[0]) result.lastname_en = nameParts[0].replace(/</g, " ").trim();
    if (nameParts[1]) result.firstname_en = nameParts[1].replace(/</g, " ").trim();
  }
  if (mrz2 && mrz2.length >= 28) {
    result.passport_no = mrz2.substring(0, 9).replace(/</g, "").trim();
    result.nationality = mrz2.substring(10, 13).replace(/</g, "").trim();
    const dob = mrz2.substring(13, 19);
    result.birthdate = formatPPDate(dob);
    const sex = mrz2.substring(20, 21);
    result.gender = sex;
    const expiry = mrz2.substring(21, 27);
    result.expiry_date = formatPPDate(expiry);
    const personalNo = mrz2.substring(28, 42)?.replace(/</g, "").trim();
    if (personalNo) result.id_card = personalNo;
  }
  return result;
}

/* ── Parse IDText / IDAText (#-delimited) from IDW Agent ── */
function parseIDText(text: string): Partial<DocumentData> {
  const f = text.split("#");
  return {
    id_card: f[0] || "",
    prefix: (f[1] || "").trim(),
    firstname: (f[2] || "").trim(),
    middlename: (f[3] || "").trim(),
    lastname: (f[4] || "").trim(),
    firstname_en: ((f[5] || "") + " " + (f[6] || "")).trim(),
    middlename_en: (f[7] || "").trim(),
    lastname_en: (f[8] || "").trim(),
    address: [f[9], f[10], f[11], f[12], f[13], f[14], f[15], f[16]]
      .filter(Boolean)
      .join(" ")
      .trim(),
    gender: f[17] === "1" ? "M" : f[17] === "2" ? "F" : f[17] || "",
    birthdate: formatDate(f[18]),
    issue_place: (f[19] || "").trim(),
    issue_date: formatDate(f[20]),
    expiry_date: formatDate(f[21]),
  };
}

export default function IdCardReaderPage() {
  const [wsUrl, setWsUrl] = useState("");
  const [autoConnect, setAutoConnect] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [ppMappings, setPpMappings] = useState<PPMapping[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [readerSelected, setReaderSelected] = useState(false);
  const [readers, setReaders] = useState<ReaderInfo[]>([]);
  const [selectedReader, setSelectedReader] = useState("");
  const [selectedReaderType, setSelectedReaderType] = useState<"idcard" | "passport" | null>(null);
  const [cardData, setCardData] = useState<DocumentData | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [scannedRows, setScannedRows] = useState<DocumentData[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [progress, setProgress] = useState(0);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [agentInfo, setAgentInfo] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);


  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveRef = useRef(false);
  const readerSelectedRef = useRef(false);
  const scannedRowsRef = useRef<DocumentData[]>([]);
  const autoScanRef = useRef(false);
  const selectedReaderTypeRef = useRef<"idcard" | "passport" | null>(null);
  const readingRef = useRef(false);
  const selectedReaderRef = useRef("");  // track current reader name for re-select
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMessageRef = useRef<(event: MessageEvent) => void>(null as any);

  // Keep refs in sync with state (survives hot-reload)
  useEffect(() => { autoScanRef.current = autoScan; }, [autoScan]);
  useEffect(() => { readerSelectedRef.current = readerSelected; }, [readerSelected]);
  useEffect(() => { readingRef.current = reading; }, [reading]);
  useEffect(() => { selectedReaderTypeRef.current = selectedReaderType; }, [selectedReaderType]);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  const showMessage = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  /* ── Add scanned document to batch queue (duplicate check) ── */
  const addScannedRow = useCallback((data: DocumentData) => {
    const key = data.document_type === "passport" ? data.passport_no : data.id_card;
    if (!key) {
      showMessage("error", "ไม่พบหมายเลขเอกสาร — ไม่สามารถเพิ่มได้");
      return;
    }
    const existing = scannedRowsRef.current;
    const isDuplicate = existing.some((r) =>
      data.document_type === "passport"
        ? r.passport_no === data.passport_no
        : r.id_card === data.id_card
    );
    if (isDuplicate) {
      showMessage("error", `เอกสารซ้ำ: ${key} — มีอยู่ในรายการแล้ว`);
      return;
    }
    const updated = [...existing, data];
    scannedRowsRef.current = updated;
    setScannedRows(updated);
    showMessage("success", `เพิ่มรายการ: ${data.firstname_en || data.firstname || ""} ${data.lastname_en || data.lastname || ""} (${key})`);
  }, [showMessage]);

  const removeScannedRow = useCallback((index: number) => {
    const updated = scannedRowsRef.current.filter((_, i) => i !== index);
    scannedRowsRef.current = updated;
    setScannedRows(updated);
  }, []);

  const clearScannedRows = useCallback(() => {
    scannedRowsRef.current = [];
    setScannedRows([]);
  }, []);

  const updateCardField = useCallback((field: string, value: string) => {
    setCardData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      setSelectedRowIdx(idx => {
        if (idx !== null) {
          setScannedRows(rows => {
            const newRows = [...rows];
            newRows[idx] = updated;
            scannedRowsRef.current = newRows;
            return newRows;
          });
        }
        return idx;
      });
      return updated;
    });
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /* ── Send JSON command to IDW Agent ── */
  const wsSend = useCallback((obj: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(obj));
  }, []);

  /* ── Convert display date (DD/MM/YYYY or YYYYMMDD) to YYYY-MM-DD for API ── */
  const toISODate = (val: string | undefined): string | undefined => {
    if (!val) return undefined;
    // DD/MM/YYYY
    const ddmm = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
    // YYYYMMDD
    if (/^\d{8}$/.test(val)) return `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
    // YYMMDD
    if (/^\d{6}$/.test(val)) {
      const yy = parseInt(val.substring(0, 2));
      const y = yy > 50 ? `19${val.substring(0, 2)}` : `20${val.substring(0, 2)}`;
      return `${y}-${val.substring(2, 4)}-${val.substring(4, 6)}`;
    }
    return val;
  };

  /* ── Save card data to Laravel API ── */
  const saveCardToApi = useCallback(async (data: DocumentData, auto = false) => {
    setSaving(true);
    try {
      const res = await apiFetch("/idcard", {
        method: "POST",
        body: JSON.stringify({
          document_type: data.document_type,
          id_card: data.id_card || undefined,
          passport_no: data.passport_no || undefined,
          prefix: data.prefix,
          firstname: data.firstname + (data.middlename ? ` ${data.middlename}` : ""),
          lastname: data.lastname,
          birthdate: toISODate(data.birthdate),
          address: data.address,
          nationality: data.nationality || undefined,
          issue_date: toISODate(data.issue_date),
          expiry_date: toISODate(data.expiry_date),
          photo: data.photo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      const result = await res.json();
      showMessage("success", `${auto ? "(Auto) " : ""}${result.message || "บันทึกข้อมูลสำเร็จ"}`);
    } catch (err) {
      showMessage("error", `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }, [showMessage]);

  /* ── Handle all messages from IDW Agent ── */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      const msgType: string = msg.Message || "";
      const status: number = msg.Status ?? 0;

      // ─── AgentStatusE: Agent connected & ready ───
      if (msgType === "AgentStatusE") {
        if (status === 1) {
          setAgentInfo(msg.AgentInfo || "");
          showMessage("success", `IDW Agent: ${msg.AgentInfo || "Connected"}`);
          // Agent is ready — request reader lists + set auto-read options
          wsRef.current?.send(JSON.stringify({ Command: "GetReaderList" }));
          wsRef.current?.send(JSON.stringify({ Command: "GetPPReaderList" }));
          // Set auto-read options (like reference sample)
          wsRef.current?.send(JSON.stringify({
            Command: "SetAutoReadOptions",
            AutoRead: autoScanRef.current,
            IDNumberRead: true, IDTextRead: true, IDATextRead: true, IDPhotoRead: true,
          }));
          wsRef.current?.send(JSON.stringify({
            Command: "SetAutoReadPPOptions",
            AutoRead: autoScanRef.current,
            eMRZRead: true, FacePhotoRead: true, ExtraDataRead: false,
            AccessControl: 0, PassiveAuth: false, ChipAuth: false, ActiveAuth: false, ApduType: 1,
          }));
        } else {
          showMessage("error", `Agent Error Code: ${status}`);
        }
        return;
      }

      // ─── GetReaderListR: Thai ID card reader list ───
      if (msgType === "GetReaderListR") {
        if (status > 0 && msg.ReaderList) {
          const list: ReaderInfo[] = (msg.ReaderList as string[]).map((name: string) => ({ name, type: "idcard" as const }));
          setReaders((prev) => {
            const ppReaders = prev.filter((r) => r.type === "passport");
            return [...list, ...ppReaders];
          });
          // Auto-select first ID card reader if none selected
          if (!readerSelectedRef.current && list.length > 0) {
            wsRef.current?.send(JSON.stringify({ Command: "SelectReader", ReaderName: list[0].name }));
          }
          showMessage("info", `พบเครื่องอ่านบัตรประชาชน ${list.length} เครื่อง`);
        } else {
          setReaders((prev) => prev.filter((r) => r.type === "passport"));
        }
        return;
      }

      // ─── GetPPReaderListR: Passport reader list ───
      if (msgType === "GetPPReaderListR") {
        if (status > 0 && msg.ReaderList) {
          const list: ReaderInfo[] = (msg.ReaderList as string[]).map((name: string) => ({ name, type: "passport" as const }));
          setReaders((prev) => {
            const idReaders = prev.filter((r) => r.type === "idcard");
            return [...idReaders, ...list];
          });
          // Auto-select first passport reader (priority over ID card)
          if (list.length > 0) {
            wsRef.current?.send(JSON.stringify({ Command: "SelectPPReader", ReaderName: list[0].name }));
          }
          showMessage("info", `พบเครื่องอ่าน Passport ${list.length} เครื่อง`);
        } else {
          setReaders((prev) => prev.filter((r) => r.type === "idcard"));
        }
        return;
      }

      // ─── SelectReaderR: Reader selected response ───
      if (msgType === "SelectReaderR") {
        if (status >= 0) {
          const isReselect = selectedReaderRef.current === (msg.ReaderName || "");
          setSelectedReader(msg.ReaderName || "");
          selectedReaderRef.current = msg.ReaderName || "";
          setSelectedReaderType("idcard");
          selectedReaderTypeRef.current = "idcard";
          setReaderSelected(true);
          readerSelectedRef.current = true;
          if (!isReselect) showMessage("success", `เลือกเครื่องอ่านบัตร: ${msg.ReaderName}`);
          // Auto-read only on first select (not re-select after read)
          if (!isReselect && autoScanRef.current && !readingRef.current) {
            setTimeout(() => {
              if (!readingRef.current && wsRef.current) {
                setReading(true);
                readingRef.current = true;
                setCardData(null);
                setProgress(0);
                wsRef.current.send(JSON.stringify({ Command: "ReadIDCard", IDNumberRead: true, IDTextRead: true, IDATextRead: true, IDPhotoRead: true }));
              }
            }, 300);
          }
        } else {
          setReaderSelected(false);
          readerSelectedRef.current = false;
          showMessage("error", `SelectReader Error: ${status}`);
        }
        return;
      }

      // ─── SelectPPReaderR: Passport reader selected response ───
      if (msgType === "SelectPPReaderR") {
        if (status >= 0) {
          const isReselect = selectedReaderRef.current === (msg.ReaderName || "");
          setSelectedReader(msg.ReaderName || "");
          selectedReaderRef.current = msg.ReaderName || "";
          setSelectedReaderType("passport");
          selectedReaderTypeRef.current = "passport";
          setReaderSelected(true);
          readerSelectedRef.current = true;
          if (!isReselect) showMessage("success", `เลือกเครื่องอ่าน Passport: ${msg.ReaderName}`);
          // Auto-read only on first select (not re-select after read)
          if (!isReselect && autoScanRef.current && !readingRef.current) {
            setTimeout(() => {
              if (!readingRef.current && wsRef.current) {
                setReading(true);
                readingRef.current = true;
                setCardData(null);
                setProgress(0);
                wsRef.current.send(JSON.stringify({ Command: "ReadPassport", eMRZRead: true, FacePhotoRead: true, AccessControl: 0, ApduType: 1 }));
              }
            }, 300);
          }
        } else {
          setReaderSelected(false);
          readerSelectedRef.current = false;
          showMessage("error", `SelectPPReader Error: ${status}`);
        }
        return;
      }

      // ─── AutoSelectReaderE: Auto-selected reader event ───
      if (msgType === "AutoSelectReaderE") {
        if (status >= 0 && msg.ReaderName) {
          setSelectedReader(msg.ReaderName);
          setSelectedReaderType("idcard");
          selectedReaderTypeRef.current = "idcard";
          setReaderSelected(true);
          readerSelectedRef.current = true;
        }
        return;
      }

      // ─── ReadingProgressE: Reading progress ───
      if (msgType === "ReadingProgressE") {
        if (status === 0) {
          setProgress(msg.Progress || 0);
          if (msg.Progress === 1) {
            setCardData(null);
          }
        } else {
          setReading(false);
          setProgress(0);
        }
        return;
      }

      // ─── ReadIDCardR / AutoReadIDCardE: Card data response ───
      if (msgType === "ReadIDCardR" || msgType === "AutoReadIDCardE") {
        setReading(false);
        readingRef.current = false;
        setProgress(0);

        if (status === 0) {
          // Parse the #-delimited IDText or IDAText
          const textData = msg.IDAText || msg.IDText || "";
          const parsed: DocumentData = {
            document_type: "idcard",
            id_card: msg.IDNumber || "",
            prefix: "",
            firstname: "",
            middlename: "",
            lastname: "",
            firstname_en: "",
            middlename_en: "",
            lastname_en: "",
            birthdate: "",
            gender: "",
            address: "",
            issue_date: "",
            expiry_date: "",
            issue_place: "",
            photo: msg.IDPhoto || "",
            passport_no: "",
            nationality: "",
            mrz1: "",
            mrz2: "",
          };

          if (textData) {
            const fields = parseIDText(textData);
            Object.assign(parsed, fields);
          }

          // IDNumber may override
          if (msg.IDNumber) parsed.id_card = msg.IDNumber;

          setRawResponse(JSON.stringify(msg, null, 2));
          setCardData(parsed);
          addScannedRow(parsed);

          if (autoSaveRef.current) {
            saveCardToApi(parsed, true);
          }
        } else if (status === -16) {
          showMessage("error", "ไม่พบบัตรบนเครื่องอ่าน (No card present)");
        } else {
          showMessage("error", `ReadIDCard Error Code: ${status}`);
        }
        // Re-arm auto-read for next document
        if (autoScanRef.current && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            Command: "SetAutoReadOptions",
            AutoRead: true,
            IDNumberRead: true, IDTextRead: true, IDATextRead: true, IDPhotoRead: true,
          }));
        }
        return;
      }

      // ─── ReadPassportR / AutoReadPassportE: Passport data response ───
      if (msgType === "ReadPassportR" || msgType === "AutoReadPassportE") {
        setReading(false);
        readingRef.current = false;
        setProgress(0);

        if (status === 0) {
          // Log raw response for debugging
          console.log("ReadPassportR raw response:", JSON.stringify(msg, null, 2));

          // Collect all possible text fields from SDK response
          const allTextFields = [
            msg.PPMRZ1, msg.PPMrz1, msg.MRZ1,
            msg.PPMRZ2, msg.PPMrz2, msg.MRZ2,
            msg.PPMRZText, msg.PPMRZ, msg.MRZText,
            msg.PPText, msg.PPAText,
          ].filter(Boolean);

          // Find the #-delimited passport text (contains # separators)
          const ppText = allTextFields.find((t: string) => t.includes("#")) || "";

          let parsed: DocumentData;

          const emptyDoc: DocumentData = {
            document_type: "passport",
            id_card: "", prefix: "", firstname: "", middlename: "", lastname: "",
            firstname_en: "", middlename_en: "", lastname_en: "",
            birthdate: "", gender: "", address: "", issue_date: "", expiry_date: "",
            issue_place: "", photo: msg.PPPhoto || msg.Photo || "",
            passport_no: "", nationality: "", mrz1: "", mrz2: "",
          };

          if (ppText) {
            // Try to find a dynamic mapping for this text
            const mapping = findMapping(ppText, ppMappings);

            if (mapping) {
              // Use dynamic mapping from database
              const ppData = parsePPWithMapping(ppText, mapping);
              parsed = { ...emptyDoc, ...ppData, mrz1: ppText };
            } else {
              // No mapping found — show raw and try generic parse
              // MRZ order: DocType#Country#Surname#GivenNames#DocNo#...
              const parts = ppText.split("#");
              const mrzSurname = (parts[2] || "").trim();
              const mrzGiven = (parts[3] || "").trim();
              parsed = {
                ...emptyDoc,
                issue_place: (parts[1] || "").trim(),
                firstname: mrzGiven || mrzSurname,
                firstname_en: mrzGiven || mrzSurname,
                lastname: mrzGiven ? mrzSurname : "",
                lastname_en: mrzGiven ? mrzSurname : "",
                passport_no: (parts[4] || "").trim(),
                nationality: (parts[5] || "").trim(),
                birthdate: formatPPDate((parts[6] || "").trim()),
                gender: (parts[7] || "").trim(),
                expiry_date: formatPPDate((parts[8] || "").trim()),
                mrz1: ppText,
              };
              showMessage("info", `ไม่พบ Mapping สำหรับ ${(parts[0] || "")}/${(parts[1] || "")} — กรุณาสร้าง Mapping ใน Settings`);
            }

            // Fallback: fill missing critical fields from common MRZ positions
            // Common format: DocType#Country#Name1#Name2#PassportNo#Nationality#DOB#Gender#Expiry#...
            const fallbackParts = ppText.split("#");
            if (!parsed.passport_no && fallbackParts[4]) {
              parsed.passport_no = fallbackParts[4].trim();
            }
            if (!parsed.nationality && fallbackParts[5]) {
              parsed.nationality = fallbackParts[5].trim();
            }
            if (!parsed.firstname_en && fallbackParts[3]) {
              parsed.firstname_en = fallbackParts[3].trim();
              parsed.firstname = fallbackParts[3].trim();
            }
            if (!parsed.lastname_en && fallbackParts[2]) {
              // Don't duplicate: skip if surname equals existing firstname (e.g. Myanmar CI with no given name)
              const fbSurname = fallbackParts[2].trim();
              if (fbSurname !== parsed.firstname_en) {
                parsed.lastname_en = fbSurname;
                parsed.lastname = fbSurname;
              }
            }
            if (!parsed.birthdate && fallbackParts[6]) {
              parsed.birthdate = formatPPDate(fallbackParts[6].trim());
            }
            if (!parsed.gender && fallbackParts[7]) {
              parsed.gender = fallbackParts[7].trim();
            }
            if (!parsed.expiry_date && fallbackParts[8]) {
              parsed.expiry_date = formatPPDate(fallbackParts[8].trim());
            }

            // Auto-format: if any date field still looks like raw YYMMDD (6 digits), format it
            const autoFormatDateFields: (keyof DocumentData)[] = ["birthdate", "expiry_date", "issue_date"];
            for (const df of autoFormatDateFields) {
              const v = parsed[df];
              if (typeof v === "string" && /^\d{6}$/.test(v)) {
                (parsed as unknown as Record<string, string>)[df] = formatPPDate(v);
              }
            }
          } else {
            // Fallback: try standard MRZ or named fields
            const mrzLine1 = msg.PPMRZ1 || msg.PPMrz1 || msg.MRZ1 || "";
            const mrzLine2 = msg.PPMRZ2 || msg.PPMrz2 || msg.MRZ2 || "";
            const mrzFull = msg.PPMRZText || msg.PPMRZ || msg.MRZText || "";
            let mrz1 = mrzLine1;
            let mrz2 = mrzLine2;
            if (!mrz1 && mrzFull) {
              const lines = mrzFull.split(/[\r\n]+/).filter(Boolean);
              mrz1 = lines[0] || "";
              mrz2 = lines[1] || "";
            }
            const mrzData = (mrz1 || mrz2) ? parseMRZ(mrz1, mrz2) : {};
            parsed = { ...emptyDoc, ...mrzData, mrz1, mrz2 };
          }

          setRawResponse(JSON.stringify(msg, null, 2));
          setCardData(parsed);
          addScannedRow(parsed);

          if (autoSaveRef.current) {
            saveCardToApi(parsed, true);
          }
        } else if (status === -16) {
          showMessage("error", "ไม่พบ Passport บนเครื่องอ่าน");
        } else {
          showMessage("error", `ReadPassport Error Code: ${status}`);
        }
        // Re-arm auto-read for next passport
        if (autoScanRef.current && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            Command: "SetAutoReadPPOptions",
            AutoRead: true,
            eMRZRead: true, FacePhotoRead: true, ExtraDataRead: false,
            AccessControl: 0, PassiveAuth: false, ChipAuth: false, ActiveAuth: false, ApduType: 1,
          }));
        }
        return;
      }

      // ─── CardStatusChangeE / PPStatusChangeE: Document present/absent ───
      if (msgType === "CardStatusChangeE" || msgType === "PPStatusChangeE") {
        if (status === 1) {
          const rType = selectedReaderTypeRef.current;
          showMessage("info", rType === "passport" ? "ตรวจพบ Passport บนเครื่องอ่าน" : "ตรวจพบเอกสารบนเครื่องอ่าน");
          // Auto-read immediately
          if (autoScanRef.current && readerSelectedRef.current && !readingRef.current && wsRef.current) {
            setReading(true);
            readingRef.current = true;
            setCardData(null);
            setProgress(0);
            if (rType === "passport") {
              wsRef.current.send(JSON.stringify({ Command: "ReadPassport", eMRZRead: true, FacePhotoRead: true, AccessControl: 0, ApduType: 1 }));
            } else {
              wsRef.current.send(JSON.stringify({ Command: "ReadIDCard", IDNumberRead: true, IDTextRead: true, IDATextRead: true, IDPhotoRead: true }));
            }
          }
        }
        return;
      }

      // ─── PPReadingProgressE: Passport reading progress ───
      if (msgType === "PPReadingProgressE") {
        if (status === 0) {
          setProgress(msg.Progress || 0);
          if (msg.Progress === 1) {
            setReading(true);
            readingRef.current = true;
            setCardData(null);
          }
          if (msg.Progress === 100) {
            setReading(false);
            readingRef.current = false;
          }
        } else {
          setReading(false);
          readingRef.current = false;
          setProgress(0);
        }
        return;
      }

      // ─── AutoSelectPPReaderE: Agent auto-selected passport reader ───
      if (msgType === "AutoSelectPPReaderE") {
        if (status >= 0 && msg.ReaderName) {
          setSelectedReader(msg.ReaderName);
          setSelectedReaderType("passport");
          selectedReaderTypeRef.current = "passport";
          setReaderSelected(true);
          readerSelectedRef.current = true;
        }
        return;
      }

      // ─── GetAutoReadOptionsR / SetAutoReadOptionsR / SetAutoReadPPOptionsR / GetAutoReadPPOptionsR ───
      if (msgType === "GetAutoReadOptionsR" || msgType === "SetAutoReadOptionsR" || msgType === "SetAutoReadPPOptionsR" || msgType === "GetAutoReadPPOptionsR") {
        console.log("AutoReadOptions response:", msg);
        return;
      }

    } catch {
      setReading(false);
      readingRef.current = false;
      showMessage("error", "ได้รับข้อมูลที่ไม่ถูกต้องจากเครื่องอ่าน");
    }
  }, [showMessage, saveCardToApi, ppMappings, addScannedRow]);

  // Always keep ref pointing to latest handleMessage (fixes stale closure)
  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  /* ── Connect to IDW Agent WebSocket ── */
  const connect = useCallback(() => {
    if (!wsUrl) {
      showMessage("error", "ยังไม่ได้ตั้งค่า WebSocket — กรุณาไปที่หน้า Settings > ID Card Reader");
      return;
    }
    cleanup();
    setWsStatus("connecting");
    setReaderSelected(false);
    readerSelectedRef.current = false;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
        reconnectCountRef.current = 0;
        showMessage("success", "เชื่อมต่อ IDW Agent สำเร็จ");
      };

      ws.onmessage = (event) => handleMessageRef.current(event);

      ws.onclose = () => {
        setWsStatus("disconnected");
        setReaders([]);
        setSelectedReader("");
        setSelectedReaderType(null);
        setReaderSelected(false);
        readerSelectedRef.current = false;
        setAgentInfo("");

        if (reconnectCountRef.current < MAX_RECONNECT) {
          reconnectCountRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        showMessage("error", "ไม่สามารถเชื่อมต่อ IDW Agent ได้ — กรุณาตรวจสอบว่า Agent กำลังทำงานอยู่");
      };
    } catch {
      setWsStatus("disconnected");
      showMessage("error", "ไม่สามารถเชื่อมต่อ WebSocket ได้");
    }
  }, [cleanup, wsUrl, showMessage]);

  const disconnect = useCallback(() => {
    reconnectCountRef.current = MAX_RECONNECT;
    cleanup();
    setWsStatus("disconnected");
    setReaders([]);
    setSelectedReader("");
    setSelectedReaderType(null);
    setReaderSelected(false);
    readerSelectedRef.current = false;
    setAgentInfo("");
  }, [cleanup]);

  // Fetch settings + mappings on mount
  useEffect(() => {
    Promise.all([
      apiFetch("/idcard-reader-settings").then((r) => r.json()).catch(() => null),
      apiFetch("/passport-mappings").then((r) => r.json()).catch(() => []),
    ]).then(([settings, mappings]) => {
      if (settings) {
        const url = `ws://${settings.ws_host || "127.0.0.1"}:${settings.ws_port || 14820}/IDWAgent`;
        setWsUrl(url);
        setAutoConnect(settings.auto_connect || false);
        setAutoSave(settings.auto_save || false);
        autoSaveRef.current = settings.auto_save || false;
      } else {
        setWsUrl("ws://127.0.0.1:14820/IDWAgent");
      }
      if (Array.isArray(mappings)) {
        setPpMappings(mappings.filter((m: PPMapping) => m.is_active !== false));
      }
      setSettingsLoaded(true);
    });

    return () => {
      reconnectCountRef.current = MAX_RECONNECT;
      cleanup();
    };
  }, [cleanup]);

  // Auto-connect when settings loaded
  useEffect(() => {
    if (settingsLoaded && autoConnect && wsUrl) {
      connect();
    }
  }, [settingsLoaded, autoConnect, wsUrl, connect]);

  /* ── SDK Commands ── */
  const getReaderList = () => {
    wsSend({ Command: "GetReaderList" });
    wsSend({ Command: "GetPPReaderList" });
  };

  const selectReader = (reader: ReaderInfo) => {
    if (reader.type === "passport") {
      wsSend({ Command: "SelectPPReader", ReaderName: reader.name });
    } else {
      wsSend({ Command: "SelectReader", ReaderName: reader.name });
    }
  };

  const readDocument = () => {
    if (!wsRef.current || wsStatus !== "connected") {
      showMessage("error", "ยังไม่ได้เชื่อมต่อ IDW Agent");
      return;
    }
    if (!readerSelected || !selectedReaderType) {
      showMessage("error", "กรุณาเลือกเครื่องอ่านก่อน");
      return;
    }
    setReading(true);
    readingRef.current = true;
    setCardData(null);
    setProgress(0);
    if (selectedReaderType === "passport") {
      wsSend({
        Command: "ReadPassport",
        eMRZRead: true,
        FacePhotoRead: true,
        AccessControl: 0,
        ApduType: 1,
      });
    } else {
      wsSend({
        Command: "ReadIDCard",
        IDNumberRead: true,
        IDTextRead: true,
        IDATextRead: true,
        IDPhotoRead: true,
      });
    }
  };

  /* ── One-click: Get all readers → Select first → Read ── */
  const oneClickRead = async () => {
    if (!wsRef.current || wsStatus !== "connected") {
      showMessage("error", "ยังไม่ได้เชื่อมต่อ IDW Agent");
      return;
    }
    setReading(true);
    readingRef.current = true;
    setCardData(null);
    setProgress(0);
    const waitForMessage = (msgName: string, timeoutMs: number) => {
      return new Promise<Record<string, unknown>>((resolve) => {
        const origHandler = wsRef.current?.onmessage;
        const ws = wsRef.current;
        const timeout = setTimeout(() => {
          if (ws) ws.onmessage = origHandler || null;
          resolve({ Message: msgName, Status: -999 });
        }, timeoutMs);
        if (ws) {
          ws.onmessage = (evt: MessageEvent) => {
            const msg = JSON.parse(evt.data);
            if (msg.Message === msgName) {
              clearTimeout(timeout);
              ws.onmessage = origHandler || null;
              handleMessage(evt);
              resolve(msg);
            } else {
              handleMessage(evt);
            }
          };
        }
      });
    };

    // Step 1: Get both reader lists (Passport first, then ID Card)
    wsSend({ Command: "GetPPReaderList" });
    const ppResult = await waitForMessage("GetPPReaderListR", 5000);
    const ppList: ReaderInfo[] = (ppResult.Status as number) > 0 && ppResult.ReaderList
      ? (ppResult.ReaderList as string[]).map((name: string) => ({ name, type: "passport" as const }))
      : [];

    wsSend({ Command: "GetReaderList" });
    const idResult = await waitForMessage("GetReaderListR", 5000);
    const idList: ReaderInfo[] = (idResult.Status as number) > 0 && idResult.ReaderList
      ? (idResult.ReaderList as string[]).map((name: string) => ({ name, type: "idcard" as const }))
      : [];

    const allReaders = [...ppList, ...idList];
    if (allReaders.length === 0) {
      setReading(false);
      showMessage("error", "ไม่พบเครื่องอ่านเอกสาร");
      return;
    }

    // Step 2: Try each reader
    for (let i = 0; i < allReaders.length; i++) {
      const reader = allReaders[i];
      const selectCmd = reader.type === "passport" ? "SelectPPReader" : "SelectReader";
      const selectResp = reader.type === "passport" ? "SelectPPReaderR" : "SelectReaderR";

      wsSend({ Command: selectCmd, ReaderName: reader.name });
      const selResult = await waitForMessage(selectResp, 5000);
      if ((selResult.Status as number) < 0) continue;

      // Read document based on reader type
      if (reader.type === "passport") {
        wsSend({ Command: "ReadPassport", eMRZRead: true, FacePhotoRead: true, AccessControl: 0, ApduType: 1 });
        const readResult = await waitForMessage("ReadPassportR", 40000);
        if ((readResult.Status as number) === -16 && i < allReaders.length - 1) continue;
      } else {
        wsSend({ Command: "ReadIDCard", IDNumberRead: true, IDTextRead: true, IDATextRead: true, IDPhotoRead: true });
        const readResult = await waitForMessage("ReadIDCardR", 40000);
        if ((readResult.Status as number) === -16 && i < allReaders.length - 1) continue;
      }
      break;
    }

    setReading(false);
    readingRef.current = false;
  };

  const statusColor = {
    disconnected: "text-red-500",
    connecting: "text-yellow-500",
    connected: "text-green-500",
  };

  const statusText = {
    disconnected: "ไม่ได้เชื่อมต่อ",
    connecting: "กำลังเชื่อมต่อ...",
    connected: "เชื่อมต่อแล้ว",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Reader</h1>
          <p className="text-sm text-muted mt-1">
            อ่านบัตรประชาชน / Passport ผ่านเครื่องอ่าน IDW Agent
            {agentInfo && <span className="ml-2 text-xs text-green-600">({agentInfo})</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/id-card-reader"
            className="p-2 text-muted hover:text-foreground transition-colors"
            title="ตั้งค่า"
          >
            <Settings2 className="w-5 h-5" />
          </Link>
          <span className={`flex items-center gap-2 text-sm font-medium ${statusColor[wsStatus]}`}>
            {wsStatus === "connected" ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {statusText[wsStatus]}
          </span>
          {wsStatus === "connected" ? (
            <button onClick={disconnect} className="px-4 py-2 bg-danger text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
              ตัดการเชื่อมต่อ
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={wsStatus === "connecting"}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {wsStatus === "connecting" ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ Agent"}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-success-light text-green-800"
              : message.type === "error"
              ? "bg-danger-light text-red-800"
              : "bg-info-light text-cyan-800"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Preview + scanned queue */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selected row detail preview (editable) */}
          {cardData && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                {cardData.document_type === "passport" ? "รายละเอียด Passport" : "รายละเอียดบัตรประชาชน"}
              </h2>
              <div className="flex flex-col md:flex-row gap-6">
                {cardData.photo && (
                  <div className="shrink-0">
                    <img
                      src={`data:image/png;base64,${cardData.photo}`}
                      alt="Photo"
                      className="w-[100px] h-[125px] object-cover rounded-lg border border-border"
                    />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cardData.document_type === "passport" ? (
                    <>
                      <Field label="หมายเลข Passport" value={cardData.passport_no} onChange={(v) => updateCardField("passport_no", v)} />
                      <Field label="สัญชาติ" value={cardData.nationality} onChange={(v) => updateCardField("nationality", v)} />
                      <Field label="ชื่อ (Given Name)" value={cardData.firstname_en} onChange={(v) => { updateCardField("firstname_en", v); updateCardField("firstname", v); }} />
                      <Field label="นามสกุล (Surname)" value={cardData.lastname_en} onChange={(v) => { updateCardField("lastname_en", v); updateCardField("lastname", v); }} />
                      <Field label="เพศ" value={cardData.gender} onChange={(v) => updateCardField("gender", v)} />
                      <Field label="วันเกิด" value={cardData.birthdate} onChange={(v) => updateCardField("birthdate", v)} />
                      <Field label="วันออกเอกสาร" value={cardData.issue_date} onChange={(v) => updateCardField("issue_date", v)} />
                      <Field label="วันหมดอายุ" value={cardData.expiry_date} onChange={(v) => updateCardField("expiry_date", v)} />
                      <Field label="ประเทศผู้ออก" value={cardData.issue_place} onChange={(v) => updateCardField("issue_place", v)} />
                      <Field label="เลขประจำตัว (Personal No.)" value={cardData.id_card} onChange={(v) => updateCardField("id_card", v)} />
                      {(cardData.mrz1 || cardData.mrz2) && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted mb-1">MRZ</dt>
                          <dd className="text-xs font-mono text-foreground bg-background border border-border rounded-md px-2 py-1.5 whitespace-pre-wrap break-all">
                            {cardData.mrz1}{cardData.mrz2 ? `\n${cardData.mrz2}` : ""}
                          </dd>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Field label="เลขบัตรประชาชน" value={cardData.id_card} onChange={(v) => updateCardField("id_card", v)} />
                      <Field label="เพศ" value={cardData.gender} onChange={(v) => updateCardField("gender", v)} />
                      <Field label="คำนำหน้า" value={cardData.prefix} onChange={(v) => updateCardField("prefix", v)} />
                      <Field label="ชื่อ" value={cardData.firstname} onChange={(v) => updateCardField("firstname", v)} />
                      <Field label="นามสกุล" value={cardData.lastname} onChange={(v) => updateCardField("lastname", v)} />
                      <Field label="ชื่อ (EN)" value={cardData.firstname_en} onChange={(v) => updateCardField("firstname_en", v)} />
                      <Field label="นามสกุล (EN)" value={cardData.lastname_en} onChange={(v) => updateCardField("lastname_en", v)} />
                      <Field label="วันเกิด" value={cardData.birthdate} onChange={(v) => updateCardField("birthdate", v)} />
                      <Field label="วันออกบัตร" value={cardData.issue_date} onChange={(v) => updateCardField("issue_date", v)} />
                      <Field label="วันหมดอายุ" value={cardData.expiry_date} onChange={(v) => updateCardField("expiry_date", v)} />
                      <div className="sm:col-span-2"><Field label="ที่อยู่" value={cardData.address} onChange={(v) => updateCardField("address", v)} /></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Thefirst OCR link */}
          {cardData?.document_type === "passport" && cardData.passport_no && (
            <Link
              href={`/foreign-data/search?passport_no=${encodeURIComponent(cardData.passport_no)}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Search className="w-4 h-4" />
              ค้นหาใน Thefirst OCR
              <ExternalLink className="w-3.5 h-3.5 ml-auto" />
            </Link>
          )}

          {/* Batch scan queue table */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                รายการสแกน ({scannedRows.length} รายการ)
              </h2>
              <div className="flex items-center gap-2">
                {scannedRows.length > 0 && (
                  <>
                    <button
                      onClick={clearScannedRows}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted rounded-lg text-xs hover:text-danger hover:border-danger/50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> ล้างทั้งหมด
                    </button>
                    <button
                      onClick={() => {
                        setBatchName(`สแกน ${new Date().toLocaleDateString("th-TH")} (${scannedRows.length} รายการ)`);
                        setShowBatchModal(true);
                      }}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {saving ? "กำลังบันทึก..." : `ยืนยันบันทึก (${scannedRows.length})`}
                    </button>
                  </>
                )}
              </div>
            </div>

            {scannedRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted w-8">#</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">ประเภท</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">เลขเอกสาร</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">ชื่อ</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">สัญชาติ</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">วันเกิด</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted">หมดอายุ</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-muted w-16">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scannedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        onClick={() => { setSelectedRowIdx(idx); setCardData({...row}); }}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${
                          selectedRowIdx === idx ? "bg-primary-light" : "hover:bg-background"
                        }`}
                      >
                        <td className="py-2 px-2 text-muted">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            row.document_type === "passport" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          }`}>
                            {row.document_type === "passport" ? "Passport" : "ID Card"}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {row.document_type === "passport" ? row.passport_no : row.id_card}
                        </td>
                        <td className="py-2 px-2">
                          {row.firstname_en || row.firstname} {row.lastname_en || row.lastname}
                        </td>
                        <td className="py-2 px-2">{row.nationality || "-"}</td>
                        <td className="py-2 px-2">{row.birthdate || "-"}</td>
                        <td className="py-2 px-2">{row.expiry_date || "-"}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeScannedRow(idx); }}
                            className="p-1 text-muted hover:text-danger transition-colors"
                            title="ลบรายการ"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted">
                <CreditCard className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">
                  {reading ? "กำลังอ่านข้อมูล..." : "สแกนเอกสารเพื่อเพิ่มรายการ — รองรับสแกนต่อเนื่องหลายเล่ม"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Reader selector */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">เครื่องอ่านเอกสาร</h2>
            {readers.length > 0 ? (
              <div className="space-y-2">
                {readers.map((reader) => (
                  <button
                    key={`${reader.type}-${reader.name}`}
                    onClick={() => selectReader(reader)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                      selectedReader === reader.name && readerSelected
                        ? "border-primary bg-primary-light text-primary font-medium"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {reader.type === "passport" ? (
                      <BookOpen className="w-4 h-4 inline-block mr-2" />
                    ) : (
                      <CreditCard className="w-4 h-4 inline-block mr-2" />
                    )}
                    {reader.name}
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                      reader.type === "passport" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>
                      {reader.type === "passport" ? "Passport" : "ID Card"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {wsStatus === "connected" ? "ไม่พบเครื่องอ่านเอกสาร" : "กรุณาเชื่อมต่อ Agent ก่อน"}
              </p>
            )}

            {wsStatus === "connected" && (
              <button
                onClick={getReaderList}
                className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                ค้นหาเครื่องอ่านใหม่
              </button>
            )}
          </div>

          {/* Read buttons */}
          <div className="space-y-2">
            <button
              onClick={readDocument}
              disabled={wsStatus !== "connected" || !readerSelected || reading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังอ่านเอกสาร...
                </>
              ) : (
                <>
                  {selectedReaderType === "passport" ? <BookOpen className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  {selectedReaderType === "passport" ? "อ่าน Passport" : "อ่านบัตรประชาชน"}
                </>
              )}
            </button>
            <button
              onClick={oneClickRead}
              disabled={wsStatus !== "connected" || reading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-xl text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              One-Click Read
            </button>
          </div>

          {/* Progress bar */}
          {reading && progress > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <span>กำลังอ่าน...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw response debug */}
      {rawResponse && (
        <div className="bg-card rounded-xl border border-border p-4">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {showRaw ? "▼" : "►"} Raw Response (Debug)
          </button>
          {showRaw && (
            <pre className="mt-2 text-xs font-mono text-muted bg-background rounded-lg p-3 border border-border overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
              {rawResponse}
            </pre>
          )}
        </div>
      )}

      {/* Batch Name Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">ตั้งชื่อชุดบันทึก</h3>
              <p className="text-xs text-slate-400 mt-1">ระบุชื่อชุดสำหรับ {scannedRows.length} รายการที่จะบันทึก</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">ชื่อชุด <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="เช่น สแกนบัตร 19/03/2026"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && batchName.trim()) {
                      e.preventDefault();
                      document.getElementById("btn-confirm-batch")?.click();
                    }
                  }}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-batch"
                disabled={!batchName.trim() || saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const items = scannedRows.map((row) => ({
                      document_type: row.document_type,
                      id_card: row.id_card || undefined,
                      passport_no: row.passport_no || undefined,
                      prefix: row.prefix,
                      firstname: row.firstname + (row.middlename ? ` ${row.middlename}` : ""),
                      lastname: row.lastname,
                      birthdate: toISODate(row.birthdate),
                      address: row.address,
                      nationality: row.nationality || undefined,
                      issue_date: toISODate(row.issue_date),
                      expiry_date: toISODate(row.expiry_date),
                      photo: row.photo,
                    }));
                    const res = await apiFetch("/scan-batches", {
                      method: "POST",
                      body: JSON.stringify({ name: batchName.trim(), items }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => null);
                      throw new Error(err?.message || `HTTP ${res.status}`);
                    }
                    const result = await res.json();
                    showMessage("success", result.message || "บันทึกชุดสำเร็จ");
                    clearScannedRows();
                    setCardData(null);
                    setShowBatchModal(false);
                  } catch (err) {
                    showMessage("error", `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : "Unknown error"}`);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
  return (
    <div>
      <dt className="text-xs text-muted mb-1">{label}</dt>
      {onChange ? (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm font-medium text-foreground bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <dd className="text-sm font-medium text-foreground">{value || "-"}</dd>
      )}
    </div>
  );
}
