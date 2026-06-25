"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { CornerNotice } from "@/src/components/admin/CornerNotice";
import { SlidersHorizontal, Trash2, Plus, RefreshCw, Pencil, Check, X } from "lucide-react";

type IndicatorRow = { id: string; name: string; slug: string; description?: string | null };

type ParamRow = {
  id: string;
  indicator_id: string;
  param_key: string;
  param_value: string | null;
  value_type: string;
  label: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

const VALUE_TYPES = ["string", "number", "boolean", "json"] as const;

type EditDraft = {
  param_value: string;
  value_type: (typeof VALUE_TYPES)[number];
  label: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

function emptyEditDraft(): EditDraft {
  return {
    param_value: "",
    value_type: "string",
    label: "",
    description: "",
    sort_order: "0",
    is_active: true,
  };
}

export default function AdminIndicatorsPage() {
  const [catalog, setCatalog] = useState<IndicatorRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [params, setParams] = useState<ParamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(emptyEditDraft);

  const [form, setForm] = useState({
    param_key: "",
    param_value: "",
    value_type: "string" as (typeof VALUE_TYPES)[number],
    label: "",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const loadCatalog = useCallback(async () => {
    const rows = (await AdminService.indicators.catalog()) as IndicatorRow[];
    setCatalog(Array.isArray(rows) ? rows : []);
    return rows;
  }, []);

  const loadParams = useCallback(async (indicatorId: string) => {
    if (!indicatorId) {
      setParams([]);
      return;
    }
    const res = (await AdminService.indicators.parameters(indicatorId)) as {
      parameters?: ParamRow[];
    };
    setParams(Array.isArray(res?.parameters) ? res.parameters : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = (await AdminService.indicators.catalog()) as IndicatorRow[];
        if (cancelled) return;
        setCatalog(Array.isArray(rows) ? rows : []);
        const first = Array.isArray(rows) && rows[0] ? rows[0].id : "";
        setSelectedId(first);
      } catch {
        if (!cancelled) setNotice({ variant: "error", message: "Could not load indicators." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadParams(selectedId);
      } catch {
        if (!cancelled) setNotice({ variant: "error", message: "Could not load parameters." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadParams]);

  const selectedIndicator = useMemo(
    () => catalog.find((c) => c.id === selectedId) ?? null,
    [catalog, selectedId],
  );

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    try {
      await AdminService.indicators.createParameter(selectedId, {
        param_key: form.param_key.trim(),
        param_value: form.param_value.trim() === "" ? null : form.param_value,
        value_type: form.value_type,
        label: form.label.trim() === "" ? null : form.label.trim(),
        description: form.description.trim() === "" ? null : form.description.trim(),
        sort_order: Number.parseInt(form.sort_order, 10) || 0,
        is_active: form.is_active,
      });
      setForm({
        param_key: "",
        param_value: "",
        value_type: "string",
        label: "",
        description: "",
        sort_order: "0",
        is_active: true,
      });
      await loadParams(selectedId);
      setNotice({ variant: "success", message: "Parameter created." });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setNotice({ variant: "error", message: ax.response?.data?.message || "Create failed." });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (p: ParamRow) => {
    if (!selectedId) return;
    if (!window.confirm(`Delete parameter “${p.param_key}”?`)) return;
    setBusy(true);
    try {
      await AdminService.indicators.deleteParameter(selectedId, p.id);
      await loadParams(selectedId);
      setNotice({ variant: "success", message: "Deleted." });
    } catch {
      setNotice({ variant: "error", message: "Delete failed." });
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async (p: ParamRow) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await AdminService.indicators.updateParameter(selectedId, p.id, { is_active: !p.is_active });
      await loadParams(selectedId);
      setNotice({ variant: "success", message: "Parameter updated." });
    } catch {
      setNotice({ variant: "error", message: "Update failed." });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: ParamRow) => {
    setEditingId(p.id);
    setEditDraft({
      param_value: p.param_value ?? "",
      value_type: (VALUE_TYPES.includes(p.value_type as (typeof VALUE_TYPES)[number])
        ? p.value_type
        : "string") as (typeof VALUE_TYPES)[number],
      label: p.label ?? "",
      description: p.description ?? "",
      sort_order: String(p.sort_order ?? 0),
      is_active: p.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyEditDraft());
  };

  const onSaveEdit = async (p: ParamRow) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await AdminService.indicators.updateParameter(selectedId, p.id, {
        param_value: editDraft.param_value.trim() === "" ? null : editDraft.param_value,
        value_type: editDraft.value_type,
        label: editDraft.label.trim() === "" ? null : editDraft.label.trim(),
        description: editDraft.description.trim() === "" ? null : editDraft.description.trim(),
        sort_order: Number.parseInt(editDraft.sort_order, 10) || 0,
        is_active: editDraft.is_active,
      });
      cancelEdit();
      await loadParams(selectedId);
      setNotice({ variant: "success", message: "Parameter saved." });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setNotice({ variant: "error", message: ax.response?.data?.message || "Save failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <SlidersHorizontal className="text-emerald-400" size={28} />
            Indicator parameters
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Tune periods and thresholds per indicator. Values are stored in MySQL and used by the Laravel API and
            Python analysis engine (60s cache). Env vars in <code className="text-emerald-200/90">backend/.env</code>{" "}
            are fallbacks only when a row is missing or inactive.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={async () => {
            setLoading(true);
            try {
              await loadCatalog();
              if (selectedId) await loadParams(selectedId);
              setNotice({ variant: "success", message: "Refreshed." });
            } catch {
              setNotice({ variant: "error", message: "Refresh failed." });
            } finally {
              setLoading(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/45">Loading…</p>
      ) : catalog.length === 0 ? (
        <p className="text-sm text-amber-200/90">
          No rows in the indicators catalog yet. Run{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">php artisan db:seed --class=IndicatorCatalogSeeder</code>{" "}
          from <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">backend/</code>.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">Indicator</label>
            <select
              value={selectedId}
              onChange={(e) => {
                cancelEdit();
                setSelectedId(e.target.value);
              }}
              className="w-full max-w-xl rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
            {selectedIndicator?.description ? (
              <p className="mt-2 text-xs text-white/50">{selectedIndicator.description}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/80">Existing parameters</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-white/45">
                    <th className="py-2 pr-2">Key</th>
                    <th className="py-2 pr-2">Value</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Label</th>
                    <th className="py-2 pr-2">Order</th>
                    <th className="py-2 pr-2">Active</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                    <tr key={p.id} className="border-b border-white/5 align-top">
                      <td className="py-2 pr-2 font-mono text-xs text-emerald-200/95">{p.param_key}</td>
                      <td className="py-2 pr-2 text-xs text-white/80">
                        {isEditing ? (
                          <input
                            value={editDraft.param_value}
                            onChange={(e) => setEditDraft((d) => ({ ...d, param_value: e.target.value }))}
                            className="w-full min-w-[5rem] rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-white"
                          />
                        ) : (
                          <span className="max-w-[200px] truncate block" title={p.param_value ?? ""}>
                            {p.param_value ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs text-white/60">
                        {isEditing ? (
                          <select
                            value={editDraft.value_type}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                value_type: e.target.value as (typeof VALUE_TYPES)[number],
                              }))
                            }
                            className="rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                          >
                            {VALUE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          p.value_type
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs text-white/60">
                        {isEditing ? (
                          <input
                            value={editDraft.label}
                            onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                            className="w-full min-w-[5rem] rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                          />
                        ) : (
                          p.label ?? "—"
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs tabular-nums text-white/60">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editDraft.sort_order}
                            onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: e.target.value }))}
                            className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white"
                          />
                        ) : (
                          p.sort_order
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-white/70">
                            <input
                              type="checkbox"
                              checked={editDraft.is_active}
                              onChange={(e) => setEditDraft((d) => ({ ...d, is_active: e.target.checked }))}
                              className="rounded border-white/20"
                            />
                            Active
                          </label>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || isEditing}
                            onClick={() => void onToggleActive(p)}
                            className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                              p.is_active ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/50"
                            }`}
                          >
                            {p.is_active ? "On" : "Off"}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onSaveEdit(p)}
                                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
                              >
                                <Check className="h-3 w-3" />
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busy || editingId != null}
                                onClick={() => startEdit(p)}
                                className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/5 disabled:opacity-40"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busy || editingId != null}
                                onClick={() => void onDelete(p)}
                                className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                        {isEditing ? (
                          <textarea
                            value={editDraft.description}
                            onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                            rows={2}
                            placeholder="Description (optional)"
                            className="mt-2 w-full min-w-[10rem] rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white"
                          />
                        ) : null}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {params.length === 0 ? <p className="mt-3 text-xs text-white/45">No parameters for this indicator yet.</p> : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
              <Plus className="h-4 w-4 text-emerald-400" />
              Add parameter
            </h2>
            <form onSubmit={onCreate} className="grid gap-4 tablet:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/50">Key (letters, digits, . _ -)</label>
                <input
                  required
                  value={form.param_key}
                  onChange={(e) => setForm((f) => ({ ...f, param_key: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  placeholder="e.g. rsi_period"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Value type</label>
                <select
                  value={form.value_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value_type: e.target.value as (typeof VALUE_TYPES)[number] }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {VALUE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tablet:col-span-2">
                <label className="mb-1 block text-xs text-white/50">Value</label>
                <textarea
                  value={form.param_value}
                  onChange={(e) => setForm((f) => ({ ...f, param_value: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  placeholder='Plain text, number, "true"/"false", or JSON for type "json"'
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Label (optional)</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Sort order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="tablet:col-span-2">
                <label className="mb-1 block text-xs text-white/50">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex items-center gap-2 tablet:col-span-2">
                <input
                  id="ip-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-white/20"
                />
                <label htmlFor="ip-active" className="text-sm text-white/70">
                  Active
                </label>
              </div>
              <div className="tablet:col-span-2">
                <button
                  type="submit"
                  disabled={busy || !selectedId}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Create parameter
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {notice ? <CornerNotice message={notice.message} variant={notice.variant} onDismiss={() => setNotice(null)} /> : null}
    </div>
  );
}
