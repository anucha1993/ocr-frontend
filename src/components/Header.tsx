"use client";

import { Bell, LogOut, Search, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="ค้นหาเอกสาร..."
          className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-background transition-colors">
          <Bell className="w-5 h-5 text-muted" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.name ?? "User"}</p>
            <p className="text-xs text-muted">{user?.email}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <button
            onClick={logout}
            title="ออกจากระบบ"
            className="p-2 rounded-lg hover:bg-danger-light text-muted hover:text-danger transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
