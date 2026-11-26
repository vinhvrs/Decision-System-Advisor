"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clampRect, fitAtAnchor, fitResize, fits, GRID_COLS, layoutBottom, MIN_H, MIN_W, placeWithoutOverlap, ROW_PX, type GridRect } from "./gridGeometry";
import marketsPreset from "./presets/markets.json";

// v3 coordinates came from the old, sometimes overlapping DOM layout. Keep
// that storage intact, but never apply it to this different coordinate system.
const STORAGE_KEY = "dsa.site-layout.v4";
const GAP = 4;
const CARD_SELECTOR = ".nt-panel, .nt-subsection, .nt-flat-surface, .nt-summary-column, .nt-news-article, [data-layout-key]";
const STRIP_SELECTOR = ".nt-context-strip, .nt-toolbar, .nt-financial-strip, .nt-company-view-tabs, .nt-company-tabs";
const CONTROL_SELECTOR = "button, input, select, textarea, [contenteditable=true], [role=slider], [role=tab]";
type SavedRoute = { cols: number; rowPx: number; updatedAt: string; presetRevision?: string; items: Record<string, GridRect> };
type Store = { version: 4; routes: Record<string, SavedRoute> };
type Descriptor = { element: HTMLElement; handle: HTMLElement | null; id: string; label: string };
type Card = Descriptor & { rect: GridRect; seed: GridRect; minW: number; minH: number; undoHandle: () => void };
type Control = { id: string; label: string; rect: GridRect };
type EditorAction = "toggle" | "enable" | "disable" | "export" | "reset" | "undo";
type Runtime = { persist: () => void; reset: () => void; export: () => void; undo: () => void };
// The approved desktop export is also the Reset layout baseline. Compact
// screens keep their independent, stacked layout and saved positions.
const PRESETS: Partial<Record<string, SavedRoute>> = { "/::wide": marketsPreset };

function readStore(): Store {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (value?.version === 4 && value.routes && typeof value.routes === "object" && !Array.isArray(value.routes)) return value;
  } catch { /* Storage denial must not disable dragging. */ }
  return { version: 4, routes: {} };
}
function writeStore(value: Store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}
function headerFor(element: HTMLElement) {
  if (element.matches(STRIP_SELECTOR)) return null;
  return element.querySelector<HTMLElement>(
    ":scope > .nt-panel-title, :scope > .nt-subsection-title, :scope > header, :scope > .nt-news-article-body > h2, :scope > .nt-news-reader-body > h1"
  );
}
/** Select semantic cards, not their rail/grid containers. React retains every node. */
function collect(main: HTMLElement, pathname: string) {
  const cards: Descriptor[] = [];
  const wrappers = new Set<HTMLElement>();
  const counts = new Map<string, number>();
  function walk(parent: HTMLElement) {
    for (const element of Array.from(parent.children)) {
      if (!(element instanceof HTMLElement) || element.matches("script, style, link, .dsa-grid-overlay") || element.hidden || element.style.display === "none") continue;
      const handle = headerFor(element);
      const isCard = element.matches(STRIP_SELECTOR) || (element.matches(CARD_SELECTOR) && (handle || !element.querySelector(CARD_SELECTOR)));
      if (!isCard && element.querySelector(`${CARD_SELECTOR}, ${STRIP_SELECTOR}`)) {
        wrappers.add(element);
        walk(element);
        continue;
      }
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const title = handle?.querySelector("strong, h1, h2")?.textContent?.trim()
        || handle?.textContent?.trim() || element.querySelector("h1, h2")?.textContent?.trim();
      const label = title || element.getAttribute("aria-label") || "Workspace controls";
      const base = element.dataset.layoutKey || slug(title || element.className.replace(/dsa-grid-\S+/g, "")) || element.tagName;
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      cards.push({ element, handle, label, id: `${pathname}::${base}::${count}` });
    }
  }
  walk(main);
  return { cards, wrappers };
}
function sameRect(a: GridRect, b: GridRect) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
function apply(card: Card, rect: GridRect) {
  card.rect = { ...rect };
  for (const key of ["x", "y", "w", "h"] as const) {
    card.element.style.setProperty(`--dsa-${key}`, String(rect[key]));
    card.element.setAttribute(`data-dsa-grid-${key}`, String(rect[key]));
  }
}
function prepareHandle(handle: HTMLElement | null, label: string) {
  if (!handle) return () => {};
  const previous = new Map(["tabindex", "title", "aria-label", "aria-roledescription"].map(name => [name, handle.getAttribute(name)]));
  handle.classList.add("dsa-grid-handle");
  handle.dataset.dsaDragHandle = "true";
  handle.tabIndex = 0;
  handle.setAttribute("aria-label", `Move ${label}`);
  handle.setAttribute("aria-roledescription", "draggable card header");
  handle.title = `Drag ${label} · Arrow keys move · Shift + arrows resize`;
  return () => {
    handle.classList.remove("dsa-grid-handle");
    delete handle.dataset.dsaDragHandle;
    for (const [name, value] of previous) {
      if (value === null) handle.removeAttribute(name); else handle.setAttribute(name, value);
    }
  };
}

export default function SiteLayoutEditor() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [view, setView] = useState<{ main: HTMLElement; controls: Control[] } | null>(null);
  const [status, setStatus] = useState("Drag a card title; resize from its bottom-right corner.");
  const [canUndo, setCanUndo] = useState(false);
  const runtime = useRef<Runtime | null>(null);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".nt-main");
    if (!main) return;
    const compact = main.clientWidth < 760;
    const routeKey = `${pathname}::${compact ? "compact" : "wide"}`;
    const preset = PRESETS[routeKey];
    const routeRevision = pathname === "/" ? preset?.updatedAt
      : pathname === "/investing" ? "nonmarket-chart-rails-20261126"
      : pathname.startsWith("/companies") ? "company-balanced-20261126" : "nonmarket-content-fit-20261126";
    const records = new Map<string, Card>();
    const knownPositions = new Map<string, GridRect>();
    const wrappers = new Set<HTMLElement>();
    const history: Map<string, GridRect>[] = [];
    let disposed = false;
    let reconcileFrame = 0;
    let motionFrame = 0;
    let lastWidth = main.clientWidth;
    let suppressClickUntil = 0;
    let gesture: {
      card: Card; mode: "move" | "resize"; pointerId: number;
      startX: number; startY: number; clientX: number; clientY: number;
      origin: GridRect; started: boolean; link: boolean; snapshot: Map<string, GridRect>;
    } | null = null;
    const resetFrame = requestAnimationFrame(() => { if (!disposed) setCanUndo(false); });
    const rects = (except?: Card) => [...records.values()].filter(card => card !== except).map(card => card.rect);
    const snapshot = () => new Map([...records].map(([id, card]) => [id, { ...card.rect }]));
    function refreshControls() {
      if (disposed) return;
      main!.style.setProperty("--dsa-rows", String(layoutBottom(rects()) + 8));
      setView({ main: main!, controls: [...records.values()].filter(card => card.handle).map(card => ({ id: card.id, label: card.label, rect: { ...card.rect } })) });
    }
    function persist() {
      const store = readStore();
      // Retain cards temporarily absent during a tab/feed refresh.
      const previous = store.routes[routeKey];
      const items = { ...(previous?.presetRevision !== routeRevision ? preset?.items ?? {} : previous?.items ?? {}) };
      for (const [id, card] of records) { items[id] = { ...card.rect }; knownPositions.set(id, { ...card.rect }); }
      store.routes[routeKey] = { cols: GRID_COLS, rowPx: ROW_PX, updatedAt: new Date().toISOString(), presetRevision: routeRevision, items };
      if (!writeStore(store)) setStatus("Layout changed. Browser storage is unavailable; keep this tab open to retain it.");
    }
    function remember(state: Map<string, GridRect>) {
      history.push(state);
      if (history.length > 30) history.shift();
      setCanUndo(true);
    }
    function finish(cancelled: boolean) {
      const current = gesture;
      if (!current) return;
      gesture = null;
      cancelAnimationFrame(motionFrame);
      if (current.started && current.link && !cancelled) suppressClickUntil = performance.now() + 300;
      if (cancelled) apply(current.card, current.origin);
      else if (current.started && !sameRect(current.origin, current.card.rect)) {
        remember(current.snapshot);
        setStatus(`${current.card.label}: position and size saved.`);
        persist();
      }
      current.card.element.classList.remove("dsa-grid-dragging", "dsa-grid-blocked");
      main!.classList.remove("dsa-grid-interacting");
      document.body.classList.remove("dsa-grid-pointer-active");
      if (main!.hasPointerCapture(current.pointerId)) main!.releasePointerCapture(current.pointerId);
      refreshControls();
    }
    function unregister(card: Card) {
      card.undoHandle();
      card.element.classList.remove("dsa-grid-item", "dsa-grid-dragging", "dsa-grid-blocked");
      delete card.element.dataset.dsaLayoutId;
      delete card.element.dataset.dsaLayoutLabel;
      for (const key of ["x", "y", "w", "h"]) {
        card.element.style.removeProperty(`--dsa-${key}`);
        card.element.removeAttribute(`data-dsa-grid-${key}`);
      }
    }
    function reconcile() {
      if (disposed || !main!.isConnected) return;
      const result = collect(main!, pathname);
      const descriptors = new Map(result.cards.map(card => [card.id, card]));
      const structuralChange = descriptors.size !== records.size
        || [...records].some(([id, card]) => descriptors.get(id)?.element !== card.element);
      // Cancel before reserving space for any new card. Otherwise an addition
      // could occupy the dragged card's origin and collide on cancellation.
      if (structuralChange && gesture) finish(true);
      let changed = false;
      for (const [id, card] of records) {
        if (descriptors.get(id)?.element !== card.element) {
          if (gesture?.card === card) finish(true);
          knownPositions.set(id, { ...card.rect });
          unregister(card); records.delete(id); changed = true;
        }
      }
      const added = result.cards.filter(item => !records.has(item.id));
      if (added.length) {
        // Measure all cards in their natural layout in one synchronous pass.
        // New feed cards would otherwise measure as CSS grid auto-placed cells.
        main!.classList.remove("dsa-grid");
        for (const wrapper of wrappers) wrapper.classList.remove("dsa-grid-wrapper");
        const bounds = main!.getBoundingClientRect();
        const cell = Math.max(1, bounds.width / GRID_COLS);
        const measured = result.cards.map(item => ({ item, bounds: item.element.getBoundingClientRect() }));
        measured.sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
        // Reserve the complete approved layout even if a feed card has not
        // mounted yet, so an unknown/new card cannot take its default space.
        const defaults: GridRect[] = Object.values(preset?.items ?? {}).map(rect => ({ ...rect }));
        const seeds = new Map<string, GridRect>();
        for (const { item, bounds: box } of measured) {
          const approved = preset?.items[item.id];
          if (approved) { seeds.set(item.id, { ...approved }); continue; }
          const indicatorPair = pathname === "/indicators" && !compact
            && ["Published metric snapshot", "Additional technical calculations"].includes(item.label);
          const indicatorWide = pathname === "/indicators" && item.label === "Market technical context";
          const inspector = pathname === "/screener" && !compact
            && Boolean(item.element.closest(".nt-screener-inspector"));
          const screenerTable = pathname === "/screener" && item.label === "Instrument universe";
          const chartRail = pathname === "/investing" && !compact
            && Boolean(item.element.closest(".nt-chart-rail"));
          const chartCenter = pathname === "/investing" && !compact
            && Boolean(item.element.closest(".nt-chart-center"));
          const chartRight = chartRail && box.left - bounds.left > bounds.width / 2;
          const companyOverview = pathname.startsWith("/companies") && !compact;
          const companyLeft = companyOverview && ["Research links", "Peer comparison"].includes(item.label);
          const companyRight = companyOverview && ["Company signals & event reaction", "Recent SEC filings"].includes(item.label);
          const naturalHeight = Math.max(box.height, item.element.scrollHeight);
          const contentHeight = pathname === "/" ? Math.min(box.height, item.handle ? 720 : 1000)
            : item.element.matches(".nt-data-table") ? Math.min(naturalHeight, 1200) : naturalHeight;
          const seed = clampRect({
            x: compact ? 0 : indicatorPair ? (item.label === "Published metric snapshot" ? 0 : 24)
              : indicatorWide ? 0 : companyLeft ? 0 : companyRight ? 24 : inspector ? 35 : chartCenter ? 10 : chartRail ? (chartRight ? 38 : 0) : Math.round((box.left - bounds.left) / cell),
            y: 0,
            w: compact || indicatorWide ? GRID_COLS : indicatorPair ? 24
              : companyLeft || companyRight ? 24 : inspector ? 13 : screenerTable ? 35 : chartCenter ? 28 : chartRail ? 10 : Math.round(box.width / cell),
            h: Math.ceil((contentHeight + GAP) / ROW_PX),
          }, item.handle ? MIN_W : 1, item.handle ? MIN_H : 1);
          // Initial defaults are compact. User edits never compact neighbors.
          seed.y = Math.max(0, ...defaults.filter(other => seed.x < other.x + other.w && seed.x + seed.w > other.x).map(other => other.y + other.h));
          defaults.push(seed); seeds.set(item.id, seed);
        }
        const saved = readStore().routes[routeKey];
        // Adopt a newly approved preset once. Later drags/resizes save the
        // revision, so they continue to survive navigation and reloads.
        const needsPresetMigration = Boolean(routeRevision && saved?.presetRevision !== routeRevision);
        const savedItems = !needsPresetMigration && saved?.cols === GRID_COLS && saved?.rowPx === ROW_PX && saved.items && typeof saved.items === "object" ? saved.items : {};
        // Valid restored coordinates have priority over newly introduced cards.
        added.sort((a, b) => Number(Boolean(knownPositions.get(b.id) || savedItems[b.id] || preset?.items[b.id])) - Number(Boolean(knownPositions.get(a.id) || savedItems[a.id] || preset?.items[a.id])));
        const pending = added.map(item => {
          const minW = item.handle ? MIN_W : 1;
          const minH = item.handle ? MIN_H : 1;
          const seed = seeds.get(item.id)!;
          const stored = knownPositions.get(item.id) || savedItems[item.id];
          const normalized = stored ? clampRect(stored, minW, minH) : seed;
          const preferred = { ...normalized, h: pathname === "/" ? Math.min(500, normalized.h) : normalized.h };
          return { item, seed, minW, minH, preferred };
        });
        const planned = new Map<string, GridRect>();
        let repaired = false;
        try {
          const occupied = rects();
          for (const entry of pending) {
            const rect = placeWithoutOverlap(entry.preferred, occupied);
            planned.set(entry.item.id, rect); occupied.push(rect);
          }
        } catch {
          // Damaged saved coordinates must never crash the editor or fall back
          // to overlapping boxes. Rebuild this profile from measured defaults.
          repaired = true; knownPositions.clear();
          const defaults = [
            ...[...records.values()].map(card => ({ id: card.id, seed: card.seed })),
            ...pending.map(entry => ({ id: entry.item.id, seed: entry.seed })),
          ].sort((a, b) => a.seed.y - b.seed.y || a.seed.x - b.seed.x);
          const occupied: GridRect[] = [];
          for (const entry of defaults) {
            const rect = placeWithoutOverlap(entry.seed, occupied);
            planned.set(entry.id, rect); occupied.push(rect);
          }
          for (const card of records.values()) apply(card, planned.get(card.id)!);
        }
        for (const { item, seed, minW, minH } of pending) {
          const rect = planned.get(item.id)!;
          const card: Card = { ...item, rect, seed, minW, minH, undoHandle: prepareHandle(item.handle, item.label) };
          records.set(card.id, card);
          apply(card, rect); changed = true;
        }
        if (repaired) setStatus("An invalid saved layout was repaired using the workspace defaults.");
        if (repaired || needsPresetMigration) persist();
      }
      // Data feeds can fill a card after its first paint. Expand non-market cards
      // and move later cards down, keeping each column and all content visible.
      // Only content growth triggers this; user drag/resize remains independent.
      if (pathname !== "/" && !gesture && !added.length) {
        const ordered = [...records.values()].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
        const occupied: GridRect[] = [];
        let grew = false;
        for (const card of ordered) {
          const contentHeight = card.element.matches(".nt-data-table") ? Math.min(card.element.scrollHeight, 1200) : card.element.scrollHeight;
          const needed = Math.ceil((contentHeight + GAP) / ROW_PX);
          const preferred = needed > card.rect.h ? { ...card.rect, h: needed } : card.rect;
          const next = placeWithoutOverlap(preferred, occupied);
          if (!sameRect(next, card.rect)) { apply(card, next); grew = true; }
          occupied.push(next);
        }
        if (grew) { changed = true; refreshControls(); }
      }
      for (const card of records.values()) {
        // React may replace className while updating the feed. Reapply only
        // editor-owned markers, retaining every application class and node.
        card.element.classList.add("dsa-grid-item");
        card.element.dataset.dsaLayoutId = card.id;
        card.element.dataset.dsaLayoutLabel = card.label;
        const handle = headerFor(card.element);
        if (handle !== card.handle) {
          card.undoHandle(); card.handle = handle;
          card.undoHandle = prepareHandle(handle, card.label); changed = true;
        }
        handle?.classList.add("dsa-grid-handle");
        if (handle) handle.dataset.dsaDragHandle = "true";
      }
      for (const wrapper of result.wrappers) { wrapper.classList.add("dsa-grid-wrapper"); wrappers.add(wrapper); }
      main!.classList.add("dsa-grid");
      if (changed) refreshControls();
    }
    function updateGesture(capture = true) {
      const current = gesture;
      if (!current || !current.card.element.isConnected) return;
      const dx = current.clientX - current.startX;
      const dy = current.clientY + window.scrollY - current.startY;
      if (!current.started && Math.hypot(dx, dy) < 5) return;
      if (!current.started) {
        current.started = true; current.card.element.classList.add("dsa-grid-dragging");
        main!.classList.add("dsa-grid-interacting"); document.body.classList.add("dsa-grid-pointer-active");
        if (current.link && capture) main!.setPointerCapture(current.pointerId);
      }
      const cell = Math.max(1, main!.clientWidth / GRID_COLS);
      const x = Math.round(dx / cell); const y = Math.round(dy / ROW_PX);
      const { card, origin } = current;
      const others = rects(card);
      const requested = current.mode === "move" ? {
        ...origin, x: Math.max(0, Math.min(GRID_COLS - card.minW, origin.x + x)), y: Math.max(0, Math.min(9500, origin.y + y)),
      } : {
        ...origin, w: Math.max(card.minW, Math.min(GRID_COLS - origin.x, origin.w + x)), h: Math.max(card.minH, Math.min(500, origin.h + y)),
      };
      const next = current.mode === "move" ? fitAtAnchor(requested, others, card.minW, card.minH) : fitResize(origin, requested, others, card.minW, card.minH);
      card.element.classList.toggle("dsa-grid-blocked", !next);
      if (next && fits(next, others) && !sameRect(next, card.rect)) { apply(card, next); refreshControls(); }
    }
    function tick() {
      if (!gesture) return;
      if (gesture.started) {
        const navBottom = document.querySelector(".nt-primary-nav")?.getBoundingClientRect().bottom ?? 80;
        const edge = 48;
        const up = gesture.clientY < navBottom + edge ? -Math.min(22, Math.max(0, (navBottom + edge - gesture.clientY) / 3)) : 0;
        const down = gesture.clientY > window.innerHeight - edge ? Math.min(22, (gesture.clientY - window.innerHeight + edge) / 3) : 0;
        if (up || down) window.scrollBy(0, up || down);
      }
      updateGesture(); motionFrame = requestAnimationFrame(tick);
    }
    function onDown(event: PointerEvent) {
      if (event.button !== 0 || gesture || !(event.target instanceof Element)) return;
      const resize = event.target.closest<HTMLElement>(".dsa-grid-resize-control");
      const handle = event.target.closest<HTMLElement>(".dsa-grid-handle");
      if (!resize && (!handle || event.target.closest(CONTROL_SELECTOR))) return;
      const id = resize?.dataset.dsaResizeOwner || handle?.closest<HTMLElement>(".dsa-grid-item")?.dataset.dsaLayoutId;
      const card = id ? records.get(id) : undefined;
      if (!card?.handle) return;
      const link = !resize && Boolean(event.target.closest("a"));
      if (!link) { event.preventDefault(); (resize || handle)?.focus({ preventScroll: true }); }
      gesture = { card, mode: resize ? "resize" : "move", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY + window.scrollY, clientX: event.clientX, clientY: event.clientY, origin: { ...card.rect }, started: false, link, snapshot: snapshot() };
      // An ordinary title-link click must retain its native navigation target.
      // Capture only once it becomes a drag; suppress the ensuing click then.
      if (!link) main!.setPointerCapture(event.pointerId);
      motionFrame = requestAnimationFrame(tick);
    }
    function onMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      event.preventDefault(); gesture.clientX = event.clientX; gesture.clientY = event.clientY; updateGesture();
    }
    function onUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gesture.clientX = event.clientX; gesture.clientY = event.clientY; updateGesture(false); finish(false);
    }
    function onCancel(event: PointerEvent) { if (event.pointerId === gesture?.pointerId) finish(true); }
    function onBlur() { finish(true); }
    function onClick(event: MouseEvent) {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); suppressClickUntil = 0; }
    }
    function onNativeDrag(event: DragEvent) {
      if (event.target instanceof Element && event.target.closest(".dsa-grid-handle")) event.preventDefault();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && gesture) { event.preventDefault(); finish(true); return; }
      if (!(event.target instanceof HTMLElement) || gesture) return;
      const resize = event.target.matches(".dsa-grid-resize-control");
      const handle = event.target.matches(".dsa-grid-handle");
      const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if ((!resize && !handle) || !delta[event.key]) return;
      const id = resize ? event.target.dataset.dsaResizeOwner : event.target.closest<HTMLElement>(".dsa-grid-item")?.dataset.dsaLayoutId;
      const card = id ? records.get(id) : undefined;
      if (!card) return;
      event.preventDefault();
      const [dx, dy] = delta[event.key]; const others = rects(card);
      const next = resize || event.shiftKey
        ? fitResize(card.rect, { ...card.rect, w: card.rect.w + dx, h: Math.min(500, card.rect.h + dy) }, others, card.minW, card.minH)
        : { ...card.rect, x: card.rect.x + dx, y: card.rect.y + dy };
      if (next && fits(next, others) && !sameRect(next, card.rect)) {
        remember(snapshot()); apply(card, next); refreshControls();
        setStatus(`${card.label}: column ${next.x + 1}, row ${next.y + 1}, ${next.w} by ${next.h} cells.`); persist();
      } else setStatus("That space is occupied. Move or resize into empty cells.");
    }
    runtime.current = {
      persist,
      reset() {
        finish(true); remember(snapshot()); knownPositions.clear();
        const store = readStore(); delete store.routes[routeKey]; writeStore(store);
        const placed: GridRect[] = [];
        for (const card of [...records.values()].sort((a, b) => a.seed.y - b.seed.y || a.seed.x - b.seed.x)) { const rect = placeWithoutOverlap(card.seed, placed); apply(card, rect); placed.push(rect); }
        refreshControls(); setStatus("Default layout restored for this workspace.");
      },
      undo() {
        finish(true); const previous = history.pop(); if (!previous) return;
        const placed: GridRect[] = [];
        for (const [id, card] of records) { const rect = placeWithoutOverlap(previous.get(id) ?? card.rect, placed); apply(card, rect); placed.push(rect); }
        setCanUndo(history.length > 0); refreshControls(); setStatus("Last layout change undone."); persist();
      },
      export() {
        persist();
        const blob = new Blob([JSON.stringify(readStore().routes[routeKey], null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `dsa-grid-${slug(pathname) || "markets"}.json`; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
    };
    reconcile();
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        const target = mutation.target;
        if (target instanceof Element && target.closest(".dsa-grid-overlay")) return false;
        if (mutation.type === "childList" || mutation.attributeName === "data-layout-key") return true;
        if (!(target instanceof HTMLElement) || mutation.attributeName !== "class") return false;
        if (wrappers.has(target) && !target.classList.contains("dsa-grid-wrapper")) return true;
        return [...records.values()].some(card =>
          (card.element === target && !target.classList.contains("dsa-grid-item"))
          || (card.handle === target && !target.classList.contains("dsa-grid-handle")));
      });
      if (!relevant) return;
      cancelAnimationFrame(reconcileFrame); reconcileFrame = requestAnimationFrame(reconcile);
    });
    observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-layout-key"] });
    const resizeObserver = new ResizeObserver(() => {
      if (Math.abs(main.clientWidth - lastWidth) < 1) return;
      lastWidth = main.clientWidth; finish(true);
      if ((main.clientWidth < 760) !== compact) setGeneration(value => value + 1);
    });
    resizeObserver.observe(main);
    main.addEventListener("pointerdown", onDown);
    main.addEventListener("lostpointercapture", onCancel);
    main.addEventListener("click", onClick, true); main.addEventListener("dragstart", onNativeDrag);
    window.addEventListener("pointermove", onMove, { passive: false }); window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel); window.addEventListener("blur", onBlur); window.addEventListener("keydown", onKey);
    return () => {
      disposed = true; observer.disconnect(); resizeObserver.disconnect();
      cancelAnimationFrame(resetFrame); cancelAnimationFrame(reconcileFrame); cancelAnimationFrame(motionFrame); finish(true);
      main.removeEventListener("pointerdown", onDown);
      main.removeEventListener("lostpointercapture", onCancel);
      main.removeEventListener("click", onClick, true); main.removeEventListener("dragstart", onNativeDrag);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel); window.removeEventListener("blur", onBlur); window.removeEventListener("keydown", onKey);
      for (const card of records.values()) unregister(card);
      for (const wrapper of wrappers) wrapper.classList.remove("dsa-grid-wrapper");
      main.classList.remove("dsa-grid", "dsa-grid-interacting"); main.style.removeProperty("--dsa-rows");
      document.body.classList.remove("dsa-grid-pointer-active"); runtime.current = null;
    };
  }, [pathname, generation]);

  useEffect(() => {
    document.body.classList.toggle("dsa-grid-guides", active);
    return () => document.body.classList.remove("dsa-grid-guides");
  }, [active]);
  useEffect(() => {
    function action(event: Event) {
      const value = (event as CustomEvent<{ action?: EditorAction }>).detail?.action;
      if (value === "toggle") setActive(previous => !previous);
      if (value === "enable") setActive(true);
      if (value === "disable") { runtime.current?.persist(); setActive(false); }
      if (value === "reset") runtime.current?.reset();
      if (value === "export") runtime.current?.export();
      if (value === "undo") runtime.current?.undo();
    }
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") { event.preventDefault(); setActive(previous => !previous); }
    }
    window.addEventListener("dsa:layout-editor", action); window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("dsa:layout-editor", action); window.removeEventListener("keydown", shortcut); };
  }, []);

  return <>
    <span className="dsa-grid-status" role="status" aria-live="polite">{status}</span>
    {view && createPortal(<div className="dsa-grid-overlay">
      {view.controls.map(({ id, label, rect }) => <button key={id} type="button" className="dsa-grid-resize-control" data-dsa-resize-owner={id} aria-label={`Resize ${label}`} title={`Resize ${label} · drag corner or use arrow keys`} style={{ left: `calc(${(rect.x + rect.w) / GRID_COLS * 100}% - 20px)`, top: (rect.y + rect.h) * ROW_PX - 20 }} />)}
    </div>, view.main)}
    {active && <div className="dsa-grid-toolbar" role="toolbar" aria-label="Grid layout controls">
      <div><strong>Grid layout</strong><span>Drag titles · Resize corners · Empty cells only</span></div>
      <button type="button" disabled={!canUndo} onClick={() => runtime.current?.undo()}>Undo</button>
      <button type="button" onClick={() => runtime.current?.export()}>Export</button>
      <button type="button" onClick={() => runtime.current?.reset()}>Reset layout</button>
      <button type="button" onClick={() => setActive(false)}>Done</button>
    </div>}
  </>;
}
