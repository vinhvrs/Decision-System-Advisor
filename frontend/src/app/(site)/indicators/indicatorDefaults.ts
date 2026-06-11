function envNumber(key: string, fallback: number, min = Number.NEGATIVE_INFINITY): number {
  const raw = process.env[key];
  const n = raw === undefined || raw === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

function envInt(key: string, fallback: number, min = 1): number {
  return Math.round(envNumber(key, fallback, min));
}

export const INDICATOR_DEFAULTS = {
  volumeScale: envNumber('NEXT_PUBLIC_INDICATOR_VOLUME_SCALE', 1, 0.1),
  liquiditySmoothingPeriod: envInt('NEXT_PUBLIC_INDICATOR_LS_SMOOTHING_PERIOD', 8),
  volatilityWindow: envInt('NEXT_PUBLIC_INDICATOR_VOLATILITY_WINDOW', 14),
  adxPeriod: envInt('NEXT_PUBLIC_INDICATOR_ADX_PERIOD', 14),
  mfiPeriod: envInt('NEXT_PUBLIC_INDICATOR_MFI_PERIOD', 14),
  smaPeriod: envInt('NEXT_PUBLIC_INDICATOR_SMA_PERIOD', 20),
  emaPeriod: envInt('NEXT_PUBLIC_INDICATOR_EMA_PERIOD', 20),
  rsiPeriod: envInt('NEXT_PUBLIC_INDICATOR_RSI_PERIOD', 14),
  macdFastPeriod: envInt('NEXT_PUBLIC_INDICATOR_MACD_FAST_PERIOD', 12),
  macdSlowPeriod: envInt('NEXT_PUBLIC_INDICATOR_MACD_SLOW_PERIOD', 26),
  macdSignalPeriod: envInt('NEXT_PUBLIC_INDICATOR_MACD_SIGNAL_PERIOD', 9),
  bollingerPeriod: envInt('NEXT_PUBLIC_INDICATOR_BOLLINGER_PERIOD', 20),
  bollingerStdDevMultiplier: envNumber('NEXT_PUBLIC_INDICATOR_BOLLINGER_STD_DEV_MULTIPLIER', 2, 0.1),
  stochasticKPeriod: envInt('NEXT_PUBLIC_INDICATOR_STOCHASTIC_K_PERIOD', 14),
  stochasticDPeriod: envInt('NEXT_PUBLIC_INDICATOR_STOCHASTIC_D_PERIOD', 3),
};
