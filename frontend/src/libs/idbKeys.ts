export const IDB_KEYS = {
  INSTRUMENTS: "dsa_instruments_basic",
  PERIODS: (instrumentId: string) => `dsa_periods_${instrumentId}`,
  DAILY_CHART: (symbol: string) => `dsa_chart_daily_${symbol.toLowerCase()}`,
};
