"use client";

import { useState, useEffect } from "react";
import { BookOpen, FileText, Download, ExternalLink, Loader2 } from "lucide-react";

interface ManualFile {
  name: string;
  filename: string;
  url: string;
}

export default function ManualPage() {
  const [files, setFiles] = useState<ManualFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/manuals")
      .then((res) => res.json())
      .then((data) => setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-primary" />
          คู่มือการใช้งาน
        </h1>
        <p className="text-sm text-slate-500 mt-1">เอกสารคู่มือสำหรับการใช้งานระบบ</p>
      </div>

      {/* File List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> กำลังโหลด...
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-20">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">ยังไม่มีไฟล์คู่มือ</p>
          <p className="text-xs text-slate-300 mt-1">วางไฟล์ PDF ไว้ใน public/manual/</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.filename}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate" title={file.name}>
                    {file.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{file.filename}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  เปิดอ่าน
                </a>
                <a
                  href={file.url}
                  download
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
