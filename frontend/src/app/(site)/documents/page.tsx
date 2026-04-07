"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  ExternalLink,
  Search,
  Filter,
  FileCode,
  FileBarChart,
  BookOpen,
  Sigma,
  Calculator,
  Shield,
} from "lucide-react";

type MainView = "library" | "docs";
type DocTab = "ranking" | "indicators" | "privacy";

function parseHash(): { main: MainView; tab: DocTab } {
  if (typeof window === "undefined") {
    return { main: "library", tab: "ranking" };
  }
  const h = window.location.hash.replace(/^#/, "").toLowerCase();
  if (h === "library" || h === "") {
    return { main: "library", tab: "ranking" };
  }
  if (h === "formula" || h === "indicators") {
    return { main: "docs", tab: "indicators" };
  }
  if (h === "ranking" || h === "functional") {
    return { main: "docs", tab: "ranking" };
  }
  if (h === "privacy") {
    return { main: "docs", tab: "privacy" };
  }
  if (h === "docs") {
    return { main: "docs", tab: "ranking" };
  }
  return { main: "library", tab: "ranking" };
}

/** Mathematical formulas — serif display, not code */
function MathPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-[#141a26] to-[#0d1018] px-5 py-5 font-serif text-[15px] leading-relaxed text-gray-100 shadow-inner">
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

function M({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-center tracking-wide ${className}`.trim()}>{children}</div>;
}

/** stacked fraction a/b */
function Frac({ num, den }: { num: React.ReactNode; den: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.95em]">
      <span className="px-1">{num}</span>
      <span className="h-px w-full min-w-[1.5rem] bg-gray-400/90" />
      <span className="px-1">{den}</span>
    </span>
  );
}

function RankingCalculationsContent() {
  return (
    <article id="docs-ranking" className="scroll-mt-24 space-y-12 text-gray-300">
      <header className="border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold text-white">Functional calculation — ranking attributes &amp; values</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
          How DSA turns daily snapshot fields and history into the numbers you see on boards, heatmaps, and rankings. Each
          attribute below maps to stored or derived values used for ordering, coloring, and labels. Aligned with Laravel{" "}
          <code className="rounded bg-gray-900 px-1">BuildSnapshot</code>,{" "}
          <code className="rounded bg-gray-900 px-1">SnapshotService</code>, Python{" "}
          <code className="rounded bg-gray-900 px-1">stock_compare</code>, and the beginner views. Not trading advice.
        </p>
      </header>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">1. Instrument snapshot — Price, Open, Volume</h3>
        <p className="mb-2 text-sm text-gray-400">
          One row per instrument in <code className="rounded bg-gray-800 px-1">instrument_snapshot</code>, built from the
          latest <strong className="text-gray-300">daily</strong> bar in{" "}
          <code className="rounded bg-gray-800 px-1">instrument_data</code> for that instrument&apos;s daily period (console
          job <code className="rounded bg-gray-800 px-1">snapshot:build</code>).
        </p>
        <MathPanel>
          <M>
            Take the instrument&apos;s <strong className="font-semibold text-gray-200">most recent daily</strong> bar.
            Write <em>C</em> for its close, <em>O</em> for its open, and <em>V</em> for share volume on that bar.
          </M>
          <M>
            <em>P</em> = <em>C</em>&nbsp;&nbsp;(snapshot price)
          </M>
          <M>
            The snapshot row stores (<em>P</em>, <em>O</em>, <em>V</em>).
          </M>
        </MathPanel>
        <p className="mt-2 text-sm text-gray-500">
          APIs and heatmaps read these stored values; they are not live exchange ticks unless a separate stream overwrites
          display.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">2. Liquidity (snapshot)</h3>
        <p className="mb-2 text-sm text-gray-400">
          Dollar-turnover <strong className="text-gray-300">proxy</strong> for that daily bar: price × volume on the same
          row. Used in rankings, beginner board columns, and liquidity sum on the market view.
        </p>
        <MathPanel>
          <M>
            <em>L</em> = <em>P</em> · <em>V</em>
          </M>
          <M className="text-sm text-gray-400">
            Same as <em>L</em> = <em>C</em> · <em>V</em> when the snapshot uses <em>P</em> = <em>C</em>.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">3. Change % (snapshot — “change_pct” / “24h” in UI)</h3>
        <p className="mb-2 text-sm text-gray-400">
          Percent move from that bar&apos;s <strong className="text-gray-300">open</strong> to{" "}
          <strong className="text-gray-300">close</strong> (intraday-of-bar style in our data), rounded to 2 decimals when
          written.
        </p>
        <MathPanel>
          <M>If <em>O</em> &gt; 0, define the bar&apos;s percentage change</M>
          <M>
            Δ<sub>%</sub> = 100 · <Frac num={<>C − O</>} den={<em>O</em>} />
          </M>
          <M className="text-sm text-gray-400">
            Store round(Δ<sub>%</sub>) to <strong className="text-gray-300">two decimal places</strong>. If <em>O</em> ≤ 0,
            that instrument is omitted from the snapshot build.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">4. Board “effective %” &amp; sparkline change (beginner UI)</h3>
        <p className="mb-2 text-sm text-gray-400">
          For some <strong className="text-gray-300">averaged header %</strong> widgets, the app may use the last two{" "}
          <strong className="text-gray-300">daily closes</strong> from fetched OHLC history when available. Fear &amp; Greed
          uses snapshot <code className="rounded bg-gray-800 px-1">change_pct</code> only (see sections 7–8), not this
          effective series.
        </p>
        <MathPanel>
          <M>
            Let <em>c</em>
            <sub>n−1</sub> and <em>c</em>
            <sub>n</sub> be the previous and last daily closes in the aligned history.
          </M>
          <M>
            If <em>c</em>
            <sub>n−1</sub> &gt; 0:&nbsp;&nbsp;effective Δ<sub>%</sub> = 100 ·{" "}
            <Frac num={<>c<sub>n</sub> − c<sub>n−1</sub></>} den={<>c<sub>n−1</sub></>} />
          </M>
          <M className="text-sm text-gray-400">
            If the series is too short, use the snapshot bar&apos;s Δ<sub>%</sub> instead.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">5. Radar axis “Change” magnitude (backend)</h3>
        <p className="mb-2 text-sm text-gray-400">
          For quintile scoring on the <strong className="text-gray-300">Change</strong> spoke, Laravel uses the larger of (a)
          absolute % move vs previous daily close from the last two daily bars, or (b) absolute snapshot{" "}
          <code className="rounded bg-gray-800 px-1">change_pct</code>.
        </p>
        <MathPanel>
          <M>
            <em>r</em>
            <sub>prev</sub> ={" "}
            <span className="whitespace-nowrap">
              |100 ·{" "}
              <Frac
                num={<>C<sub>last</sub> − C<sub>prev</sub></>}
                den={
                  <>
                    <em>C</em>
                    <sub>prev</sub>
                  </>
                }
              />
              |
            </span>
            &nbsp;&nbsp;(two most recent daily closes)
          </M>
          <M>
            <em>r</em>
            <sub>snap</sub> = |Δ<sub>%</sub>| from the snapshot bar
          </M>
          <M>
            For the Change spoke, use <em>m</em> = <em>r</em>
            <sub>prev</sub> when <em>r</em>
            <sub>prev</sub> &gt; 0, otherwise <em>m</em> = <em>r</em>
            <sub>snap</sub>.
          </M>
          <M className="text-sm text-gray-400">
            Larger <em>m</em> maps to a higher quintile like other positive magnitudes.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">6. Fear &amp; Greed — sentiment labels (0–100)</h3>
        <p className="mb-2 text-sm text-gray-400">
          After computing a numeric index F, map to a label using fixed thresholds (same for board and per-symbol variants):
        </p>
        <MathPanel>
          <M>Map index <em>F</em> ∈ [0, 100] to labels (upper-bound convention):</M>
          <M>
            <em>F</em> ≤ 24 &nbsp;⇒&nbsp; Extreme Fear
          </M>
          <M>
            <em>F</em> ≤ 44 &nbsp;⇒&nbsp; Fear
          </M>
          <M>
            <em>F</em> ≤ 55 &nbsp;⇒&nbsp; Neutral
          </M>
          <M>
            <em>F</em> ≤ 74 &nbsp;⇒&nbsp; Greed
          </M>
          <M>
            <em>F</em> &gt; 74 &nbsp;⇒&nbsp; Extreme Greed
          </M>
          <M className="pt-1 text-sm text-gray-400">
            Clip any raw score <em>x</em> into [0, 100] by <em>x</em>′ = min(100, max(0, <em>x</em>)).
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">7. Fear &amp; Greed — per symbol (profile + row hover)</h3>
        <p className="mb-2 text-sm text-gray-400">
          Let r<sub>i</sub> be the symbol&apos;s daily snapshot percent change (same as{" "}
          <code className="rounded bg-gray-800 px-1">change_pct_snapshot</code> / Laravel beginner radar). The Next.js app
          computes the strip from this value with{" "}
          <code className="rounded bg-gray-800 px-1">fearGreedFromChangePct</code> so it always matches the documented
          mapping. If r is missing or non-finite, use F = 50 (Neutral).
        </p>
        <MathPanel>
          <M>
            <em>F</em>
            <sub>i</sub> = round{" "}
            <span className="whitespace-nowrap">
              ( min(100, max(0, 50 + 3.25 · <em>r</em>
              <sub>i</sub>)) )
            </span>
          </M>
          <M className="text-sm text-gray-400">
            If <em>r</em>
            <sub>i</sub> is missing, set <em>F</em>
            <sub>i</sub> = 50 (Neutral).
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">8. Fear &amp; Greed — board / toolbar gauge</h3>
        <p className="mb-2 text-sm text-gray-400">
          Same mapping as section 7, applied <strong className="text-gray-300">once</strong> to the arithmetic mean of
          snapshot % changes over ranked rows that have a finite snapshot value. No separate breadth term — one formula for
          the whole product.
        </p>
        <MathPanel>
          <M>
            <em>r̄</em> = <Frac num={<>Σ <em>r</em>
              <sub>j</sub></>} den={<em>n</em>} />
            &nbsp;&nbsp;over rows with finite snapshot <em>r</em>
            <sub>j</sub> = Δ<sub>%</sub> from the snapshot bar
          </M>
          <M>
            <em>F</em>
            <sub>board</sub> = round
            <span className="whitespace-nowrap">
              {" "}
              ( min(100, max(0, 50 + 3.25 · <em>r̄</em>)) )
            </span>
          </M>
          <M className="text-sm text-gray-400">If <em>n</em> = 0, set <em>F</em>
            <sub>board</sub> = 50.</M>
        </MathPanel>
        <p className="mt-2 text-sm text-gray-500">
          Implemented as <code className="rounded bg-gray-800 px-1">fearGreedFromBoardRows</code> in the Next.js app.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">9. Beginner ranking board — pool and row scores</h3>
        <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-gray-400">
          <li>
            Pool: top N symbols by <code className="rounded bg-gray-800 px-1">instrument_snapshot.volume</code> (cached,
            refreshed at most every 3 hours).
          </li>
          <li>
            Six integers 1–5 per row: <strong className="text-gray-300">Signal</strong> (watchlist tier),{" "}
            <strong className="text-gray-300">Price</strong>, <strong className="text-gray-300">Change</strong>,{" "}
            <strong className="text-gray-300">Volume</strong>, <strong className="text-gray-300">Liquidity</strong>,{" "}
            <strong className="text-gray-300">Watchers</strong> (quintiles within the pool, except Signal).
          </li>
          <li>
            <code className="rounded bg-gray-800 px-1">strong_count</code> = among Signal, Change, Volume, Liquidity, and
            Watchers only, how many have value ≥ 4 (Price period score is excluded). Used for API sort and shown as Str x/5
            in the UI. Response is cached (e.g. Redis/file cache) under a versioned key for a few hours.
          </li>
        </ul>
        <p className="mb-2 text-sm font-medium text-gray-300">Sort order (primary → secondary, all descending)</p>
        <MathPanel>
          <M>1º&nbsp;&nbsp;<em>s</em> = strong_count</M>
          <M>2º&nbsp;&nbsp;<em>L</em> (liquidity)</M>
          <M>3º&nbsp;&nbsp;<em>V</em> (volume)</M>
          <M>4º&nbsp;&nbsp;watchlist count</M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">10. Quintile score (Price, Change, Volume, Liquidity, Watchers)</h3>
        <p className="mb-2 text-sm text-gray-400">
          For one metric, collect finite values per symbol in the pool, sort ascending by value v. For each symbol at
          zero-based rank index i (n = count):
        </p>
        <MathPanel>
          <M>Sort pool symbols by metric value <em>v</em> in <strong className="text-gray-200">ascending</strong> order (finite values only).</M>
          <M>
            Let <em>i</em> ∈ &#123;0, …, <em>n</em> − 1&#125; be the zero-based rank after sorting, <em>n</em> = pool size.
          </M>
          <M>
            <em>q</em> = <Frac num={<><em>i</em> + ½</>} den={<em>n</em>} />
          </M>
          <M>
            quintile score = min{" "}
            <span className="whitespace-nowrap">
              ( 5, max(1, ⌈5<em>q</em>⌉) )
            </span>
            &nbsp;&nbsp;∈ &#123;1, …, 5&#125;
          </M>
          <M className="text-sm text-gray-400">⌈·⌉ denotes ceiling to the next integer.</M>
        </MathPanel>
        <p className="mt-2 text-sm text-gray-500">Higher score = higher in the pool on that metric (ordinal quintile).</p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">11. Signal axis — analysis confidence → 1–5 (fallback: watchlist)</h3>
        <p className="mb-2 text-sm text-gray-400">
          When python_engine has cached auto-analysis in Redis (<code className="rounded bg-gray-800 px-1">summary:analysis:SYMBOL</code>),
          the numeric <code className="rounded bg-gray-800 px-1">confidence</code> field (0–100) maps to the radar &quot;Signal&quot; spoke and{" "}
          <code className="rounded bg-gray-800 px-1">scores.reputation</code>. Otherwise <em>W</em> = watchlist count uses the buckets below.
          Raw watchlist tier is also exposed as <code className="rounded bg-gray-800 px-1">scores.watchlist_reputation</code>.
        </p>
        <MathPanel>
          <M>
            Confidence <em>C</em> ∈ [0, 100] ⇒ <em>S</em> ∈ &#123;1,…,5&#125;: &nbsp;<em>C</em> ≥ 80 ⇒ 5; ≥ 60 ⇒ 4; ≥ 40 ⇒ 3; ≥ 20 ⇒ 2; else 1.
          </M>
          <M className="text-sm text-gray-400">If no cache: Signal score <em>S</em> from watchlist count <em>W</em>:</M>
          <M>
            <em>W</em> ≥ 200 &nbsp;⇒&nbsp; <em>S</em> = 5
          </M>
          <M>
            <em>W</em> ≥ 50 &nbsp;⇒&nbsp; <em>S</em> = 4
          </M>
          <M>
            <em>W</em> ≥ 10 &nbsp;⇒&nbsp; <em>S</em> = 3
          </M>
          <M>
            <em>W</em> ≥ 1 &nbsp;⇒&nbsp; <em>S</em> = 2
          </M>
          <M>
            <em>W</em> = 0 &nbsp;⇒&nbsp; <em>S</em> = 1
          </M>
          <M className="text-sm text-gray-400">
            (In code, test from the <strong className="text-gray-300">largest</strong> threshold downward so e.g.{" "}
            <em>W</em> = 250 maps to <em>S</em> = 5, not 4.)
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">12. Beginner overview — reputation copy (same W buckets)</h3>
        <p className="mb-2 text-sm text-gray-400">Tier name and human-readable label for overview API (W as above):</p>
        <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-[#141a26] to-[#0d1018] px-5 py-5 font-serif text-[15px] leading-relaxed text-gray-100 shadow-inner">
          <dl className="space-y-2 text-center">
            <div>
              <dt className="font-medium text-indigo-300">high</dt>
              <dd className="text-sm text-gray-400">Lots of people are following this symbol (<em>W</em> ≥ 200)</dd>
            </div>
            <div>
              <dt className="font-medium text-indigo-300">good</dt>
              <dd className="text-sm text-gray-400">Popular — many users have it on their watchlist (<em>W</em> ≥ 50)</dd>
            </div>
            <div>
              <dt className="font-medium text-indigo-300">growing</dt>
              <dd className="text-sm text-gray-400">Growing attention from our community (<em>W</em> ≥ 10)</dd>
            </div>
            <div>
              <dt className="font-medium text-indigo-300">small</dt>
              <dd className="text-sm text-gray-400">A smaller group is watching for now (<em>W</em> ≥ 1)</dd>
            </div>
            <div>
              <dt className="font-medium text-indigo-300">quiet</dt>
              <dd className="text-sm text-gray-400">Few watchlist saves yet — still under the radar (<em>W</em> = 0)</dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">13. Volume movers API — top gainers / losers</h3>
        <p className="mb-2 text-sm text-gray-400">
          Scan <code className="rounded bg-gray-800 px-1">instrument_snapshot</code> ordered by{" "}
          <code className="rounded bg-gray-800 px-1">volume</code> descending (up to a fetch cap). Let L = max(5, min(request
          limit, 100)).
        </p>
        <MathPanel>
          <M>
            Let <em>L</em> = max(5, min(request limit, 100)). Scan snapshots ordered by volume descending.
          </M>
          <M>
            <strong className="text-gray-200">Gainers:</strong> the first <em>L</em> rows with Δ<sub>%</sub> &gt; 0, in that
            scan order.
          </M>
          <M>
            <strong className="text-gray-200">Losers:</strong> the first <em>L</em> rows with Δ<sub>%</sub> &lt; 0, in that
            scan order.
          </M>
          <M className="text-sm text-gray-400">Scan may stop once both lists have length <em>L</em> when possible.</M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">14. Buy / Sell / Flat badge (beginner table)</h3>
        <MathPanel>
          <M>Badge from snapshot Δ<sub>%</sub>:</M>
          <M>
            Δ<sub>%</sub> &gt; 0 &nbsp;⇒&nbsp; Buy
          </M>
          <M>
            Δ<sub>%</sub> &lt; 0 &nbsp;⇒&nbsp; Sell
          </M>
          <M>
            Δ<sub>%</sub> = 0 &nbsp;⇒&nbsp; Flat
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">15. Heatmap cell color (Python sync helper)</h3>
        <p className="mb-2 text-sm text-gray-400">
          From <code className="rounded bg-gray-800 px-1">stock_compare.py</code> — hex colors by snapshot change %:
        </p>
        <MathPanel>
          <M>Heatmap cell hue from snapshot Δ<sub>%</sub> (example hex values):</M>
          <M>
            Δ<sub>%</sub> ≥ 2.5 &nbsp;⇒&nbsp; #27ae60
          </M>
          <M>
            0 &lt; Δ<sub>%</sub> &lt; 2.5 &nbsp;⇒&nbsp; #9be7c4
          </M>
          <M>
            Δ<sub>%</sub> ≤ −2.5 &nbsp;⇒&nbsp; #c0392b
          </M>
          <M>
            −2.5 &lt; Δ<sub>%</sub> &lt; 0 &nbsp;⇒&nbsp; #f5b7b1
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">16. Treemap / heatmap size helper</h3>
        <p className="mb-2 text-sm text-gray-400">
          Same module: <code className="rounded bg-gray-800 px-1">calc_size(market_cap)</code> uses log base 10 (rounded to 2
          decimals):
        </p>
        <MathPanel>
          <M>
            <em>s</em> = round<sub>2 decimals</sub>
            <span className="mx-1 whitespace-nowrap">
              ( log<sub>10</sub>( max(<em>M</em>, 1) ) )
            </span>
          </M>
          <M className="text-sm text-gray-400">
            where <em>M</em> is market capitalization; <em>s</em> drives relative tile size in treemap-style views.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">17. Company profile “profile score” (UI)</h3>
        <p className="mb-2 text-sm text-gray-400">
          On the stock company profile page, a simple completeness meter counts how many of a fixed set of profile fields are
          non-empty (fixed content in the client).
        </p>
        <MathPanel>
          <M>
            Let <em>k</em> be the count of non-empty fields among 13 fixed profile attributes (name, symbol, description,
            CEO, website, exchange, sector, industry, market cap, country, IPO date, headcount, image).
          </M>
          <M>
            Profile completeness = round
            <span className="whitespace-nowrap">
              {" "}
              ( 100 · <Frac num={<em>k</em>} den={<>13</>} /> )
            </span>
            &nbsp;∈ [0, 100].
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">18. Chart % change (profile page)</h3>
        <p className="mb-2 text-sm text-gray-400">
          The badge under the price on the profile chart uses the last two normalized candles in the loaded series:
        </p>
        <MathPanel>
          <M>
            Let <em>C</em>
            <sub>−1</sub> and <em>C</em>
            <sub>0</sub> be the closes of the last two chart bars.
          </M>
          <M>
            If <em>C</em>
            <sub>−1</sub> &gt; 0:&nbsp;&nbsp;Δ<sub>%</sub> = 100 · <Frac num={<><em>C</em>
              <sub>0</sub> − <em>C</em>
              <sub>−1</sub></>} den={<><em>C</em>
              <sub>−1</sub></>} />
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">19. Beginner market view — board averages</h3>
        <p className="mb-2 text-sm text-gray-400">
          When the header shows “avg price / liquidity / volume”, values are arithmetic means over the ranked list (top N
          rows), using finite snapshot fields only. The &quot;avg move&quot; % tile uses effective change per row (sparkline
          or snapshot) where applicable; Fear &amp; Greed uses snapshot % only (sections 7–8).
        </p>
        <MathPanel>
          <M>
            <em>P̄</em> = <Frac num={<>Σ <em>P</em>
              <sub>i</sub></>} den={<em>n</em>} />
            ,&nbsp;&nbsp;<em>L̄</em> = <Frac num={<>Σ <em>L</em>
              <sub>i</sub></>} den={<em>n</em>} />
            ,&nbsp;&nbsp;<em>V̄</em> = <Frac num={<>Σ <em>V</em>
              <sub>i</sub></>} den={<em>n</em>} />
          </M>
          <M>
            <em>Δ̄</em>
            <sub>eff</sub> = <Frac num={<>Σ <em>r</em>
              <sub>i</sub></>} den={<em>m</em>} />
            &nbsp;&nbsp;over rows with finite effective return <em>r</em>
            <sub>i</sub> (<em>m</em> ≤ <em>n</em>)
          </M>
          <M>
            Total liquidity on the board = Σ <em>L</em>
            <sub>i</sub> over the same <em>n</em> ranked rows.
          </M>
        </MathPanel>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">20. Redis Fear &amp; Greed (Python ranking sync)</h3>
        <p className="mb-2 text-sm text-gray-400">
          When the data engine runs <code className="rounded bg-gray-800 px-1">MarketSyncService.sync()</code>, each
          symbol&apos;s snapshot <code className="rounded bg-gray-800 px-1">change_pct</code> is mapped with the same clamped
          linear formula as the per-symbol UI strip:
        </p>
        <MathPanel>
          <M>
            <em>F</em> = round
            <span className="whitespace-nowrap">
              {" "}
              ( min(100, max(0, 50 + 3.25 · Δ<sub>%</sub>)) )
            </span>
          </M>
          <M className="text-sm text-gray-400">
            Synced per symbol to cache; label buckets match section 6 (evaluate bounds in order from the smallest{" "}
            <em>F</em> upward in implementation if needed).
          </M>
        </MathPanel>
      </section>

      <p className="border-t border-gray-800 pt-8 text-xs text-gray-600">
        Source alignment: Laravel <code className="rounded bg-gray-900 px-1">BuildSnapshot</code>,{" "}
        <code className="rounded bg-gray-900 px-1">SnapshotService</code>, Next beginner / profile UIs, Python{" "}
        <code className="rounded bg-gray-900 px-1">stock_compare.py</code>. Values depend on DB snapshots, caches, and job
        cadence.
      </p>
    </article>
  );
}

function IndicatorCalculationsContent() {
  return (
    <article id="docs-indicators" className="scroll-mt-24 space-y-10 text-gray-300">
      <header className="border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold text-white">Indicator calculations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
          Text reference for moving averages and common oscillators. DSA may implement variants (Wilder vs SMA smoothing,
          different periods); when we expose an indicator in the product, the implementation should match the documented
          definition for that surface.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Simple Moving Average (SMA)</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          The SMA at time <em>t</em> over <em>n</em> periods is the arithmetic mean of the last <em>n</em> prices (or other
          series values). Every point in the window weighs equally. SMA reacts more slowly than an EMA of the same length
          because older bars still contribute fully until they leave the window.
        </p>
        <MathPanel>
          <M>
            SMA<sub>
              <em>n</em>
            </sub>
            (<em>t</em>) = <Frac num={<>1</>} den={<em>n</em>} /> · (<em>P</em>
            <sub>
              <em>t</em>
            </sub>
            + <em>P</em>
            <sub>
              <em>t</em>−1
            </sub>
            + ⋯ + <em>P</em>
            <sub>
              <em>t</em>−<em>n</em>+1
            </sub>
            )
          </M>
        </MathPanel>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Exponential Moving Average (EMA)</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          The EMA applies a geometrically decaying weight to past observations: recent prices matter more. The smoothing factor{" "}
          <em>k = 2 / (n + 1)</em> is tied to length <em>n</em>. The first value is often seeded with SMA<sub>n</sub> or the
          first price, then updated recursively. Wilder&apos;s smoothing (used in RSI, ATR, ADX) uses{" "}
          <em>α = 1/n</em> instead of <em>2/(n+1)</em> — same recursive idea, different decay rate.
        </p>
        <MathPanel>
          <M>
            <em>k</em> = <Frac num={<>2</>} den={<><em>n</em> + 1</>} />
          </M>
          <M>
            EMA<sub>
              <em>t</em>
            </sub> = <em>k</em> · <em>P</em>
            <sub>
              <em>t</em>
            </sub> + (1 − <em>k</em>) · EMA<sub>
              <em>t</em>−1
            </sub>
          </M>
          <M className="text-sm text-gray-400">
            <strong className="text-gray-300">Wilder smoothing</strong> (RSI / ATR / ADX): replace <em>k</em> with{" "}
            <em>α</em> = 1/<em>n</em>, i.e. S<sub>
              <em>t</em>
            </sub> = S<sub>
              <em>t</em>−1
            </sub> + <Frac num={<>1</>} den={<em>n</em>} /> · (<em>x</em>
            <sub>
              <em>t</em>
            </sub> − S<sub>
              <em>t</em>−1
            </sub>
            ).
          </M>
        </MathPanel>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">RSI (Relative Strength Index)</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          RSI compares average magnitude of up-moves vs down-moves over <em>n</em> bars. Gains and losses are often smoothed
          with Wilder&apos;s method (not a plain SMA). Output is bounded 0–100; values above 70 or below 30 are commonly
          treated as overbought / oversold in literature — thresholds are not universal trading rules.
        </p>
        <MathPanel>
          <M>
            Δ<sub>
              <em>t</em>
            </sub> = <em>P</em>
            <sub>
              <em>t</em>
            </sub> − <em>P</em>
            <sub>
              <em>t</em>−1
            </sub>
          </M>
          <M>
            <em>g</em>
            <sub>
              <em>t</em>
            </sub> = max(Δ<sub>
              <em>t</em>
            </sub>, 0),&nbsp;&nbsp;<em>ℓ</em>
            <sub>
              <em>t</em>
            </sub> = max(−Δ<sub>
              <em>t</em>
            </sub>, 0)
          </M>
          <M>
            <em>G</em> = smoothed average of <em>g</em> over <em>n</em> bars,&nbsp;&nbsp;<em>L</em> = smoothed average of{" "}
            <em>ℓ</em> (Wilder or EMA-style smoothing)
          </M>
          <M>
            RS = <em>G</em> / <em>L</em>&nbsp;&nbsp;(<em>L</em> = 0 ⇒ RSI = 100)
          </M>
          <M>
            RSI = 100 − <Frac num={<>100</>} den={<>1 + RS</>} />
          </M>
        </MathPanel>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">MACD</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          MACD contrasts a fast EMA with a slow EMA of price. The signal line is an EMA of the MACD line itself; the histogram
          is their difference. Periods 12 / 26 / 9 are conventional defaults.
        </p>
        <MathPanel>
          <M>
            <em>M</em>
            <sub>t</sub> = EMA<sub>12</sub>(<em>P</em>)<sub>
              <em>t</em>
            </sub> − EMA<sub>26</sub>(<em>P</em>)<sub>
              <em>t</em>
            </sub>
          </M>
          <M>
            <em>S</em>
            <sub>t</sub> = EMA<sub>9</sub>(<em>M</em>)<sub>
              <em>t</em>
            </sub>
          </M>
          <M>
            <em>H</em>
            <sub>t</sub> = <em>M</em>
            <sub>t</sub> − <em>S</em>
            <sub>t</sub>
          </M>
          <M className="text-sm text-gray-400">
            <em>M</em> = MACD line, <em>S</em> = signal, <em>H</em> = histogram (conventional periods 12 / 26 / 9).
          </M>
        </MathPanel>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Bollinger Bands (reference)</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          A middle band is usually SMA<sub>n</sub> of price; upper and lower bands add and subtract a multiple (often 2) of
          the rolling standard deviation of price over the same <em>n</em>. Width expands with volatility.
        </p>
        <MathPanel>
          <M>
            mid<sub>
              <em>t</em>
            </sub> = SMA<sub>
              <em>n</em>
            </sub>(<em>P</em>)<sub>
              <em>t</em>
            </sub>
          </M>
          <M>
            σ<sub>
              <em>t</em>
            </sub> = standard deviation of <em>P</em> over the last <em>n</em> bars ending at <em>t</em>
          </M>
          <M>
            upper<sub>
              <em>t</em>
            </sub> = mid<sub>
              <em>t</em>
            </sub> + <em>k</em>σ<sub>
              <em>t</em>
            </sub>
            ,&nbsp;&nbsp;lower<sub>
              <em>t</em>
            </sub> = mid<sub>
              <em>t</em>
            </sub> − <em>k</em>σ<sub>
              <em>t</em>
            </sub>
          </M>
          <M className="text-sm text-gray-400">Common choice: <em>k</em> = 2.</M>
        </MathPanel>
      </section>

      <p className="border-t border-gray-800 pt-6 text-xs text-gray-600">
        For platform-specific liquidity and ranking math (not classic indicators), see the{" "}
        <Link href="/documents#ranking" className="text-indigo-400 hover:underline">
          Functional calculation
        </Link>{" "}
        tab.
      </p>
    </article>
  );
}

function PrivacyPoliciesContent() {
  return (
    <article id="docs-privacy" className="scroll-mt-24 space-y-10 text-gray-300">
      <header className="border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold text-white">Privacy &amp; policies</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
          How we handle information when you use DSA. This is a summary for transparency; your organization may publish a
          full legal version separately.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Data we process</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          We may process account identifiers (e.g. username or email), usage logs necessary to operate the service, and
          preferences you save (such as watchlists). Market and company data shown in the product come from integrated data
          sources and are not personal financial advice.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Cookies &amp; local storage</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          The application may use browser storage or cookies for session continuity, theme, and similar UX settings. You can
          clear site data in your browser; some features may require a new sign-in.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Third parties</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          Analytics, hosting, or data vendors may process technical metadata under their own terms. We choose providers to
          minimize unnecessary personal data sharing and to support security patches and availability.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Your choices</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          Where applicable, you can request access, correction, or deletion of personal data subject to legal retention
          requirements. Contact the operator listed on the site for privacy requests.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Terms of use (summary)</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          DSA is provided for informational and analytical purposes. Indicators, rankings, and documents do not constitute
          investment, tax, or legal advice. You are responsible for compliance with laws in your jurisdiction and for any
          trading decisions. We may change features, data feeds, or policies with notice where required.
        </p>
      </section>

      <p className="border-t border-gray-800 pt-6 text-xs text-gray-600">
        Last updated: March 2026. Replace or extend this section with counsel-approved policies before production launch if
        needed.
      </p>
    </article>
  );
}

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [mainView, setMainView] = useState<MainView>("library");
  const [docTab, setDocTab] = useState<DocTab>("ranking");

  const applyHash = useCallback(() => {
    const { main, tab } = parseHash();
    setMainView(main);
    setDocTab(tab);
    if (main === "docs") {
      const elId = tab === "ranking" ? "docs-ranking" : tab === "indicators" ? "docs-indicators" : "docs-privacy";
      requestAnimationFrame(() =>
        document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }, []);

  useEffect(() => {
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [applyHash]);

  const goLibrary = () => {
    window.history.pushState(null, "", "/documents#library");
    setMainView("library");
  };

  const goDocs = (tab: DocTab) => {
    const hash = tab === "indicators" ? "formula" : tab === "ranking" ? "ranking" : "privacy";
    window.history.pushState(null, "", `/documents#${hash}`);
    setMainView("docs");
    setDocTab(tab);
    const elId = tab === "ranking" ? "docs-ranking" : tab === "indicators" ? "docs-indicators" : "docs-privacy";
    requestAnimationFrame(() => document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const documents = [
    {
      id: 1,
      title: "Market Analysis Report - Q1 2024",
      description: "Comprehensive analysis of stock market trends and liquidity rankings for the first quarter.",
      category: "Report",
      type: "PDF",
      size: "2.4 MB",
      updatedAt: "2 hours ago",
      icon: <FileBarChart className="text-blue-400" size={28} />,
    },
    {
      id: 2,
      title: "Algorithmic Strategy Guide",
      description: "A detailed guide on how to implement technical indicators in automated trading strategies.",
      category: "Technical",
      type: "DOCX",
      size: "1.8 MB",
      updatedAt: "1 day ago",
      icon: <FileCode className="text-purple-400" size={28} />,
    },
    {
      id: 3,
      title: "Trading Terms & Conditions",
      description: "Official documentation regarding platform usage, data privacy, and trading regulations.",
      category: "Legal",
      type: "PDF",
      size: "850 KB",
      updatedAt: "Mar 12, 2024",
      icon: <BookOpen className="text-orange-400" size={28} />,
    },
    {
      id: 4,
      title: "Indicator Calculation Formula",
      description: "Mathematical breakdowns of RSI, MACD, moving averages, and custom platform metrics.",
      category: "Math",
      type: "Web",
      size: "On-site",
      updatedAt: "Live",
      icon: <Sigma className="text-green-400" size={28} />,
      href: "/documents#formula",
    },
    {
      id: 5,
      title: "Ranking & snapshot definitions",
      description: "How liquidity, quintiles, Fear & Greed, and board sort order are computed.",
      category: "Math",
      type: "Web",
      size: "On-site",
      updatedAt: "Live",
      icon: <Calculator className="text-cyan-400" size={28} />,
      href: "/documents#ranking",
    },
    {
      id: 6,
      title: "Privacy & policies",
      description: "Data handling, cookies, and terms of use summary.",
      category: "Legal",
      type: "Web",
      size: "On-site",
      updatedAt: "Live",
      icon: <Shield className="text-emerald-400" size={28} />,
      href: "/documents#privacy",
    },
  ];

  const filteredDocs = documents.filter((doc) => doc.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const tabBtn = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
      active
        ? "border-indigo-500 bg-indigo-600 text-white"
        : "border-transparent bg-[#161a21] text-gray-400 hover:border-gray-700 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-[#0b0e14] px-6 py-16 text-gray-200">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-gray-800 pb-4">
          <button type="button" onClick={goLibrary} className={tabBtn(mainView === "library")}>
            Documents library
          </button>
          <button type="button" onClick={() => goDocs("ranking")} className={tabBtn(mainView === "docs" && docTab === "ranking")}>
            <span className="inline-flex items-center gap-2">
              <Calculator size={16} aria-hidden />
              Functional calculation
            </span>
          </button>
          <button
            type="button"
            onClick={() => goDocs("indicators")}
            className={tabBtn(mainView === "docs" && docTab === "indicators")}
          >
            <span className="inline-flex items-center gap-2">
              <Sigma size={16} aria-hidden />
              Indicator calculations
            </span>
          </button>
          <button type="button" onClick={() => goDocs("privacy")} className={tabBtn(mainView === "docs" && docTab === "privacy")}>
            <span className="inline-flex items-center gap-2">
              <Shield size={16} aria-hidden />
              Privacy &amp; policies
            </span>
          </button>
        </div>

        {mainView === "docs" && (
          <div className="mb-10 max-w-4xl">
            {docTab === "ranking" && <RankingCalculationsContent />}
            {docTab === "indicators" && <IndicatorCalculationsContent />}
            {docTab === "privacy" && <PrivacyPoliciesContent />}
          </div>
        )}

        {mainView === "library" && (
          <>
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h1 className="mb-3 text-4xl font-bold text-white">Resource Center</h1>
                <p className="text-gray-400">
                  Access our latest market reports, technical guides, and legal documents. Open{" "}
                  <button
                    type="button"
                    onClick={() => goDocs("ranking")}
                    className="text-indigo-400 underline-offset-2 hover:underline"
                  >
                    Functional calculation
                  </button>
                  ,{" "}
                  <button
                    type="button"
                    onClick={() => goDocs("indicators")}
                    className="text-indigo-400 underline-offset-2 hover:underline"
                  >
                    Indicator calculations
                  </button>
                  , or{" "}
                  <button
                    type="button"
                    onClick={() => goDocs("privacy")}
                    className="text-indigo-400 underline-offset-2 hover:underline"
                  >
                    Privacy &amp; policies
                  </button>{" "}
                  for on-site definitions.
                </p>
              </div>

              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#161a21] py-3 pl-12 pr-4 text-white outline-none transition-all focus:ring-2 focus:ring-indigo-500/50"
                />
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div className="no-scrollbar mb-10 flex items-center gap-3 overflow-x-auto pb-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Filter size={16} /> All Files
              </button>
              {["Reports", "Technical", "Legal", "Guides"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="rounded-lg border border-gray-800 bg-[#161a21] px-4 py-2 text-sm font-medium text-gray-400 transition-all hover:border-gray-600 hover:text-white"
                >
                  {cat}
                </button>
              ))}
            </div>

            <div id="library" className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredDocs.map((doc) => {
                const CardInner = (
                  <>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 transition-all group-hover:border-indigo-500/20 group-hover:bg-indigo-500/10">
                        {doc.icon}
                      </div>
                      <div className="flex gap-2">
                        {"href" in doc && doc.href ? (
                          <span
                            className="rounded-lg p-2 text-indigo-400"
                            title="Opens on this site — use the card link"
                          >
                            <ExternalLink size={18} aria-hidden />
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                              title="Preview"
                            >
                              <ExternalLink size={18} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-indigo-400 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300"
                              title="Download"
                            >
                              <Download size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-indigo-400">
                      {doc.title}
                    </h3>
                    <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-gray-400">{doc.description}</p>

                    <div className="mt-auto flex items-center justify-between border-t border-gray-800/50 pt-4">
                      <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-indigo-500" />
                          {doc.type}
                        </span>
                        <span>{doc.size}</span>
                      </div>
                      <span className="text-[11px] font-medium italic text-gray-600">Updated {doc.updatedAt}</span>
                    </div>
                  </>
                );

                const wrapClass =
                  "group rounded-2xl border border-gray-800/50 bg-[#161a21] p-6 shadow-xl transition-all hover:border-indigo-500/40";

                return "href" in doc && doc.href ? (
                  <Link key={doc.id} href={doc.href} className={`${wrapClass} block`}>
                    {CardInner}
                  </Link>
                ) : (
                  <div key={doc.id} className={wrapClass}>
                    {CardInner}
                  </div>
                );
              })}
            </div>

            {filteredDocs.length === 0 && (
              <div className="rounded-3xl border border-dashed border-gray-800 bg-[#161a21] py-20 text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-700" />
                <h3 className="text-xl font-semibold text-white">No documents found</h3>
                <p className="mt-2 text-gray-500">Try adjusting your search or filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
