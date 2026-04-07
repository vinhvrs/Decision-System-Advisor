import { dayToTime, type SubPaneLineSpec, type SubPaneSpec } from '../indicators/IndicatorLightChart';
import { pointsFrom } from '../indicators/indicatorLightModel';
import type { MacdPoint } from '../indicators/indicatorCalculations';

const MACD_SCALE = 'hybrid-macd';

/**
 * Prepends hybrid MACD (histogram + macd/signal lines on `MACD_SCALE`) before primary sub-pane lines.
 * Primary must not use its own histogram (strategy path); otherwise returns `primary` unchanged.
 */
export function mergeSubPaneWithHybridMacd(primary: SubPaneSpec | null, macd: MacdPoint[]): SubPaneSpec | null {
  if (primary && (primary.histogram?.length ?? 0) > 0) {
    return primary;
  }

  const hist = macd
    .filter((d) => d.histogram != null && Number.isFinite(d.histogram))
    .map((d) => ({
      time: dayToTime(d.day),
      value: d.histogram!,
      color: d.histogram! >= 0 ? 'rgba(99,102,241,0.75)' : 'rgba(244,114,182,0.75)',
    }));

  const macdLines: SubPaneLineSpec[] = [
    {
      color: '#38bdf8',
      lineWidth: 2,
      priceScaleId: MACD_SCALE,
      data: pointsFrom(macd, (r) => r.day, (r) => r.macd),
    },
    {
      color: '#f472b6',
      lineWidth: 2,
      priceScaleId: MACD_SCALE,
      data: pointsFrom(macd, (r) => r.day, (r) => r.signal),
    },
  ];

  const pLines = primary?.lines ?? [];
  const lines = [...macdLines, ...pLines];
  const anyLine = lines.some((l) => l.data.length > 0);
  if (!hist.length && !anyLine) return primary;

  return {
    histogram: hist.length ? hist : undefined,
    histogramPriceScaleId: hist.length ? MACD_SCALE : undefined,
    ...(primary?.attributeStack ? { attributeStack: primary.attributeStack } : {}),
    lines,
  };
}
