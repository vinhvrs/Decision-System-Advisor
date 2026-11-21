"use client";

import Link from "next/link";
import { useMemo } from "react";

const tabs = ["Overview", "Financials", "KPIs", "Estimates", "Valuation", "Earnings", "Ownership", "Filings", "News", "Chart"];

type Props = { symbol?: string; activeTab?: string };

function MetricPanel({ title, meta, rows }: { title: string; meta: string; rows: Array<[string, string, string]> }) {
  return (
    <section className="nt-panel">
      <div className="nt-panel-title">
        <strong>{title}</strong>
        <span className="nt-panel-meta">{meta}</span>
      </div>
      {rows.map(([name, value, note]) => (
        <div className="nt-metric-row" key={name}>
          <span>{name}</span>
          <b>{value}</b>
          <span className="nt-muted">{note}</span>
        </div>
      ))}
    </section>
  );
}

export default function CompanyWorkspace({ symbol = "AAPL", activeTab = "Overview" }: Props) {
  const normalized = useMemo(() => symbol.toUpperCase(), [symbol]);

  return (
    <div className="nt-workspace">
      <header className="nt-company-head">
        <div className="nt-company-summary">
          <div className="nt-company-name">
            <span className="nt-company-mark">{normalized.slice(0, 1)}</span>
            <div>
              <h1>{normalized}</h1>
              <p>Company profile · source metadata pending</p>
            </div>
          </div>
          <div>
            <div className="nt-price">—</div>
            <div className="nt-label" style={{ marginTop: 5 }}>Price awaiting validated source</div>
          </div>
          <div className="nt-top-context">
            <span>Watchlist</span>
            <span>Compare</span>
            <span className="nt-status-warn">Partial until adapters complete</span>
          </div>
        </div>

        <nav className="nt-tabs" aria-label="Company research sections">
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={tab === "Overview" ? `/companies/profile/${normalized.toLowerCase()}` : `/companies/profile/${normalized.toLowerCase()}?view=${tab.toLowerCase()}`}
              className="nt-tab"
              data-active={activeTab.toLowerCase() === tab.toLowerCase()}
            >
              {tab}
            </Link>
          ))}
        </nav>
      </header>

      {activeTab.toLowerCase() === "overview" ? (
        <div className="nt-grid nt-grid-company">
          <div className="nt-section-stack">
            <section className="nt-panel">
              <div className="nt-panel-title">
                <strong>Business overview</strong>
                <span className="nt-panel-meta">Company source</span>
              </div>
              <div className="nt-panel-body nt-muted">
                Description appears only when the company profile endpoint returns a validated record.
              </div>
            </section>
            <MetricPanel title="Financial trend" meta="Reported" rows={[
              ["Revenue", "—", "Awaiting"],
              ["Net income", "—", "Awaiting"],
              ["Free cash flow", "—", "Awaiting"],
              ["Gross margin", "—", "Awaiting"],
            ]} />
            <MetricPanel title="Operating KPIs" meta="Latest period" rows={[
              ["Primary KPI", "—", "Company-specific"],
              ["Secondary KPI", "—", "Company-specific"],
              ["Unit economics", "—", "If available"],
              ["Margin KPI", "—", "If available"],
            ]} />
          </div>

          <div className="nt-section-stack">
            <MetricPanel title="Valuation snapshot" meta="Forward / trailing" rows={[
              ["P/E", "—", "Awaiting"],
              ["EV / EBITDA", "—", "Awaiting"],
              ["FCF yield", "—", "Awaiting"],
              ["Price / Sales", "—", "Awaiting"],
            ]} />
            <MetricPanel title="Latest earnings" meta="Reported + consensus" rows={[
              ["EPS", "—", "Awaiting"],
              ["Revenue", "—", "Awaiting"],
              ["Next report", "—", "Awaiting"],
              ["Coverage", "—", "Not inferred"],
            ]} />
          </div>

          <aside className="nt-section-stack">
            <section className="nt-panel">
              <div className="nt-panel-title">
                <strong>Research coverage</strong>
                <span className="nt-panel-meta">Data health</span>
              </div>
              {["Financials", "KPIs", "Estimates", "Valuation", "Earnings", "Ownership", "Filings"].map((name) => (
                <div className="nt-metric-row" key={name}>
                  <span>{name}</span>
                  <b>—</b>
                  <span className="nt-warning">Awaiting</span>
                </div>
              ))}
            </section>
          </aside>
        </div>
      ) : (
        <ResearchSection activeTab={activeTab} />
      )}
    </div>
  );
}

function ResearchSection({ activeTab }: { activeTab: string }) {
  const tableTabs = new Set(["financials", "kpis", "estimates", "valuation", "earnings", "ownership", "filings"]);
  const key = activeTab.toLowerCase();

  if (!tableTabs.has(key)) {
    return (
      <section className="nt-panel">
        <div className="nt-panel-title"><strong>{activeTab}</strong><span className="nt-panel-meta">New workspace</span></div>
        <div className="nt-empty">This research surface is ready for its source adapter.</div>
      </section>
    );
  }

  return (
    <div className="nt-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 310px" }}>
      <section className="nt-panel">
        <div className="nt-panel-title">
          <strong>{activeTab}</strong>
          <span className="nt-panel-meta">Source-aligned table</span>
        </div>
        <div className="nt-table-wrap">
          <table className="nt-table">
            <thead>
              <tr><th>Metric / Period</th><th>Reported</th><th>Previous</th><th>Change</th><th>Source</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, i) => (
                <tr key={i}>
                  <td>Awaiting source field</td>
                  <td className="nt-mono">—</td>
                  <td className="nt-mono">—</td>
                  <td className="nt-mono">—</td>
                  <td>Unavailable</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="nt-panel">
        <div className="nt-panel-title">
          <strong>Selected line item</strong>
          <span className="nt-panel-meta">Trend / metadata</span>
        </div>
        <div className="nt-panel-body">
          <div className="nt-chart-canvas" style={{ minHeight: 300 }} />
          <div className="nt-empty" style={{ minHeight: 90 }}>
            No chart is synthesized while historical observations are unavailable.
          </div>
        </div>
      </aside>
    </div>
  );
}
