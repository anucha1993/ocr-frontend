"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center text-white font-bold text-xl mb-4">
            OCR
          </div>
          <h1 className="text-2xl font-bold text-foreground">Thefirst OCR</h1>
          <p className="text-muted text-sm mt-1">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-danger-light text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="form-input"
              placeholder="admin@admin.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
            />
          </div>
          <li>email : admin@company.com</li>
          <li>password : password</li>
          <br />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
