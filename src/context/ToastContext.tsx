"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const ctx: ToastContextType = {
    success: (m) => push("success", m),
    error:   (m) => push("error",   m),
    warning: (m) => push("warning", m),
    info:    (m) => push("info",    m),
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle  className="w-5 h-5 text-success shrink-0" />,
    error:   <XCircle      className="w-5 h-5 text-danger  shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    info:    <Info          className="w-5 h-5 text-info    shrink-0" />,
  };

  const bg: Record<ToastType, string> = {
    success: "bg-success-light border-success/30 text-success",
    error:   "bg-danger-light  border-danger/30  text-danger",
    warning: "bg-warning-light border-warning/30 text-warning",
    info:    "bg-info-light    border-info/30    text-info",
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg animate-fade-in ${bg[t.type]}`}
          >
            {icons[t.type]}
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
