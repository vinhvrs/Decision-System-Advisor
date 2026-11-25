import assert from "node:assert/strict";
import test from "node:test";
import {
  GRID_COLS,
  clampRect,
  fitAtAnchor,
  fitResize,
  fits,
  isValidRect,
  layoutBottom,
  overlaps,
  placeWithoutOverlap,
  type GridRect,
// @ts-expect-error Node's source-test runner requires an explicit TypeScript extension.
} from "./gridGeometry.ts";

function assertNoOverlap(rects: readonly GridRect[]) {
  for (let i = 0; i < rects.length; i++) {
    assert.ok(isValidRect(rects[i]), `invalid rectangle ${JSON.stringify(rects[i])}`);
    for (let j = i + 1; j < rects.length; j++) {
      assert.equal(overlaps(rects[i], rects[j]), false,
        `overlap: ${JSON.stringify(rects[i])} and ${JSON.stringify(rects[j])}`);
    }
  }
}

test("touching edges are allowed; positive-area intersection is rejected", () => {
  const base = { x: 0, y: 0, w: 12, h: 8 };
  assert.equal(overlaps(base, { x: 12, y: 0, w: 8, h: 8 }), false);
  assert.equal(overlaps(base, { x: 0, y: 8, w: 12, h: 8 }), false);
  assert.equal(overlaps(base, { x: 11, y: 7, w: 8, h: 8 }), true);
  assert.equal(fits({ x: 47, y: 0, w: 2, h: 8 }, [base]), false);
});

test("malformed persisted rectangles normalize to bounded integer coordinates", () => {
  for (const raw of [null, {}, [], "bad", { x: NaN, y: Infinity, w: -8, h: "12" },
    { x: 99_999_999, y: -50, w: Infinity, h: 99_999_999 },
    { x: -12.2, y: 8.6, w: 8.5, h: 9.2 }]) {
    const rect = clampRect(raw);
    assert.ok(isValidRect(rect));
    assert.ok(rect.w >= 4 && rect.h >= 4);
  }
  assert.equal(isValidRect({ x: 0, y: 0, w: NaN, h: 4 }), false);
  assert.equal(isValidRect({ x: 0, y: 0.5, w: 4, h: 4 }), false);
  assert.equal(isValidRect({ x: 0, y: 9_999, w: 4, h: 4 }), false);
  assert.deepEqual(clampRect({ x: 47, y: 20, w: 12, h: 8 }), { x: 36, y: 20, w: 12, h: 8 });
});

test("restoring overlapping cards never returns an occupied position, even beyond 64 rows", () => {
  const others = [{ x: 8, y: 0, w: 12, h: 80 }, { x: 8, y: 80, w: 12, h: 80 }];
  const before = structuredClone(others);
  const restored = placeWithoutOverlap({ x: 8, y: 10, w: 12, h: 8 }, others);
  assert.deepEqual(restored, { x: 8, y: 160, w: 12, h: 8 });
  assert.deepEqual(others, before);
  assertNoOverlap([...others, restored]);
});

test("a lower card can fit a smaller middle gap without moving its neighbors", () => {
  const others = [
    { x: 0, y: 0, w: 16, h: 30 },
    { x: 16, y: 0, w: 16, h: 8 },
    { x: 32, y: 0, w: 16, h: 30 },
    { x: 16, y: 16, w: 16, h: 14 },
  ];
  const before = structuredClone(others);
  const lowerCard = { x: 0, y: 40, w: 24, h: 12 };
  const fitted = fitAtAnchor({ ...lowerCard, x: 16, y: 8 }, others);
  assert.deepEqual(fitted, { x: 16, y: 8, w: 16, h: 8 });
  assert.deepEqual(lowerCard, { x: 0, y: 40, w: 24, h: 12 });
  assert.deepEqual(others, before);
  assertNoOverlap([...others, fitted!]);
});

test("a wide card shrinks into a gap at the right edge without shifting its anchor", () => {
  const neighbor = { x: 0, y: 0, w: 44, h: 20 };
  assert.deepEqual(fitAtAnchor({ x: 44, y: 0, w: 16, h: 8 }, [neighbor]),
    { x: 44, y: 0, w: 4, h: 8 });
  assert.equal(fitAtAnchor({ x: 45, y: 0, w: 16, h: 8 }, [neighbor]), null);
});

test("an occupied anchor is rejected instead of swapping, jumping, or growing", () => {
  const neighbor = { x: 12, y: 12, w: 12, h: 12 };
  assert.equal(fitAtAnchor({ x: 13, y: 13, w: 8, h: 8 }, [neighbor]), null);
  assert.equal(fitAtAnchor({ x: -1, y: 0, w: 8, h: 8 }, []), null);
  const empty = { x: 0, y: 32, w: 8, h: 8 };
  assert.deepEqual(fitAtAnchor(empty, [neighbor]), empty);
  assert.deepEqual(fitResize(empty, empty, [neighbor]), empty);
});

test("resize keeps its original anchor and stops at neighboring boundaries", () => {
  const origin = { x: 8, y: 8, w: 8, h: 8 };
  const others = [{ x: 20, y: 8, w: 8, h: 24 }, { x: 8, y: 20, w: 12, h: 12 }];
  const requested = { x: 0, y: 0, w: 20, h: 20 };
  const resized = fitResize(origin, requested, others);
  assert.deepEqual(resized, { x: 8, y: 8, w: 12, h: 12 });
  assert.deepEqual(origin, { x: 8, y: 8, w: 8, h: 8 });
  assert.equal(fits(resized!, others), true);
});

test("bounded restore recovers remaining free space and fails closed when full", () => {
  const left = { x: 0, y: 0, w: 24, h: 10_000 };
  const restored = placeWithoutOverlap({ x: 0, y: 9_900, w: 8, h: 8 }, [left]);
  assert.deepEqual(restored, { x: 24, y: 0, w: 8, h: 8 });
  assert.throws(() => placeWithoutOverlap({ x: 0, y: 0, w: 4, h: 4 },
    [{ x: 0, y: 0, w: GRID_COLS, h: 10_000 }]), RangeError);
  assert.throws(() => placeWithoutOverlap({ x: 0, y: 0, w: 4, h: 4 },
    [{ x: NaN, y: 0, w: 4, h: 4 }]), TypeError);
});

test("geometry scales to a different column count without leaving bounds", () => {
  const rect = clampRect({ x: 40, y: 4, w: 28, h: 8 }, 4, 4, 12);
  assert.deepEqual(rect, { x: 0, y: 4, w: 12, h: 8 });
  const placed = placeWithoutOverlap(rect, [{ x: 0, y: 0, w: 12, h: 12 }], 12);
  assert.deepEqual(placed, { x: 0, y: 12, w: 12, h: 8 });
  assert.equal(layoutBottom([rect, placed]), 20);
  assert.equal(layoutBottom([]), 0);
});

test("randomized restore, move, resize, and reload maintain pairwise separation", () => {
  let seed = 0x5EED;
  function random(limit: number) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  }
  const rects: GridRect[] = [];
  for (let index = 0; index < 60; index++) {
    rects.push(placeWithoutOverlap(clampRect({ x: random(48), y: random(90),
      w: 4 + random(16), h: 4 + random(16) }), rects));
  }
  assertNoOverlap(rects);
  for (let operation = 0; operation < 400; operation++) {
    const index = random(rects.length);
    const others = rects.filter((_, i) => i !== index);
    const unchanged = structuredClone(others);
    const previous = { ...rects[index] };
    const result = operation % 2
      ? fitAtAnchor({ ...previous, x: random(48), y: random(160) }, others)
      : fitResize(previous, { ...previous, w: 4 + random(24), h: 4 + random(24) }, others);
    if (result) rects[index] = result;
    assert.deepEqual(others, unchanged);
    assertNoOverlap(rects);
  }
  const reloaded: GridRect[] = [];
  for (const rect of JSON.parse(JSON.stringify(rects))) reloaded.push(placeWithoutOverlap(clampRect(rect), reloaded));
  assert.deepEqual(reloaded, rects);
});
