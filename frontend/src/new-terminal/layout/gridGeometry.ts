/** Integer cell geometry shared by restore, drag, and resize. No DOM mutations. */
export const GRID_COLS = 48;
export const ROW_PX = 16;
export const MIN_W = 4;
export const MIN_H = 4;
const MAX_ROWS = 10_000;

export type GridRect = { x: number; y: number; w: number; h: number };

function columnCount(cols: number) {
  return Number.isSafeInteger(cols) && cols > 0 ? cols : GRID_COLS;
}

function minimum(value: number, fallback: number, limit: number) {
  return Math.min(limit, Math.max(1, Number.isFinite(value) ? Math.ceil(value) : fallback));
}

function finiteInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

export function overlaps(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isValidRect(rect: unknown, cols = GRID_COLS): rect is GridRect {
  if (!rect || typeof rect !== "object" || !Number.isSafeInteger(cols) || cols < 1) return false;
  const value = rect as GridRect;
  return [value.x, value.y, value.w, value.h].every(Number.isSafeInteger)
    && value.x >= 0 && value.y >= 0 && value.w >= 1 && value.h >= 1
    && value.x + value.w <= cols && value.y + value.h <= MAX_ROWS;
}

export function fits(rect: GridRect, others: readonly GridRect[], cols = GRID_COLS): boolean {
  return isValidRect(rect, cols)
    && others.every(other => isValidRect(other, cols) && !overlaps(rect, other));
}

/** Normalize untrusted saved data before testing collisions. */
export function clampRect(raw: unknown, minW = MIN_W, minH = MIN_H, cols = GRID_COLS): GridRect {
  const columns = columnCount(cols);
  const widthFloor = minimum(minW, MIN_W, columns);
  const heightFloor = minimum(minH, MIN_H, MAX_ROWS);
  const value = raw && typeof raw === "object" ? raw as Partial<GridRect> : {};
  const w = Math.min(columns, Math.max(widthFloor, finiteInteger(value.w, widthFloor)));
  const h = Math.min(MAX_ROWS, Math.max(heightFloor, finiteInteger(value.h, heightFloor)));
  return {
    x: Math.max(0, Math.min(columns - w, finiteInteger(value.x, 0))),
    y: Math.max(0, Math.min(MAX_ROWS - h, finiteInteger(value.y, 0))),
    w,
    h,
  };
}

/**
 * Initial/restored layout only. Keep the intended column and advance to the
 * bottom of blockers. Never use this to resolve a user's drag or resize.
 * If a bounded canvas is completely full, fail instead of returning overlap.
 */
export function placeWithoutOverlap(preferred: GridRect, others: readonly GridRect[], cols = GRID_COLS): GridRect {
  const columns = columnCount(cols);
  if (others.some(other => !isValidRect(other, columns))) throw new TypeError("Invalid grid obstacle");
  const initial = clampRect(preferred, 1, 1, columns);
  let candidate = { ...initial };

  for (let attempt = 0; attempt <= others.length; attempt++) {
    if (candidate.y + candidate.h > MAX_ROWS) break;
    const blockers = others.filter(other => overlaps(candidate, other));
    if (!blockers.length) return candidate;
    candidate = { ...candidate, y: Math.max(...blockers.map(other => other.y + other.h)) };
  }

  // A saved y can be near the limit while space remains higher up. At least
  // one feasible placement touches the top/left edge or an obstacle's edge.
  const rows = [...new Set([0, ...others.map(other => other.y + other.h)])]
    .filter(y => y + initial.h <= MAX_ROWS).sort((a, b) => a - b);
  const columnsToTry = [...new Set([initial.x, 0, ...others.map(other => other.x + other.w)])]
    .filter(x => x + initial.w <= columns);
  for (const y of rows) {
    for (const x of columnsToTry) {
      const fallback = { ...initial, x, y };
      if (fits(fallback, others, columns)) return fallback;
    }
  }
  throw new RangeError("No free space remains in the grid");
}

/**
 * Shrink inside the gap at exactly the requested top-left cell. A blocked
 * anchor is rejected; this function never swaps, moves neighbors, or searches
 * for a different position. It also never exceeds the requested dimensions.
 */
export function fitAtAnchor(
  candidate: GridRect,
  others: readonly GridRect[],
  minW = MIN_W,
  minH = MIN_H,
  cols = GRID_COLS,
): GridRect | null {
  const columns = columnCount(cols);
  const widthFloor = minimum(minW, MIN_W, columns);
  const heightFloor = minimum(minH, MIN_H, MAX_ROWS);
  if (!Number.isSafeInteger(candidate.x) || !Number.isSafeInteger(candidate.y)
    || candidate.x < 0 || candidate.y < 0
    || !Number.isFinite(candidate.w) || !Number.isFinite(candidate.h)
    || others.some(other => !isValidRect(other, columns))) return null;

  const maxWidth = Math.min(Math.floor(candidate.w), columns - candidate.x);
  const maxHeight = Math.min(Math.floor(candidate.h), MAX_ROWS - candidate.y);
  if (maxWidth < widthFloor || maxHeight < heightFloor) return null;
  let best: GridRect | null = null;

  for (let w = maxWidth; w >= widthFloor; w--) {
    let h = maxHeight;
    for (const other of others) {
      if (candidate.x >= other.x + other.w || candidate.x + w <= other.x
        || other.y + other.h <= candidate.y) continue;
      h = Math.min(h, Math.max(0, other.y - candidate.y));
      if (h < heightFloor) break;
    }
    if (h >= heightFloor && (!best || w * h > best.w * best.h)) {
      best = { x: candidate.x, y: candidate.y, w, h };
    }
  }
  return best;
}

/** Resize at the original anchor, constrained by the requested dimensions. */
export function fitResize(
  origin: GridRect,
  requested: GridRect,
  others: readonly GridRect[],
  minW = MIN_W,
  minH = MIN_H,
  cols = GRID_COLS,
): GridRect | null {
  return fitAtAnchor({ x: origin.x, y: origin.y, w: requested.w, h: requested.h }, others, minW, minH, cols);
}

export function layoutBottom(rects: readonly GridRect[]): number {
  return rects.reduce((bottom, rect) => Number.isFinite(rect.y) && Number.isFinite(rect.h)
    ? Math.max(bottom, rect.y + rect.h) : bottom, 0);
}
