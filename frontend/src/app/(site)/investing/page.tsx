import Link from "next/link";
import { ChevronRight, History, Newspaper, PanelsTopLeft } from "lucide-react";
import HomeLiveMarketSection from "@/src/components/home/HomeLiveMarketSection";
import {
  HomeDashboardCharts,
  HomeWatchlistCard,
  HomeHotNews,
  HomeGainLoss,
  HomeHeatmapCard,
} from "../home-sections";

export default function InvestingHomePage() {
  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
            <PanelsTopLeft className="h-4 w-4 text-[#8ab4ff]" />
          </div>
          <div className="min-w-0">
            <p className="dsa-section-label">Market research</p>
            <h1 className="truncate text-sm font-semibold text-white">Research workspace</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <a href="#dashboard" className="dsa-button-primary min-h-0 px-2.5 py-1 text-[11px]">
            Dashboard
          </a>
          <Link href="/investing/history" className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[11px]">
            <History className="h-3.5 w-3.5" />
            History
          </Link>
          <a href="#market-news" className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[11px]">
            <Newspaper className="h-3.5 w-3.5" />
            News
          </a>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Primary view</p>
          <p className="mt-1 text-xs font-medium text-white">Charts + market context</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Watchlist</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Tracked symbols</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Breadth</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Gainers / losers + heatmap</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Signal contract</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Incomplete inputs → Not Rated</p>
        </div>
      </section>

      <section id="dashboard" className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)] xl:items-start">
        <div className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Market charts & decision context</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">
                Price state, source freshness, supporting indicators and chart context.
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
              Workspace
            </span>
          </div>
          <div className="p-2 tablet:p-3">
            <HomeDashboardCharts />
          </div>
        </div>

        <div className="dsa-terminal-panel min-w-0 overflow-hidden xl:sticky xl:top-[calc(var(--dsa-header-height)+var(--dsa-terminal-modulebar-height)+12px)]">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Live market & watchlist</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">
                Current market context beside tracked names.
              </p>
            </div>
          </div>
          <div className="p-2 tablet:p-3">
            <HomeLiveMarketSection watchlist={<HomeWatchlistCard />} />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div id="market-news" className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Market headlines</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">Recent stories linked to monitored instruments and themes.</p>
            </div>
            <Link href="/news" className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8ab4ff] hover:text-white">
              All news <ChevronRight size={12} />
            </Link>
          </div>
          <div className="p-2 tablet:p-3">
            <HomeHotNews />
          </div>
        </div>

        <div className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Breadth leaders</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">Daily gainers and losers.</p>
            </div>
          </div>
          <div className="p-2 tablet:p-3">
            <HomeGainLoss />
          </div>
        </div>
      </section>

      <section className="dsa-terminal-panel min-w-0 overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Market heatmap</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">Cross-sectional view of size and daily performance.</p>
          </div>
        </div>
        <div className="p-2 tablet:p-3">
          <HomeHeatmapCard />
        </div>
      </section>
    </div>
  );
}
