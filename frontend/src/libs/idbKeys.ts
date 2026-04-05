export const IDB_KEYS = {
  INSTRUMENTS: "dsa_instruments_basic",
  /** Chart instrument cache when `DEV_MODE=dev` — avoids mixing with full prod list. */
  INSTRUMENTS_DEMO: "dsa_instruments_basic_demo",
  PERIODS: (instrumentId: string) => `dsa_periods_${instrumentId}`,
  DAILY_CHART: (symbol: string) => `dsa_chart_daily_${symbol.toLowerCase()}`,
};
