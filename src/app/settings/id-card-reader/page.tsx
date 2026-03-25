"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, Wifi } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ReaderSettings {
  ws_host: string;
  ws_port: number;
  auto_connect: boolean;
  auto_save: boolean;
}

export default function IdCardReaderSettingsPage() {
  const [settings, setSettings] = useState<ReaderSettings>({
    ws_host: "127.0.0.1",
    ws_port: 14820,
    auto_connect: false,
    auto_save: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch("/idcard-reader-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          ws_host: data.ws_host || "127.0.0.1",
          ws_port: data.ws_port || 14820,
          auto_connect: data.auto_connect || false,
          auto_save: data.auto_save || false,
        });
      }
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/idcard-reader-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      setMessage({ type: "success", text: "บันทึกการตั้งค่าสำเร็จ" });
    } catch (err) {
      setMessage({ type: "error", text: `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const testConnection = () => {
    setTesting(true);
    setTestResult(null);

    const wsUrl = `ws://${settings.ws_host}:${settings.ws_port}/IDWAgent`;
    let timeout: ReturnType<typeof setTimeout>;

    try {
      const ws = new WebSocket(wsUrl);

      timeout = setTimeout(() => {
        ws.close();
        setTestResult({ ok: false, msg: "หมดเวลาเชื่อมต่อ (5 วินาที)" });
        setTesting(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setTestResult({ ok: true, msg: `เชื่อมต่อ ${wsUrl} สำเร็จ` });
        setTesting(false);
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setTestResult({ ok: false, msg: `ไม่สามารถเชื่อมต่อ ${wsUrl} — ตรวจสอบว่า IDW Agent กำลังทำงาน` });
        setTesting(false);
      };
    } catch {
      setTestResult({ ok: false, msg: "WebSocket URL ไม่ถูกต้อง" });
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ID Card Reader Settings</h1>
        <p className="text-sm text-muted mt-1">ตั้งค่าการเชื่อมต่อ WebSocket กับ IDW Agent</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-success-light text-green-800" : "bg-danger-light text-red-800"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection settings */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">WebSocket Connection</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Host / IP Address
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น 192.168.1.100"
                value={settings.ws_host}
                onChange={(e) => setSettings({ ...settings, ws_host: e.target.value })}
              />
              <p className="text-xs text-muted mt-1">IP ของเครื่องที่ติดตั้ง IDW Agent</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Port
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="14820"
                min={1}
                max={65535}
                value={settings.ws_port}
                onChange={(e) => setSettings({ ...settings, ws_port: parseInt(e.target.value) || 14820 })}
              />
              <p className="text-xs text-muted mt-1">พอร์ต WebSocket ของ IDW Agent (ค่าเริ่มต้น: 14820)</p>
            </div>

            {/* Preview */}
            <div className="bg-background rounded-lg px-4 py-3 border border-border">
              <span className="text-xs text-muted">WebSocket URL</span>
              <p className="text-sm font-mono font-medium text-foreground mt-0.5">
                ws://{settings.ws_host}:{settings.ws_port}/IDWAgent
              </p>
            </div>

            {/* Test connection */}
            <button
              onClick={testConnection}
              disabled={testing || !settings.ws_host}
              className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {testing ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
            </button>

            {testResult && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  testResult.ok ? "bg-success-light text-green-800" : "bg-danger-light text-red-800"
                }`}
              >
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {testResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* Behavior settings */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Behavior</h2>

          <div className="space-y-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                checked={settings.auto_connect}
                onChange={(e) => setSettings({ ...settings, auto_connect: e.target.checked })}
              />
              <div>
                <span className="text-sm font-medium text-foreground">เชื่อมต่ออัตโนมัติ</span>
                <p className="text-xs text-muted mt-0.5">เชื่อมต่อ IDW Agent โดยอัตโนมัติเมื่อเปิดหน้า ID Card Reader</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                checked={settings.auto_save}
                onChange={(e) => setSettings({ ...settings, auto_save: e.target.checked })}
              />
              <div>
                <span className="text-sm font-medium text-foreground">บันทึกอัตโนมัติ</span>
                <p className="text-xs text-muted mt-0.5">บันทึกข้อมูลบัตรลงฐานข้อมูลโดยอัตโนมัติเมื่ออ่านบัตรสำเร็จ</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}
