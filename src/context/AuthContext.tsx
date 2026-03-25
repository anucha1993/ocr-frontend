"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    // Restore cached user immediately for faster UI
    const saved = localStorage.getItem("user");
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }

    // Verify token is still valid
    apiFetch("/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
      })
      .then((data) => {
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
