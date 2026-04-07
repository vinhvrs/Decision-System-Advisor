import type {
  CustomData,
  CustomSeriesWhitespaceData,
  ICustomSeriesPaneRenderer,
  ICustomSeriesPaneView,
  PaneRendererCustomData,
  UTCTimestamp,
} from 'lightweight-charts';
import { customSeriesDefaultOptions } from 'lightweight-charts';

export type AttributeStackBarData = CustomData<UTCTimestamp> & {
  time: UTCTimestamp;
  /** Six 0–100 scores; each column is normalized to a total height of 100 for display */
  values: readonly [number, number, number, number, number, number];
};

function normalizeSix(v: readonly [number, number, number, number, number, number]): number[] {
  const clamped = v.map((x) => Math.max(0, Math.min(100, Number(x) || 0)));
  const s = clamped.reduce((a, b) => a + b, 0);
  if (s <= 0) {
    const u = 100 / 6;
    return [u, u, u, u, u, u];
  }
  return clamped.map((x) => (100 * x) / s);
}

/** Match built-in histogram column width (bitmap space). */
function columnLeftRight(
  barSpacing: number,
  horizontalPixelRatio: number,
  centerXMedia: number
): { left: number; right: number } {
  const spacing =
    Math.ceil(barSpacing * horizontalPixelRatio) <= 1 ? 0 : Math.max(1, Math.floor(horizontalPixelRatio));
  const columnWidth = Math.round(barSpacing * horizontalPixelRatio) - spacing;
  const x = Math.round(centerXMedia * horizontalPixelRatio);
  if (columnWidth % 2) {
    const halfWidth = (columnWidth - 1) / 2;
    return { left: x - halfWidth, right: x + halfWidth };
  }
  const halfWidth = columnWidth / 2;
  return { left: x - halfWidth, right: x + halfWidth - 1 };
}

/**
 * Custom pane view: one vertical column per time step, split into six colored segments (normalized to 100).
 */
export function createAttributeStackPaneView(
  colors: readonly [string, string, string, string, string, string]
): ICustomSeriesPaneView<UTCTimestamp, AttributeStackBarData> {
  let paneData: PaneRendererCustomData<UTCTimestamp, AttributeStackBarData> | null = null;

  const renderer: ICustomSeriesPaneRenderer = {
    draw(target, priceConverter) {
      if (!paneData?.visibleRange) return;
      const { bars, barSpacing, visibleRange } = paneData;
      const { from, to } = visibleRange;

      target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }) => {
        for (let i = from; i < to; i++) {
          const bar = bars[i];
          const d = bar.originalData;
          if (!('values' in d) || d.values == null) continue;

          const segs = normalizeSix(d.values);
          const { left, right } = columnLeftRight(barSpacing, horizontalPixelRatio, bar.x);

          let cum = 0;
          for (let s = 0; s < 6; s++) {
            const p0 = cum;
            cum += segs[s];
            const p1 = cum;
            const y0m = priceConverter(p0);
            const y1m = priceConverter(p1);
            if (y0m == null || y1m == null) continue;
            const top = Math.round(Math.min(y0m, y1m) * verticalPixelRatio);
            const bottom = Math.round(Math.max(y0m, y1m) * verticalPixelRatio);
            if (bottom <= top) continue;
            ctx.fillStyle = colors[s] ?? '#888';
            ctx.fillRect(left, top, right - left + 1, bottom - top);
          }
        }
      });
    },
  };

  return {
    renderer: () => renderer,
    update(data) {
      paneData = data;
    },
    priceValueBuilder(plotRow: AttributeStackBarData | CustomSeriesWhitespaceData<UTCTimestamp>) {
      if (!('values' in plotRow) || plotRow.values == null) return [0, 100, 0];
      return [0, 100, 100];
    },
    isWhitespace(
      data: AttributeStackBarData | CustomSeriesWhitespaceData<UTCTimestamp>
    ): data is CustomSeriesWhitespaceData<UTCTimestamp> {
      return !('values' in data) || data.values == null;
    },
    defaultOptions() {
      return {
        ...customSeriesDefaultOptions,
        lastValueVisible: false,
        priceLineVisible: false,
        color: colors[0] ?? '#888',
      };
    },
  };
}
