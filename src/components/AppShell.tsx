"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.push("/login");
    }
    if (user && isLoginPage) {
      router.push("/dashboard");
    }
  }, [user, loading, isLoginPage, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center text-white font-bold text-xl mb-4 animate-pulse">
            OCR
          </div>
          <p className="text-muted text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Login page — no shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not logged in — don't render anything (redirect will happen)
  if (!user) return null;

  // Authenticated — full layout
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[260px]">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
