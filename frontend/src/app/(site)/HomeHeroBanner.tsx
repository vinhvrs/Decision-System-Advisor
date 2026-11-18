/** Compact research header for the primary market workspace. */
export default function HomeHeroBanner() {
  return (
    <section
      className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6"
      aria-labelledby="home-hero-heading"
    >
      <div className="dsa-page flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
        <div className="min-w-0">
          <p className="dsa-section-label">Research workspace</p>
          <h1
            id="home-hero-heading"
            className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl"
          >
            Market overview
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--dsa-text-secondary)] tablet:text-[13px]">
            Ranked market context, multi-factor signals, price action, liquidity, and watchlist interest.
            Incomplete inputs remain Not Rated instead of being converted into directional signals.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
          <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1">
            Source-aware
          </span>
          <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1">
            Eligibility-gated
          </span>
          <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1">
            Research only
          </span>
        </div>
      </div>
    </section>
  );
}
