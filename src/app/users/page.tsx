"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, UserCog } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

const emptyForm: FormData = { name: "", email: "", password: "", role: "user" };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // Redirect non-admin
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      router.push("/dashboard");
    }
  }, [currentUser, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "admin") fetchUsers();
  }, [currentUser, fetchUsers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const body: Record<string, string> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;

      const res = editingId
        ? await apiFetch(`/users/${editingId}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiFetch("/users", { method: "POST", body: JSON.stringify({ ...body, password: form.password }) });

      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const data = await res.json();
        if (data.errors) setErrors(data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`ลบผู้ใช้ "${u.name}" ?`)) return;
    const res = await apiFetch(`/users/${u.id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
    else {
      const data = await res.json();
      alert(data.message || "ไม่สามารถลบได้");
    }
  };

  if (currentUser?.role !== "admin") return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-7 h-7 text-primary" />
            จัดการผู้ใช้
          </h1>
          <p className="text-muted text-sm mt-1">เพิ่ม แก้ไข ลบ ผู้ใช้งานระบบ</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50">
              <th className="text-left px-6 py-3 font-medium text-muted">ชื่อ</th>
              <th className="text-left px-6 py-3 font-medium text-muted">อีเมล</th>
              <th className="text-left px-6 py-3 font-medium text-muted">สิทธิ์</th>
              <th className="text-left px-6 py-3 font-medium text-muted">สร้างเมื่อ</th>
              <th className="text-right px-6 py-3 font-medium text-muted">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted">กำลังโหลด...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted">ไม่มีผู้ใช้</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-background/30">
                  <td className="px-6 py-3 font-medium">{u.name}</td>
                  <td className="px-6 py-3 text-muted">{u.email}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : "bg-success-light text-success"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {new Date(u.created_at).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-danger-light text-muted hover:text-danger transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">
                {editingId ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-background rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อ</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-danger text-xs mt-1">{errors.name[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">อีเมล</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {errors.email && <p className="text-danger text-xs mt-1">{errors.email[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  รหัสผ่าน {editingId && <span className="text-muted font-normal">(เว้นว่างถ้าไม่เปลี่ยน)</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingId ? "••••••••" : ""}
                />
                {errors.password && <p className="text-danger text-xs mt-1">{errors.password[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">สิทธิ์</label>
                <select
                  className="form-input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && <p className="text-danger text-xs mt-1">{errors.role[0]}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-background transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : editingId ? "บันทึก" : "เพิ่มผู้ใช้"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
