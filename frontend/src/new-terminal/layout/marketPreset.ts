import type { CSSProperties } from "react";
import preset from "./presets/markets.json";

type PresetId = keyof typeof preset.items;
export type MarketPresetKey = PresetId extends `/::${infer Key}::0` ? Key : never;
type PresetStyle = CSSProperties & { [property: `--nt-market-${string}`]: string | number };

const gutter = 4;
const rows = Math.max(...Object.values(preset.items).map(item => item.y + item.h));
const rootStyle: PresetStyle = {
  "--nt-market-cols": preset.cols,
  "--nt-market-rows": rows,
  "--nt-market-row-px": `${preset.rowPx}px`,
  "--nt-market-gutter": `${gutter}px`,
};

/** Fixed geometry from the exported contract; no browser measurement or reflow. */
export const marketPresetRootProps = {
  "data-layout-cols": preset.cols,
  "data-layout-rows": rows,
  "data-layout-row-px": preset.rowPx,
  style: rootStyle,
};

export function marketPresetCardProps(key: MarketPresetKey) {
  const { x, y, w, h } = preset.items[`/::${key}::0` as PresetId];
  return {
    "data-layout-key": key,
    "data-layout-x": x,
    "data-layout-y": y,
    "data-layout-w": w,
    "data-layout-h": h,
    style: {
      "--nt-market-x": x,
      "--nt-market-y": y,
      "--nt-market-w": w,
      "--nt-market-h": h,
      gridColumn: `${x + 1} / span ${w}`,
      gridRow: `${y + 1} / span ${h}`,
      width: "calc(100% - var(--nt-market-gutter))",
      height: h * preset.rowPx - gutter,
    } satisfies PresetStyle,
  };
}
