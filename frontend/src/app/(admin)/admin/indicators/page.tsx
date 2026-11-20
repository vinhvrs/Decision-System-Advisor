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
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Analysis configuration</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--dsa-positive)]" />
            Indicator parameters
          </h1>
          <p className="mt-0.5 max-w-3xl truncate text-[10px] text-[var(--dsa-text-muted)]">
            MySQL-backed periods and thresholds consumed by Laravel and the Python analysis engine.
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
          className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px] disabled:opacity-50"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Refresh
        </button>
      </section>

      {loading ? (
        <section className="dsa-terminal-panel flex min-h-32 items-center justify-center text-xs text-[var(--dsa-text-muted)]">
          Loading indicator catalog…
        </section>
      ) : catalog.length === 0 ? (
        <section className="dsa-terminal-panel border-[rgba(216,163,64,0.3)] bg-[rgba(216,163,64,0.06)] px-3 py-3 text-[10px] text-[#d9bb7a]">
          No rows in the indicators catalog. Seed the catalog before editing parameters.
        </section>
      ) : (
        <>
          <section className="dsa-terminal-panel overflow-hidden">
            <div className="dsa-terminal-panel-head">
              <div>
                <p className="text-xs font-semibold text-white">Indicator scope</p>
                <p className="text-[10px] text-[var(--dsa-text-muted)]">
                  Select the indicator whose runtime parameters you want to inspect.
                </p>
              </div>
              <select
                value={selectedId}
                onChange={(e) => {
                  cancelEdit();
                  setSelectedId(e.target.value);
                }}
                className="dsa-control h-7 min-h-0 max-w-[380px] px-2 text-[11px] outline-none"
              >
                {catalog.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.slug})
                  </option>
                ))}
              </select>
            </div>
            {selectedIndicator?.description ? (
              <p className="border-t border-[var(--dsa-border)] px-3 py-2 text-[10px] text-[var(--dsa-text-secondary)]">
                {selectedIndicator.description}
              </p>
            ) : null}
          </section>

          <section className="dsa-terminal-panel overflow-hidden">
            <div className="dsa-terminal-panel-head">
              <div>
                <p className="text-xs font-semibold text-white">Existing parameters</p>
                <p className="text-[10px] text-[var(--dsa-text-muted)]">{params.length} rows</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="dsa-terminal-table min-w-[900px]">
                <thead>
                  <tr>
                    <th className="text-left">Key</th>
                    <th className="text-left">Value</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Label</th>
                    <th className="text-right">Order</th>
                    <th className="text-center">Active</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((param) => {
                    const isEditing = editingId === param.id;
                    return (
                      <tr key={param.id} className="align-top">
                        <td className="font-mono text-[10px] font-semibold text-[#8fd3ae]">{param.param_key}</td>
                        <td className="max-w-[230px]">
                          {isEditing ? (
                            <input
                              value={editDraft.param_value}
                              onChange={(e) => setEditDraft((draft) => ({ ...draft, param_value: e.target.value }))}
                              className="dsa-control h-7 min-h-0 w-full min-w-[7rem] px-2 font-mono text-[10px]"
                            />
                          ) : (
                            <span className="block truncate font-mono text-[10px] text-white" title={param.param_value ?? ""}>
                              {param.param_value ?? "—"}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              value={editDraft.value_type}
                              onChange={(e) =>
                                setEditDraft((draft) => ({
                                  ...draft,
                                  value_type: e.target.value as (typeof VALUE_TYPES)[number],
                                }))
                              }
                              className="dsa-control h-7 min-h-0 px-2 text-[10px]"
                            >
                              {VALUE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">{param.value_type}</span>
                          )}
                        </td>
                        <td className="max-w-[180px]">
                          {isEditing ? (
                            <input
                              value={editDraft.label}
                              onChange={(e) => setEditDraft((draft) => ({ ...draft, label: e.target.value }))}
                              className="dsa-control h-7 min-h-0 w-full min-w-[6rem] px-2 text-[10px]"
                            />
                          ) : (
                            <span className="block truncate text-[10px] text-[var(--dsa-text-secondary)]">{param.label ?? "—"}</span>
                          )}
                        </td>
                        <td className="text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              value={editDraft.sort_order}
                              onChange={(e) => setEditDraft((draft) => ({ ...draft, sort_order: e.target.value }))}
                              className="dsa-control h-7 min-h-0 w-16 px-2 text-right font-mono text-[10px]"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-[var(--dsa-text-secondary)]">{param.sort_order}</span>
                          )}
                        </td>
                        <td className="text-center">
                          {isEditing ? (
                            <label className="inline-flex items-center gap-1 text-[10px] text-[var(--dsa-text-secondary)]">
                              <input
                                type="checkbox"
                                checked={editDraft.is_active}
                                onChange={(e) => setEditDraft((draft) => ({ ...draft, is_active: e.target.checked }))}
                              />
                              Active
                            </label>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || isEditing}
                              onClick={() => void onToggleActive(param)}
                              className={`rounded-[var(--dsa-radius-sm)] border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                param.is_active
                                  ? "border-[rgba(44,182,125,0.28)] bg-[rgba(44,182,125,0.08)] text-[var(--dsa-positive)]"
                                  : "border-[var(--dsa-border)] text-[var(--dsa-text-muted)]"
                              }`}
                            >
                              {param.is_active ? "On" : "Off"}
                            </button>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void onSaveEdit(param)}
                                  className="inline-flex min-h-7 items-center gap-1 rounded-[var(--dsa-radius-sm)] border border-[rgba(44,182,125,0.28)] px-2 text-[9px] font-semibold text-[var(--dsa-positive)] hover:bg-[rgba(44,182,125,0.08)]"
                                >
                                  <Check className="h-3 w-3" />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={cancelEdit}
                                  className="dsa-button-secondary min-h-7 px-2 py-1 text-[9px]"
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
                                  onClick={() => startEdit(param)}
                                  className="dsa-button-secondary min-h-7 px-2 py-1 text-[9px] disabled:opacity-40"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || editingId != null}
                                  onClick={() => void onDelete(param)}
                                  className="inline-flex min-h-7 items-center gap-1 rounded-[var(--dsa-radius-sm)] border border-[rgba(231,91,100,0.28)] px-2 text-[9px] text-[var(--dsa-negative)] hover:bg-[rgba(231,91,100,0.08)] disabled:opacity-40"
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
                              onChange={(e) => setEditDraft((draft) => ({ ...draft, description: e.target.value }))}
                              rows={2}
                              placeholder="Description"
                              className="dsa-control mt-1.5 min-h-[48px] w-full min-w-[12rem] px-2 py-1 text-[10px]"
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {params.length === 0 ? (
              <p className="border-t border-[var(--dsa-border)] px-3 py-6 text-center text-xs text-[var(--dsa-text-muted)]">
                No parameters for this indicator.
              </p>
            ) : null}
          </section>

          <section className="dsa-terminal-panel overflow-hidden">
            <div className="dsa-terminal-panel-head">
              <div className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5 text-[var(--dsa-positive)]" />
                <p className="text-xs font-semibold text-white">Add parameter</p>
              </div>
            </div>
            <form onSubmit={onCreate} className="grid gap-2 p-3 tablet:grid-cols-2">
              <input
                required
                value={form.param_key}
                onChange={(e) => setForm((current) => ({ ...current, param_key: e.target.value }))}
                className="dsa-control h-8 min-h-0 px-2.5 font-mono text-[11px]"
                placeholder="Parameter key"
              />
              <select
                value={form.value_type}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    value_type: e.target.value as (typeof VALUE_TYPES)[number],
                  }))
                }
                className="dsa-control h-8 min-h-0 px-2 text-[11px]"
              >
                {VALUE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <textarea
                value={form.param_value}
                onChange={(e) => setForm((current) => ({ ...current, param_value: e.target.value }))}
                rows={2}
                className="dsa-control min-h-[58px] px-2.5 py-2 font-mono text-[10px] tablet:col-span-2"
                placeholder='Value: plain text, number, true/false, or JSON'
              />
              <input
                value={form.label}
                onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
                className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
                placeholder="Label (optional)"
              />
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((current) => ({ ...current, sort_order: e.target.value }))}
                className="dsa-control h-8 min-h-0 px-2.5 font-mono text-[11px]"
                placeholder="Sort order"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                rows={2}
                className="dsa-control min-h-[58px] px-2.5 py-2 text-[10px] tablet:col-span-2"
                placeholder="Description (optional)"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 tablet:col-span-2">
                <label className="inline-flex items-center gap-1.5 text-[10px] text-[var(--dsa-text-secondary)]">
                  <input
                    id="ip-active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                  />
                  Active
                </label>
                <button
                  type="submit"
                  disabled={busy || !selectedId}
                  className="dsa-button-primary min-h-0 px-3 py-1.5 text-[10px] disabled:opacity-50"
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
