"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dsa.site-layout.v3";
const GRID_COLS = 24;
const ROW_PX = 24;
const MIN_W = 2;
const MIN_H = 2;

const CARD_SELECTOR = [
  ".nt-main [data-layout-key]",
  ".nt-main .nt-panel",
  ".nt-main .nt-flat-surface",
  ".nt-main .nt-context-strip",
  ".nt-main .nt-toolbar",
  ".nt-main .nt-news-article",
].join(",");

type GridItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type RouteLayout = {
  pathname: string;
  updatedAt: string;
  cols: number;
  rowPx: number;
  items: Record<string, GridItem>;
};

type LayoutStore = {
  version: 3;
  routes: Record<string, RouteLayout>;
};

type EditorAction = "toggle" | "enable" | "disable" | "export" | "reset";

function clean(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
}

function labelFor(element: HTMLElement) {
  const explicit = element.dataset.layoutKey;
  if (explicit) return explicit;
  const heading = element.querySelector<HTMLElement>(
    ":scope > .nt-panel-title strong, :scope > .nt-subsection-title strong, :scope > h1, :scope > h2, :scope > header h2"
  );
  return heading?.textContent?.trim() || element.getAttribute("aria-label") || element.className || element.tagName;
}

function readStore(): LayoutStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (parsed?.version === 3 && parsed.routes && typeof parsed.routes === "object") return parsed;
  } catch {}
  return { version: 3, routes: {} };
}

function writeStore(store: LayoutStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function collectCards(pathname: string) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR))
    .filter(el => el.closest(".nt-main"))
    .filter(el => !el.closest(".nt-utility-drawer"));

  const unique = all.filter((el, i) => all.indexOf(el) === i);
  const cards = unique.filter(el => !unique.some(other => other !== el && other.contains(el)));

  const counts = new Map<string, number>();
  for (const element of cards) {
    const label = labelFor(element);
    const base = clean(element.dataset.layoutKey || label || element.tagName) || "card";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const id = `${pathname}::${base}::${count}`;

    element.dataset.dsaLayoutId = id;
    element.dataset.dsaLayoutLabel = label;
    element.classList.add("dsa-layout-card");
    element.draggable = false;

    let handle =
      element.querySelector<HTMLElement>(":scope > .nt-panel-title") ??
      element.querySelector<HTMLElement>(":scope > .nt-subsection-title") ??
      element.querySelector<HTMLElement>(":scope > header") ??
      element.querySelector<HTMLElement>(":scope > .nt-news-article-body > .nt-news-kicker");

    if (!handle) {
      let synthetic = element.querySelector<HTMLElement>(":scope > .dsa-layout-top-handle");
      if (!synthetic) {
        synthetic = document.createElement("div");
        synthetic.className = "dsa-layout-top-handle";
        synthetic.textContent = label;
        element.prepend(synthetic);
      }
      handle = synthetic;
    }

    handle.classList.add("dsa-layout-drag-handle");
    handle.dataset.dsaDragHandle = "true";
    handle.dataset.dsaLayoutOwner = id;
    handle.setAttribute("title", `Drag ${label}`);

    if (!handle.querySelector(":scope > .dsa-layout-grip")) {
      const grip = document.createElement("span");
      grip.className = "dsa-layout-grip";
      grip.textContent = "⋮⋮";
      grip.setAttribute("aria-hidden", "true");
      handle.appendChild(grip);
    }

    if (!element.querySelector(":scope > .dsa-grid-resize-handle")) {
      const resize = document.createElement("div");
      resize.className = "dsa-grid-resize-handle";
      resize.dataset.dsaResizeHandle = "true";
      resize.setAttribute("title", `Resize ${label}`);
      element.appendChild(resize);
    }
  }
  return cards;
}

function ensureCanvas(main: HTMLElement) {
  let canvas = main.querySelector<HTMLElement>(":scope > .dsa-grid-canvas");
  if (!canvas) {
    canvas = document.createElement("div");
    canvas.className = "dsa-grid-canvas";
    main.appendChild(canvas);
  }
  return canvas;
}

function cellWidth(canvas: HTMLElement) {
  return Math.max(canvas.clientWidth / GRID_COLS, 1);
}

function rectToGrid(rect: DOMRect, canvasRect: DOMRect) {
  const cw = Math.max(canvasRect.width / GRID_COLS, 1);
  return {
    x: Math.max(0, Math.min(GRID_COLS - MIN_W, Math.round((rect.left - canvasRect.left) / cw))),
    y: Math.max(0, Math.round((rect.top - canvasRect.top) / ROW_PX)),
    w: Math.max(MIN_W, Math.min(GRID_COLS, Math.round(rect.width / cw))),
    h: Math.max(MIN_H, Math.round(rect.height / ROW_PX)),
  };
}

function overlaps(a: GridItem, b: GridItem) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function applyItem(card: HTMLElement, item: GridItem, canvas: HTMLElement) {
  const cw = cellWidth(canvas);
  card.dataset.dsaGridX = String(item.x);
  card.dataset.dsaGridY = String(item.y);
  card.dataset.dsaGridW = String(item.w);
  card.dataset.dsaGridH = String(item.h);
  card.style.position = "absolute";
  card.style.left = `${item.x * cw}px`;
  card.style.top = `${item.y * ROW_PX}px`;
  card.style.width = `${item.w * cw}px`;
  card.style.height = `${item.h * ROW_PX}px`;
  card.style.maxWidth = "none";
  card.style.minWidth = "0";
  card.style.margin = "0";
  card.style.boxSizing = "border-box";
}

function itemFromCard(card: HTMLElement): GridItem {
  return {
    id: card.dataset.dsaLayoutId || "",
    label: card.dataset.dsaLayoutLabel || labelFor(card),
    x: Number(card.dataset.dsaGridX || 0),
    y: Number(card.dataset.dsaGridY || 0),
    w: Number(card.dataset.dsaGridW || MIN_W),
    h: Number(card.dataset.dsaGridH || MIN_H),
  };
}

function nearestValid(candidate: GridItem, others: GridItem[]) {
  const clamped = {
    ...candidate,
    x: Math.max(0, Math.min(GRID_COLS - candidate.w, candidate.x)),
    y: Math.max(0, candidate.y),
  };
  if (!others.some(item => overlaps(clamped, item))) return clamped;

  for (let radius = 1; radius <= GRID_COLS + 40; radius++) {
    const tries: GridItem[] = [
      { ...clamped, y: Math.max(0, clamped.y - radius) },
      { ...clamped, x: Math.max(0, clamped.x - radius) },
      { ...clamped, x: Math.min(GRID_COLS - clamped.w, clamped.x + radius) },
      { ...clamped, y: clamped.y + radius },
    ];
    const valid = tries.find(item => !others.some(other => overlaps(item, other)));
    if (valid) return valid;
  }
  return clamped;
}

function fitIntoFreeSpace(candidate: GridItem, others: GridItem[]) {
  let best = nearestValid(candidate, others);
  for (let dw = 0; dw <= 4; dw++) {
    for (let dh = 0; dh <= 4; dh++) {
      const grown = {
        ...best,
        w: Math.min(GRID_COLS - best.x, Math.max(MIN_W, candidate.w + dw)),
        h: Math.max(MIN_H, candidate.h + dh),
      };
      if (!others.some(item => overlaps(grown, item)) && grown.w * grown.h > best.w * best.h) best = grown;
    }
  }

  if (!others.some(item => overlaps(best, item))) return best;

  for (let w = candidate.w; w >= MIN_W; w--) {
    for (let h = candidate.h; h >= MIN_H; h--) {
      const shrunk = { ...candidate, w, h, x: Math.min(candidate.x, GRID_COLS - w) };
      if (!others.some(item => overlaps(shrunk, item))) return shrunk;
    }
  }
  return nearestValid(candidate, others);
}

function layoutBottom(items: GridItem[]) {
  return Math.max(1, ...items.map(item => item.y + item.h));
}

export default function SiteLayoutEditor() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const drag = useRef<null | {
    mode: "drag" | "resize";
    card: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    origin: GridItem;
    lastValid: GridItem;
  }>(null);

  const buildGrid = useCallback(() => {
    const main = document.querySelector<HTMLElement>(".nt-main");
    if (!main) return;
    const cards = collectCards(pathname);
    const saved = readStore().routes[pathname];
    if (!saved && !active) return;

    const canvas = ensureCanvas(main);
    canvas.classList.toggle("dsa-grid-editing", active);
    const canvasRect = canvas.getBoundingClientRect();
    const initial = new Map<string, GridItem>();

    for (const card of cards) {
      const id = card.dataset.dsaLayoutId || "";
      const rect = card.getBoundingClientRect();
      initial.set(id, { id, label: card.dataset.dsaLayoutLabel || labelFor(card), ...rectToGrid(rect, canvasRect) });
    }

    for (const card of cards) {
      if (card.parentElement !== canvas) canvas.appendChild(card);
    }

    const placed: GridItem[] = [];
    for (const card of cards) {
      const id = card.dataset.dsaLayoutId || "";
      const seed = saved?.items[id] || initial.get(id)!;
      const item = nearestValid(seed, placed);
      placed.push(item);
      applyItem(card, item, canvas);
    }

    canvas.style.height = `${layoutBottom(placed) * ROW_PX}px`;
  }, [active, pathname]);

  const persist = useCallback(() => {
    const main = document.querySelector<HTMLElement>(".nt-main");
    const canvas = main?.querySelector<HTMLElement>(":scope > .dsa-grid-canvas");
    if (!canvas) return;
    const cards = Array.from(canvas.querySelectorAll<HTMLElement>(":scope > .dsa-layout-card"));
    const items = Object.fromEntries(cards.map(card => {
      const item = itemFromCard(card);
      return [item.id, item];
    }));
    const store = readStore();
    store.routes[pathname] = {
      pathname,
      updatedAt: new Date().toISOString(),
      cols: GRID_COLS,
      rowPx: ROW_PX,
      items,
    };
    writeStore(store);
  }, [pathname]);

  const reset = useCallback(() => {
    const store = readStore();
    delete store.routes[pathname];
    writeStore(store);
    location.reload();
  }, [pathname]);

  const exportContract = useCallback(() => {
    persist();
    const store = readStore();
    const blob = new Blob([JSON.stringify(store.routes[pathname] ?? {}, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dsa-grid-${clean(pathname || "root")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [pathname, persist]);

  useEffect(() => {
    buildGrid();
    const timer = window.setTimeout(buildGrid, 300);
    return () => window.clearTimeout(timer);
  }, [buildGrid]);

  useEffect(() => {
    document.body.classList.toggle("dsa-layout-editing", active);
    if (!active) return;

    const main = document.querySelector<HTMLElement>(".nt-main");
    const canvas = main?.querySelector<HTMLElement>(":scope > .dsa-grid-canvas");
    if (!canvas) return;

    function allItems(except?: HTMLElement) {
      return Array.from(canvas!.querySelectorAll<HTMLElement>(":scope > .dsa-layout-card"))
        .filter(card => card !== except)
        .map(itemFromCard);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const resize = target?.closest<HTMLElement>("[data-dsa-resize-handle='true']");
      const handle = target?.closest<HTMLElement>("[data-dsa-drag-handle='true']");
      const card = (resize || handle)?.closest<HTMLElement>(".dsa-layout-card");
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();
      const origin = itemFromCard(card);
      drag.current = {
        mode: resize ? "resize" : "drag",
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin,
        lastValid: origin,
      };
      card.classList.add("dsa-layout-dragging");
      try { (resize || handle)?.setPointerCapture(event.pointerId); } catch {}
    }

    function onPointerMove(event: PointerEvent) {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      event.preventDefault();

      const cw = cellWidth(canvas!);
      const dx = Math.round((event.clientX - state.startX) / cw);
      const dy = Math.round((event.clientY - state.startY) / ROW_PX);
      const others = allItems(state.card);

      let candidate: GridItem;
      if (state.mode === "drag") {
        candidate = { ...state.origin, x: state.origin.x + dx, y: Math.max(0, state.origin.y + dy) };
        const valid = nearestValid(candidate, others);
        state.lastValid = valid;
      } else {
        candidate = {
          ...state.origin,
          w: Math.max(MIN_W, Math.min(GRID_COLS - state.origin.x, state.origin.w + dx)),
          h: Math.max(MIN_H, state.origin.h + dy),
        };
        if (!others.some(item => overlaps(candidate, item))) state.lastValid = candidate;
      }

      applyItem(state.card, state.lastValid, canvas!);
      canvas!.style.height = `${layoutBottom([...others, state.lastValid]) * ROW_PX}px`;
    }

    function finish(event: PointerEvent) {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const others = allItems(state.card);
      const fitted = state.mode === "drag" ? fitIntoFreeSpace(state.lastValid, others) : state.lastValid;
      applyItem(state.card, fitted, canvas!);
      state.card.classList.remove("dsa-layout-dragging");
      canvas!.style.height = `${layoutBottom([...others, fitted]) * ROW_PX}px`;
      drag.current = null;
      persist();
    }

    canvas.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      drag.current = null;
    };
  }, [active, persist]);

  useEffect(() => {
    function handleAction(event: Event) {
      const action = (event as CustomEvent<{ action?: EditorAction }>).detail?.action;
      if (action === "toggle") setActive(value => !value);
      if (action === "enable") setActive(true);
      if (action === "disable") { persist(); setActive(false); }
      if (action === "export") exportContract();
      if (action === "reset") reset();
    }

    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setActive(value => !value);
      }
    }

    window.addEventListener("dsa:layout-editor", handleAction as EventListener);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("dsa:layout-editor", handleAction as EventListener);
      window.removeEventListener("keydown", shortcut);
    };
  }, [exportContract, persist, reset]);

  if (!active) return null;

  return (
    <div className="dsa-layout-editor-bar" role="toolbar" aria-label="DSA layout editor">
      <strong>Grid layout</strong>
      <span>24-column grid · drag by header · resize bottom-right · no swap / no replace</span>
      <button type="button" onClick={exportContract}>Export JSON</button>
      <button type="button" onClick={reset}>Reset route</button>
      <button type="button" onClick={() => { persist(); setActive(false); }}>Done</button>
    </div>
  );
}
