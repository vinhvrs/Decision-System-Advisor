"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { Loader2, ChevronDown } from "lucide-react";

type User = { id: string; name: string; email: string; username?: string; role: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 15 });
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const appliedSearchRef = useRef("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async (page = 1, searchTerm?: string) => {
    const raw = searchTerm !== undefined ? searchTerm : appliedSearchRef.current;
    const term = raw.trim() || undefined;
    setLoading(true);
    try {
      const res = await AdminService.users.list({
        page,
        per_page: 15,
        role: roleFilter || undefined,
        search: term,
      });
      setUsers(res.data ?? []);
      setPagination({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
        per_page: res.per_page ?? 15,
      });
      appliedSearchRef.current = raw.trim();
    } catch (e) {
      console.error(e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers(1, debouncedSearch);
  }, [debouncedSearch, roleFilter, fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(true);
    setEditingRole(userId);
    try {
      await AdminService.users.updateRole(userId, newRole);
      await fetchUsers(pagination.current_page);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setEditingRole(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name, email, username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUsers(1, search)}
          className="px-4 py-2 rounded-lg bg-[#161D2C] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-w-[200px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-[#161D2C] border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <button
          onClick={() => fetchUsers(1, search)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
        >
          Search
        </button>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#161D2C]">
        {loading ? (
          <div className="p-12 text-center text-white/60 flex items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-white/60">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Username</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">{u.username ?? "—"}</td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={saving && editingRole === u.id}
                        className="px-3 py-1.5 rounded bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                      </select>
                      {saving && editingRole === u.id && (
                        <Loader2 size={14} className="inline ml-2 animate-spin" />
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-white/40">Edit role above</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={pagination.current_page <= 1}
            onClick={() => fetchUsers(pagination.current_page - 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/60">
            {pagination.current_page} / {pagination.last_page}
          </span>
          <button
            disabled={pagination.current_page >= pagination.last_page}
            onClick={() => fetchUsers(pagination.current_page + 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
