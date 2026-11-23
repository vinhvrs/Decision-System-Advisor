"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { sourceLink, type News, type Universe } from "../feeds";
import SiteLayoutEditor from "../layout/SiteLayoutEditor";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";
import {
  BarChart3,
  Bell,
  Building2,
  ChartNoAxesCombined,
  CalendarDays,
  Gauge,
  Newspaper,
  Search,
  Star,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";

const items = [
  { href: "/", label: "Markets", icon: Gauge },
  { href: "/screener", label: "Screener", icon: Table2 },
  { href: "/companies", label: "Company", icon: Building2 },
  { href: "/investing", label: "Chart Lab", icon: ChartNoAxesCombined },
  { href: "/indicators", label: "Indicators", icon: BarChart3 },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/watchlists", label: "Watchlists", icon: Star },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/companies") return pathname.startsWith("/companies");
  return pathname.startsWith(href);
}

type UtilityView = "movers" | "news" | "alerts" | null;
type LocalAlert = { id: string; symbol: string; condition: "above" | "below"; target: number; enabled: boolean; createdAt: number };

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [utilityView, setUtilityView] = useState<UtilityView>(null);
  const [localAlerts, setLocalAlerts] = useState<LocalAlert[]>([]);
  const universe = useFeed<{ data: Universe[] }>(searchOpen ? "/api/v1/universe" : null);
  const market = useFeed<{ data: MarketRow[] }>(utilityView === "movers" ? "/api/v1/market-heatmap" : null, 30000);
  const news = useFeed<{ data: News[]; last_page: number }>(utilityView === "news" ? "/api/news?page=1" : null);
  const movers = useMemo(() => [...(market.data?.data ?? [])]
    .filter(row => row.change_pct != null)
    .sort((a,b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, 12), [market.data]);
  const matching = (universe.data?.data ?? []).filter(row =>
    `${row.symbol} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10);
  useEffect(() => {
    function loadAlerts() {
      try {
        const raw = window.localStorage.getItem("dsa.chart.price-alerts.v1");
        const parsed = raw ? JSON.parse(raw) : [];
        setLocalAlerts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setLocalAlerts([]);
      }
    }
    loadAlerts();
    window.addEventListener("storage", loadAlerts);
    return () => window.removeEventListener("storage", loadAlerts);
  }, []);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(value => !value);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function runCommand(raw: string) {
    const command = raw.trim().replace(/^\//, "").toLowerCase();
    const action =
      command === "layout edit" ? "enable" :
      command === "layout export" ? "export" :
      command === "layout reset" ? "reset" :
      command === "layout test" ? "test" :
      command === "layout done" ? "disable" :
      null;
    if (!action) return false;
    window.dispatchEvent(new CustomEvent("dsa:layout-editor", { detail: { action } }));
    setQuery("");
    setSearchOpen(false);
    return true;
  }

  const layoutCommands = [
    { command: "layout edit", description: "Drag and resize cards across the current workspace" },
    { command: "layout export", description: "Download the site layout contract JSON" },
    { command: "layout reset", description: "Reset the saved layout for this route" },
    { command: "layout test", description: "Run a real pointer drag self-test and automatically restore layout" },
    { command: "layout done", description: "Save the current route layout and exit edit mode" },
  ].filter(item => !query.trim() || item.command.includes(query.trim().replace(/^\//, "").toLowerCase()));

  return (
    <div className="nt-shell">
      <header className="nt-topbar">
        <Link href="/" className="nt-brand" aria-label="DSA home">
          <span className="nt-brand-mark">D</span>
          <span>DSA</span>
        </Link>

        <button type="button" className="nt-command" aria-label="Open command search" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}>
          <Search size={13} aria-hidden />
          <kbd>⌘K</kbd>
          <span>Search symbol, company, metric or command…</span>
        </button>

        <div className="nt-top-context">
          <span>US Equities</span>
          <span>Research Workspace</span>
        </div>
      </header>

      {searchOpen && <section className="nt-panel nt-command-palette" aria-label="Search instruments and commands">
        <div className="nt-toolbar"><label>Symbol, company or command <input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && runCommand(query)) event.preventDefault(); }} placeholder="Try: layout edit" /></label><button type="button" onClick={() => setSearchOpen(false)}>Close</button></div>
        {layoutCommands.length > 0 && <div className="nt-command-results">
          {layoutCommands.map(item => <button key={item.command} type="button" className="nt-command-result" onClick={() => runCommand(item.command)}><kbd>{item.command}</kbd><span>{item.description}</span></button>)}
        </div>}
        <div className="nt-toolbar">{matching.map(row => <Link key={row.symbol} href={`/companies/profile/${encodeURIComponent(row.symbol)}`} onClick={() => setSearchOpen(false)}>{row.symbol} · {row.name}</Link>)}
          {!matching.length && query.trim() && !layoutCommands.length && <span>{universe.data ? "No matching instruments" : "Loading instruments…"}</span>}
        </div>
      </section>}

      <nav className="nt-primary-nav" aria-label="Primary workspaces">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="nt-nav-link" data-active={active(pathname, href)}>
            <Icon size={14} strokeWidth={1.6} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="nt-layout">
        <main className="nt-main">{children}</main>
      </div>

      <aside className="nt-utility-dock" aria-label="Research utility rail">
        <button type="button" className="nt-utility-button" data-active={utilityView === "movers"} onClick={() => setUtilityView(value => value === "movers" ? null : "movers")} aria-label="Toggle movers">
          <TrendingUp size={15} strokeWidth={1.6} />
          <span>Movers</span>
        </button>
        <button type="button" className="nt-utility-button" data-active={utilityView === "news"} onClick={() => setUtilityView(value => value === "news" ? null : "news")} aria-label="Toggle news">
          <Newspaper size={15} strokeWidth={1.6} />
          <span>News</span>
        </button>
        <button type="button" className="nt-utility-button" data-active={utilityView === "alerts"} onClick={() => setUtilityView(value => value === "alerts" ? null : "alerts")} aria-label="Toggle alerts">
          <Bell size={15} strokeWidth={1.6} />
          <span>Alerts</span>
        </button>
        <Link className="nt-utility-button" href="/watchlists" aria-label="Open watchlists">
          <Star size={15} strokeWidth={1.6} />
          <span>Lists</span>
        </Link>
      </aside>

      {utilityView && <section className="nt-utility-drawer" aria-label={`${utilityView} utility drawer`}>
        <div className="nt-panel-title">
          <strong>{utilityView === "movers" ? "Market movers" : utilityView === "news" ? "Latest headlines" : "Local alerts"}</strong>
          <button type="button" className="nt-table-action" onClick={() => setUtilityView(null)} aria-label="Close utility drawer"><X size={13} /></button>
        </div>

        {utilityView === "movers" && <table className="nt-microtable">
          <thead><tr><th>Symbol</th><th>Last</th><th>Chg%</th></tr></thead>
          <tbody>
            {movers.map(row => <tr key={row.symbol}>
              <td><Link href={`/companies/profile/${encodeURIComponent(row.symbol)}`}>{row.symbol}</Link></td>
              <td>{row.price == null ? "—" : row.price.toLocaleString("en-US",{maximumFractionDigits:2})}</td>
              <td className={(row.change_pct ?? 0) > 0 ? "nt-positive" : (row.change_pct ?? 0) < 0 ? "nt-negative" : ""}>{row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`}</td>
            </tr>)}
            {!movers.length && <tr><td colSpan={3}>No movers available</td></tr>}
          </tbody>
        </table>}

        {utilityView === "news" && <div className="nt-utility-news">
          {(news.data?.data ?? []).slice(0, 10).map(item => <a key={item.id} href={sourceLink(item.source)} rel="noreferrer" className="nt-utility-news-item">
            <span>{item.symbol || "GLOBAL"}</span>
            <strong>{item.title}</strong>
            <small>{item.published_at ?? "Timestamp unavailable"}</small>
          </a>)}
          {!news.data?.data?.length && <div className="nt-database-note">No recent headlines</div>}
        </div>}

        {utilityView === "alerts" && <table className="nt-microtable">
          <thead><tr><th>Symbol</th><th>Condition</th><th>Target</th></tr></thead>
          <tbody>
            {localAlerts.filter(alert => alert.enabled).slice(0, 12).map(alert => <tr key={alert.id}>
              <td><Link href={`/investing?symbol=${encodeURIComponent(alert.symbol)}`}>{alert.symbol}</Link></td>
              <td>{alert.condition === "above" ? "Above" : "Below"}</td>
              <td>{alert.target.toLocaleString("en-US",{maximumFractionDigits:2})}</td>
            </tr>)}
            {!localAlerts.some(alert => alert.enabled) && <tr><td colSpan={3}>No armed browser-local alerts</td></tr>}
          </tbody>
        </table>}

        <div className="nt-database-note">Movers, headlines and saved price levels stay linked to the current research workflow.</div>
      </section>}

      <SiteLayoutEditor />
    </div>
  );
}
