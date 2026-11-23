"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { CornerNotice } from "@/src/components/admin/CornerNotice";
import { Mail, RefreshCw, Send, Inbox, ArrowUpRight, Settings } from "lucide-react";

type MailConfig = {
  mailer: string;
  from_address: string;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_scheme: string | null;
  smtp_auto_tls: boolean;
  smtp_username_set: boolean;
  smtp_ready?: boolean;
  support_notify_configured?: boolean;
  google_oauth_client_configured: boolean;
  site_mail?: {
    contact_notification_email: string | null;
    support_public_email: string | null;
    internal_notes: string | null;
    effective_contact_notification_email?: string;
  };
};

type EmailMsg = {
  id: string;
  direction: string;
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  status: string;
  error_message?: string | null;
  created_at: string;
  admin_user?: { name?: string; email?: string } | null;
  client_user?: { name?: string; email?: string } | null;
};

type UserOpt = { id: string; email?: string; name?: string };

type ContactRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export default function AdminEmailPage() {
  const [cfg, setCfg] = useState<MailConfig | null>(null);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [listTab, setListTab] = useState<"inbound" | "outbound" | "all">("all");
  const [messages, setMessages] = useState<EmailMsg[]>([]);
  const [msgPage, setMsgPage] = useState(1);
  const [msgLastPage, setMsgLastPage] = useState(1);
  const [selected, setSelected] = useState<EmailMsg | null>(null);

  const [users, setUsers] = useState<UserOpt[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const loadContacts = useCallback(async () => {
    try {
      const res = (await AdminService.email.contactSubmissions({ page: 1, per_page: 50 })) as {
        data?: ContactRow[];
      };
      setContacts(res.data ?? []);
    } catch {
      setContacts([]);
    }
  }, []);

  const [testTo, setTestTo] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [clientUserId, setClientUserId] = useState("");

  const [inFrom, setInFrom] = useState("");
  const [inTo, setInTo] = useState("");
  const [inSubject, setInSubject] = useState("");
  const [inBody, setInBody] = useState("");
  const [inClientId, setInClientId] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const loadConfig = useCallback(async (options?: { manageLoading?: boolean }) => {
    const manageLoading = options?.manageLoading !== false;
    if (manageLoading) setLoadingCfg(true);
    try {
      const data = (await AdminService.email.config()) as MailConfig;
      setCfg(data);
    } catch {
      setCfg(null);
    } finally {
      if (manageLoading) setLoadingCfg(false);
    }
  }, []);

  const loadMessages = useCallback(async (page = 1) => {
    const dir = listTab === "all" ? undefined : listTab;
    const res = (await AdminService.email.messages({
      page,
      per_page: 30,
      direction: dir,
    })) as {
      data?: EmailMsg[];
      current_page?: number;
      last_page?: number;
    };
    setMessages(res.data ?? []);
    setMsgPage(res.current_page ?? 1);
    setMsgLastPage(res.last_page ?? 1);
    setSelected((prev) => {
      if (!prev) return null;
      return (res.data ?? []).find((m) => m.id === prev.id) ?? prev;
    });
  }, [listTab]);

  const loadUsers = useCallback(async () => {
    try {
      const res = (await AdminService.users.list({ per_page: 100, page: 1 })) as {
        data?: UserOpt[];
      };
      setUsers(res.data ?? []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCfg(true);
      try {
        const [cfgRes, usersRes, msgRes, contactsRes] = await Promise.all([
          AdminService.email.config().catch(() => null),
          AdminService.users.list({ per_page: 100, page: 1 }).catch(() => ({ data: [] as UserOpt[] })),
          AdminService.email.messages({ page: 1, per_page: 30, direction: undefined }).catch(() => ({
            data: [] as EmailMsg[],
            current_page: 1,
            last_page: 1,
          })),
          AdminService.email.contactSubmissions({ page: 1, per_page: 50 }).catch(() => ({ data: [] as ContactRow[] })),
        ]);
        if (cancelled) return;
        setCfg(cfgRes as MailConfig | null);
        setUsers((usersRes as { data?: UserOpt[] }).data ?? []);
        const m = msgRes as { data?: EmailMsg[]; current_page?: number; last_page?: number };
        setMessages(m.data ?? []);
        setMsgPage(m.current_page ?? 1);
        setMsgLastPage(m.last_page ?? 1);
        setContacts((contactsRes as { data?: ContactRow[] }).data ?? []);
        setNotice({ variant: "success", message: "Email desk loaded." });
      } catch {
        if (!cancelled) {
          setNotice({ variant: "error", message: "Could not load the email desk." });
        }
      } finally {
        if (!cancelled) setLoadingCfg(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const skipListTabOnMount = useRef(true);
  useEffect(() => {
    if (skipListTabOnMount.current) {
      skipListTabOnMount.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadMessages(1);
        if (!cancelled) setNotice({ variant: "info", message: "Message list updated." });
      } catch {
        if (!cancelled) setNotice({ variant: "error", message: "Failed to load messages." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listTab, loadMessages]);

  const flash = (msg: string, err?: string | null) => {
    setMessage(err ? null : msg);
    setError(err ?? null);
  };

  const onTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    flash("", null);
    try {
      const res = await AdminService.email.sendTest(testTo.trim());
      flash((res as { message?: string })?.message ?? "Sent.");
      await loadMessages(msgPage);
      setNotice({ variant: "success", message: "Test email sent and list refreshed." });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      const detail = ax.response?.data?.error || ax.response?.data?.message;
      flash("", detail || (err instanceof Error ? err.message : "Request failed"));
      setNotice({ variant: "error", message: "Test send failed." });
    } finally {
      setBusy(false);
    }
  };

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    flash("", null);
    try {
      const payload: {
        to: string;
        subject: string;
        body: string;
        reply_to?: string;
        client_user_id?: string;
      } = {
        to: sendTo.trim(),
        subject: sendSubject.trim(),
        body: sendBody,
      };
      if (replyTo.trim()) payload.reply_to = replyTo.trim();
      if (clientUserId) payload.client_user_id = clientUserId;
      const res = await AdminService.email.send(payload);
      flash((res as { message?: string })?.message ?? "Sent.");
      setSendSubject("");
      setSendBody("");
      await loadMessages(1);
      setNotice({ variant: "success", message: "Message sent and archived." });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      const detail = ax.response?.data?.error || ax.response?.data?.message;
      flash("", detail || (err instanceof Error ? err.message : "Request failed"));
      setNotice({ variant: "error", message: "Send failed." });
    } finally {
      setBusy(false);
    }
  };

  const onInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    flash("", null);
    try {
      const payload: {
        from_email: string;
        to_email: string;
        subject: string;
        body_text: string;
        client_user_id?: string;
      } = {
        from_email: inFrom.trim(),
        to_email: inTo.trim(),
        subject: inSubject.trim(),
        body_text: inBody,
      };
      if (inClientId) payload.client_user_id = inClientId;
      const res = await AdminService.email.recordInbound(payload);
      flash((res as { message?: string })?.message ?? "Saved.");
      setInSubject("");
      setInBody("");
      await loadMessages(1);
      setNotice({ variant: "success", message: "Client support message saved." });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      flash("", ax.response?.data?.message || (err instanceof Error ? err.message : "Request failed"));
      setNotice({ variant: "error", message: "Could not save client support message." });
    } finally {
      setBusy(false);
    }
  };

  const onMarkContactRead = async (row: ContactRow) => {
    if (row.read_at) return;
    setBusy(true);
    try {
      await AdminService.email.markContactRead(row.id);
      setContacts((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, read_at: new Date().toISOString() } : c)),
      );
      window.dispatchEvent(new CustomEvent("dsa-contact-inbox-updated"));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setNotice({ variant: "error", message: ax.response?.data?.message || "Could not mark read." });
    } finally {
      setBusy(false);
    }
  };

  const onMarkAllContactsRead = async () => {
    setBusy(true);
    try {
      await AdminService.email.markAllContactsRead();
      setContacts((prev) => prev.map((c) => ({ ...c, read_at: c.read_at ?? new Date().toISOString() })));
      window.dispatchEvent(new CustomEvent("dsa-contact-inbox-updated"));
      setNotice({ variant: "success", message: "All contact messages marked read." });
    } catch {
      setNotice({ variant: "error", message: "Could not mark all read." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Communications</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-white">
            <Mail className="h-3.5 w-3.5 text-[#8ab4ff]" />
            Email desk
          </h1>
          <p className="mt-0.5 max-w-3xl truncate text-[10px] text-[var(--dsa-text-muted)]">
            Client mail, public contact submissions, archived messages, and mail configuration.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            type="button"
            onClick={async () => {
              setLoadingCfg(true);
              try {
                await Promise.all([
                  loadConfig({ manageLoading: false }),
                  loadUsers(),
                  loadMessages(msgPage),
                  loadContacts(),
                ]);
                setNotice({ variant: "success", message: "Refreshed." });
              } catch {
                setNotice({ variant: "error", message: "Refresh failed." });
              } finally {
                setLoadingCfg(false);
              }
            }}
            disabled={loadingCfg}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            <RefreshCw className={loadingCfg ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </button>
        </div>
      </section>

      {!loadingCfg && cfg ? (
        <section className="dsa-terminal-panel overflow-hidden">
          <div className="grid gap-px bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Mailer</p>
              <p className="mt-1 font-mono text-xs text-white">{cfg.mailer || "—"}</p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">From</p>
              <p className="mt-1 truncate text-xs text-[var(--dsa-text-secondary)]">{cfg.from_address || "—"}</p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">SMTP</p>
              <p className={`mt-1 text-xs font-medium ${cfg.smtp_ready ? "text-[var(--dsa-positive)]" : "text-[var(--dsa-warning)]"}`}>
                {cfg.smtp_ready ? "Ready" : "Not ready"}
              </p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Contact inbox</p>
              <p className="mt-1 font-mono text-xs text-white">
                {contacts.filter((row) => !row.read_at).length} unread
              </p>
            </div>
          </div>

          {cfg.mailer === "log" ? (
            <div className="border-t border-[rgba(216,163,64,0.28)] bg-[rgba(216,163,64,0.08)] px-3 py-2 text-[10px] leading-relaxed text-[#d9bb7a]">
              Outbound mailer is <strong>log</strong>; messages are archived/logged but not delivered through SMTP.
            </div>
          ) : null}
          {cfg.mailer === "smtp" && cfg.smtp_ready === false ? (
            <div className="border-t border-[rgba(231,91,100,0.28)] bg-[rgba(231,91,100,0.08)] px-3 py-2 text-[10px] leading-relaxed text-[var(--dsa-negative)]">
              SMTP configuration is incomplete. Verify host, credentials, from address, port, and encryption in Laravel environment.
            </div>
          ) : null}
          {!cfg.support_notify_configured ? (
            <div className="border-t border-[var(--dsa-border)] px-3 py-2 text-[10px] text-[var(--dsa-text-muted)]">
              Optional support notification address is not configured.
            </div>
          ) : null}
        </section>
      ) : null}

      {showSettings && (
        <section className="dsa-terminal-panel overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <p className="text-xs font-semibold text-white">Mail configuration</p>
          </div>
          {loadingCfg ? (
            <p className="px-3 py-4 text-xs text-[var(--dsa-text-muted)]">Loading configuration…</p>
          ) : cfg ? (
            <dl className="divide-y divide-[var(--dsa-border)]">
              {[
                ["Mailer", cfg.mailer],
                ["From", `${cfg.from_name} <${cfg.from_address}>`],
                ["SMTP", `${cfg.smtp_host ?? "—"}:${cfg.smtp_port ?? "—"}`],
                ["SMTP ready", cfg.smtp_ready ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2 text-[11px]">
                  <dt className="text-[var(--dsa-text-muted)]">{label}</dt>
                  <dd className="min-w-0 truncate font-mono text-white">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-3 py-4 text-xs text-[var(--dsa-text-muted)]">Could not load configuration.</p>
          )}
        </section>
      )}

      {contacts.length > 0 ? (
        <section className="dsa-terminal-panel overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Website contacts</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">Public contact submissions · click an unread row to mark it read.</p>
            </div>
            <button
              type="button"
              disabled={busy || !contacts.some((row) => !row.read_at)}
              onClick={() => void onMarkAllContactsRead()}
              className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[260px] divide-y divide-[var(--dsa-border)] overflow-y-auto">
            {contacts.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={busy}
                onClick={() => void onMarkContactRead(row)}
                className={`grid w-full min-w-0 gap-1 px-3 py-2 text-left transition-colors tablet:grid-cols-[minmax(0,1fr)_160px] ${
                  row.read_at ? "hover:bg-[var(--dsa-surface-2)]" : "bg-[rgba(216,163,64,0.06)] hover:bg-[rgba(216,163,64,0.1)]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[11px] font-semibold text-white">{row.subject}</span>
                    {!row.read_at ? <span className="text-[9px] font-semibold uppercase text-[var(--dsa-warning)]">New</span> : null}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--dsa-text-muted)]">
                    {row.name} &lt;{row.email}&gt; · {row.message}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[var(--dsa-text-muted)] tablet:text-right">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {message ? (
        <div className="rounded-[var(--dsa-radius-sm)] border border-[rgba(44,182,125,0.28)] bg-[rgba(44,182,125,0.08)] px-3 py-2 text-[10px] text-[var(--dsa-positive)]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[var(--dsa-radius-sm)] border border-[rgba(231,91,100,0.28)] bg-[rgba(231,91,100,0.08)] px-3 py-2 text-[10px] text-[var(--dsa-negative)]">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 laptop:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <section className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div className="flex items-center gap-2">
              <Inbox className="h-3.5 w-3.5 text-[#8ab4ff]" />
              <p className="text-xs font-semibold text-white">Inbox / sent</p>
            </div>
            <div className="flex gap-1">
              {(["all", "inbound", "outbound"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setListTab(tab)}
                  className={`rounded-[var(--dsa-radius-sm)] border px-2 py-1 text-[9px] font-semibold uppercase ${
                    listTab === tab
                      ? "border-[rgba(76,141,255,0.4)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                      : "border-[var(--dsa-border)] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[430px] divide-y divide-[var(--dsa-border)] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[var(--dsa-text-muted)]">No messages yet.</p>
            ) : (
              messages.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    selected?.id === row.id ? "bg-[var(--dsa-accent-soft)]" : "hover:bg-[var(--dsa-surface-2)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-[var(--dsa-radius-sm)] px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      row.direction === "inbound"
                        ? "bg-[rgba(168,85,247,0.12)] text-[#c4a3ff]"
                        : "bg-[rgba(44,182,125,0.12)] text-[var(--dsa-positive)]"
                    }`}>
                      {row.direction}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--dsa-text-muted)]">{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-semibold text-white">{row.subject}</p>
                  <p className="mt-0.5 truncate text-[9px] text-[var(--dsa-text-muted)]">
                    {row.from_email} → {row.to_email}
                  </p>
                  {row.status === "failed" ? (
                    <p className="mt-1 truncate text-[9px] text-[var(--dsa-negative)]">Failed: {row.error_message}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--dsa-border)] px-3 py-2">
            <span className="font-mono text-[9px] text-[var(--dsa-text-muted)]">{msgPage}/{msgLastPage}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={msgPage <= 1}
                onClick={() => loadMessages(msgPage - 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[9px] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={msgPage >= msgLastPage}
                onClick={() => loadMessages(msgPage + 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[9px] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <p className="text-xs font-semibold text-white">Message</p>
            {selected ? <span className="text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">{selected.status}</span> : null}
          </div>
          {selected ? (
            <div>
              <div className="border-b border-[var(--dsa-border)] px-3 py-2">
                <p className="text-[11px] font-semibold text-white">{selected.subject}</p>
                <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">
                  {selected.from_email} → {selected.to_email}
                </p>
              </div>
              <pre className="max-h-[390px] min-h-[220px] overflow-auto whitespace-pre-wrap bg-[#070b0f] p-3 font-mono text-[10px] leading-relaxed text-[#b9e2cf]">
                {selected.body_text || "(empty body in archive)"}
              </pre>
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center text-xs text-[var(--dsa-text-muted)]">
              Select a message to inspect.
            </div>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-3 laptop:grid-cols-2">
        <section className="dsa-terminal-panel overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--dsa-positive)]" />
              <p className="text-xs font-semibold text-white">Compose to client</p>
            </div>
          </div>
          <form onSubmit={onSend} className="grid gap-2 p-3">
            <input
              type="email"
              required
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="To"
              className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
            />
            <div className="grid gap-2 phone:grid-cols-2">
              <select
                value={clientUserId}
                onChange={(e) => setClientUserId(e.target.value)}
                className="dsa-control h-8 min-h-0 px-2 text-[11px]"
              >
                <option value="">Link user: none</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.email || user.name || user.id).slice(0, 60)}
                  </option>
                ))}
              </select>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="Reply-To (optional)"
                className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
              />
            </div>
            <input
              type="text"
              required
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              maxLength={255}
              placeholder="Subject"
              className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
            />
            <textarea
              required
              value={sendBody}
              onChange={(e) => setSendBody(e.target.value)}
              rows={5}
              placeholder="Plain-text message"
              className="dsa-control min-h-[120px] resize-y px-2.5 py-2 text-[11px]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="dsa-button-primary min-h-0 px-3 py-1.5 text-[10px] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send & archive
              </button>
            </div>
          </form>
        </section>

        <section className="dsa-terminal-panel overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <p className="text-xs font-semibold text-white">Log client support message</p>
          </div>
          <form onSubmit={onInbound} className="grid gap-2 p-3">
            <div className="grid gap-2 phone:grid-cols-2">
              <input
                type="email"
                required
                value={inFrom}
                onChange={(e) => setInFrom(e.target.value)}
                placeholder="Client email"
                className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
              />
              <input
                type="email"
                required
                value={inTo}
                onChange={(e) => setInTo(e.target.value)}
                placeholder={cfg?.from_address || "Support inbox"}
                className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
              />
            </div>
            <select
              value={inClientId}
              onChange={(e) => setInClientId(e.target.value)}
              className="dsa-control h-8 min-h-0 px-2 text-[11px]"
            >
              <option value="">Link registered client: none</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.email || user.name || user.id).slice(0, 60)}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={inSubject}
              onChange={(e) => setInSubject(e.target.value)}
              placeholder="Subject"
              className="dsa-control h-8 min-h-0 px-2.5 text-[11px]"
            />
            <textarea
              required
              value={inBody}
              onChange={(e) => setInBody(e.target.value)}
              rows={5}
              placeholder="Paste client email or support request"
              className="dsa-control min-h-[120px] resize-y px-2.5 py-2 text-[11px]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="dsa-button-secondary min-h-0 px-3 py-1.5 text-[10px] disabled:opacity-50"
              >
                Save support message
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <p className="text-xs font-semibold text-white">Quick test</p>
        </div>
        <form onSubmit={onTest} className="flex flex-col gap-2 p-3 phone:flex-row phone:items-center">
          <input
            type="email"
            required
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Recipient"
            className="dsa-control h-8 min-h-0 min-w-0 flex-1 px-2.5 text-[11px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="dsa-button-secondary min-h-0 px-3 py-1.5 text-[10px] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send test
          </button>
        </form>
      </section>

      {notice ? (
        <CornerNotice message={notice.message} variant={notice.variant} onDismiss={dismissNotice} />
      ) : null}
    </div>
  );
}
