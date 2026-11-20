"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { Loader2 } from "lucide-react";

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
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div>
          <p className="dsa-section-label">Access control</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">User management</h1>
        </div>
        <div className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
          Page {pagination.current_page}/{pagination.last_page}
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search name, email, username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchUsers(1, search)}
              className="dsa-control h-7 min-h-0 w-[260px] max-w-full px-2.5 text-[11px] outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="dsa-control h-7 min-h-0 px-2 text-[11px] outline-none"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => fetchUsers(1, search)}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[11px]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
            <Loader2 size={15} className="animate-spin" />
            Loading users…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dsa-terminal-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Username</th>
                  <th className="text-left">Role</th>
                  <th className="text-right">State</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-white">{u.name}</td>
                    <td className="text-[var(--dsa-text-secondary)]">{u.email}</td>
                    <td className="font-mono text-[var(--dsa-text-secondary)]">{u.username ?? "—"}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={saving && editingRole === u.id}
                        className="dsa-control h-7 min-h-0 px-2 text-[11px] outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                      </select>
                    </td>
                    <td className="text-right">
                      {saving && editingRole === u.id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--dsa-warning)]">
                          <Loader2 size={12} className="animate-spin" /> Saving
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--dsa-text-muted)]">Role editable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--dsa-border)] px-3 py-2">
            <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.current_page <= 1}
                onClick={() => fetchUsers(pagination.current_page - 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => fetchUsers(pagination.current_page + 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
