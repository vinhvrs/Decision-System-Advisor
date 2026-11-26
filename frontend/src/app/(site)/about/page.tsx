import Link from "next/link";

export default function AboutPage() {
  return <div className="nt-info-page">
    <header className="nt-info-intro">
      <span className="nt-label nt-info">DSA / Research workspace</span>
      <h1>About Decision System Advisor</h1>
      <p>A research workspace for comparing market context, company data, economic events, and source-linked news in one place.</p>
    </header>
    <div className="nt-info-grid">
      <section className="nt-info-panel">
        <span className="nt-label nt-info">01 / Explore</span>
        <h2>Start with the market</h2>
        <p>Review participation, sector breadth, active symbols, and cross-asset context before opening a company or instrument.</p>
        <Link href="/">Open market overview ↗</Link>
      </section>
      <section className="nt-info-panel">
        <span className="nt-label nt-info">02 / Investigate</span>
        <h2>Follow the evidence</h2>
        <p>Use the screener, company research, and indicators to compare observations. Values retain their source and coverage context.</p>
        <Link href="/screener">Open screener ↗</Link>
      </section>
      <section className="nt-info-panel">
        <span className="nt-label nt-info">03 / Stay current</span>
        <h2>Connect events and news</h2>
        <p>See scheduled economic releases alongside the newsroom, then open the original source for the full article.</p>
        <Link href="/events">Open events ↗</Link>
      </section>
    </div>
    <p className="nt-info-footnote">Research and education only. Check data timestamps, coverage, and original sources before making a decision.</p>
  </div>;
}
