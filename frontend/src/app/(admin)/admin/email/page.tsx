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
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Mail className="text-blue-400" size={28} />
            Email desk
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Send mail to clients, keep copies in the thread list, and review messages from the public contact page.
            Automatic inbound mail (IMAP/webhooks) is not wired yet — use <strong className="text-white/80">Log client message</strong>{" "}
            to paste forwarded emails when needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <Settings className="h-4 w-4" />
            Mail settings
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
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={loadingCfg ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>
        </div>
      </div>

      {!loadingCfg && cfg ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm space-y-2">
          {cfg.mailer === "log" ? (
            <p className="text-amber-200/95">
              Outbound mailer is <strong>log</strong> — messages are written to the API log only, not delivered. Set{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_MAILER=smtp</code> plus host, port, username,
              password, and <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_FROM_ADDRESS</code> in the Laravel{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">.env</code>.
            </p>
          ) : null}
          {cfg.mailer === "smtp" && cfg.smtp_ready === false ? (
            <p className="text-red-200/95">
              SMTP looks incomplete: set <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_HOST</code>,{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_USERNAME</code>,{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_PASSWORD</code>, and a valid{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_FROM_ADDRESS</code>. For port 587 use{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_ENCRYPTION=tls</code> when your host requires it.
            </p>
          ) : null}
          {cfg.mailer === "smtp" && cfg.smtp_ready ? (
            <p className="text-emerald-200/95">SMTP appears ready for sending from {cfg.from_address || "—"}.</p>
          ) : null}
          {cfg.support_notify_configured ? null : (
            <p className="text-white/55">
              Optional: set <code className="rounded bg-black/30 px-1 text-[11px]">MAIL_SUPPORT_ADDRESS</code> in{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">.env</code> to receive a copy when someone submits the
              site contact form.
            </p>
          )}
        </div>
      ) : null}


      {contacts.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/80">Website contacts</h2>
            <button
              type="button"
              disabled={busy || !contacts.some((c) => !c.read_at)}
              onClick={() => void onMarkAllContactsRead()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onMarkContactRead(c)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    c.read_at
                      ? "border-white/10 bg-black/20 hover:border-white/20"
                      : "border-amber-500/40 bg-amber-500/5 hover:border-amber-400/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{c.subject}</span>
                    <span className="shrink-0 text-[10px] text-white/45">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/60">
                    {c.name} &lt;{c.email}&gt;
                    {!c.read_at ? <span className="ml-2 text-amber-300/90">· New</span> : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/75">{c.message}</p>
                  {!c.read_at ? (
                    <p className="mt-1 text-[10px] text-white/40">Click to mark as read</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {showSettings && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/80">Configuration</h2>
          {loadingCfg ? (
            <p className="mt-3 text-sm text-white/40">Loading…</p>
          ) : cfg ? (
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 py-2">
                <dt className="text-white/50">Mailer</dt>
                <dd className="font-mono text-white">{cfg.mailer}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 py-2">
                <dt className="text-white/50">From</dt>
                <dd className="text-right text-white">
                  {cfg.from_name} &lt;{cfg.from_address}&gt;
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 py-2">
                <dt className="text-white/50">SMTP</dt>
                <dd className="text-right font-mono text-white">
                  {cfg.smtp_host ?? "—"}:{cfg.smtp_port ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 py-2">
                <dt className="text-white/50">SMTP ready</dt>
                <dd className="text-right text-white">{cfg.smtp_ready ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-white/50">Notes</dt>
                <dd className="text-right text-xs text-white/55">
                  <code className="text-[11px]">MAIL_MAILER=log</code> writes to laravel.log only. Use real SMTP for delivery.
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-white/40">Could not load configuration.</p>
          )}
        </section>
      )}

      <div className="grid gap-6 laptop:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
              <Inbox className="h-4 w-4 text-blue-400" />
              Inbox / Sent
            </h2>
            <div className="flex gap-1 rounded-lg bg-black/30 p-1">
              {(["all", "inbound", "outbound"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setListTab(t)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase ${
                    listTab === t ? "bg-blue-600 text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-white/45">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selected?.id === m.id
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-white/10 bg-black/25 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        m.direction === "inbound" ? "bg-violet-500/20 text-violet-200" : "bg-emerald-500/20 text-emerald-200"
                      }`}
                    >
                      {m.direction}
                    </span>
                    <span className="text-[10px] text-white/40">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-white">{m.subject}</p>
                  <p className="text-[11px] text-white/50">
                    {m.from_email} → {m.to_email}
                  </p>
                  {m.status === "failed" ? (
                    <p className="mt-1 text-[11px] text-red-300/90">Failed: {m.error_message}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/50">
            <span>
              Page {msgPage} / {msgLastPage}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={msgPage <= 1}
                onClick={() => loadMessages(msgPage - 1)}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={msgPage >= msgLastPage}
                onClick={() => loadMessages(msgPage + 1)}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/80">Message</h2>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p className="text-white/50">
                <span className="font-semibold text-white/80">{selected.subject}</span>
              </p>
              <p className="text-xs text-white/45">
                {selected.from_email} → {selected.to_email}
              </p>
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-emerald-100/90">
                {selected.body_text || "(empty body in archive)"}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-white/45">Select a row to read the full body.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          Compose (send to client)
        </h2>
        <form onSubmit={onSend} className="grid gap-4 tablet:grid-cols-2">
          <div className="tablet:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/50">To</label>
            <input
              type="email"
              required
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Link registered user (optional)</label>
            <select
              value={clientUserId}
              onChange={(e) => setClientUserId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="">— None —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.email || u.name || u.id).slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Reply-To (optional)</label>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="tablet:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/50">Subject</label>
            <input
              type="text"
              required
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              maxLength={255}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="tablet:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/50">Body (plain text)</label>
            <textarea
              required
              value={sendBody}
              onChange={(e) => setSendBody(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="tablet:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send &amp; archive
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/80">
          Client message to support
        </h2>
        <p className="mb-4 text-xs text-white/45">
          Use this when a client contacts support (email, forwarded thread, or pasted text). It creates the same
          archived row as a real inbound email so your team has a single trail. IMAP is not connected yet—everything
          here is manual entry.
        </p>
        <form onSubmit={onInbound} className="grid gap-4 tablet:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Client email (from)</label>
            <input
              type="email"
              required
              value={inFrom}
              onChange={(e) => setInFrom(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Support / your inbox (to)</label>
            <input
              type="email"
              required
              value={inTo}
              onChange={(e) => setInTo(e.target.value)}
              placeholder={cfg?.from_address || "you@company.com"}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Link registered client (optional)</label>
            <select
              value={inClientId}
              onChange={(e) => setInClientId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="">— None —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.email || u.name || u.id).slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          <div className="tablet:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/50">Subject (from client)</label>
            <input
              type="text"
              required
              value={inSubject}
              onChange={(e) => setInSubject(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="tablet:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/50">Their message</label>
            <textarea
              required
              value={inBody}
              onChange={(e) => setInBody(e.target.value)}
              rows={5}
              placeholder="Paste the client’s email or support request here…"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="tablet:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Save support message
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/80">Quick test</h2>
        <form onSubmit={onTest} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-white/50">Recipient</label>
            <input
              type="email"
              required
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
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
