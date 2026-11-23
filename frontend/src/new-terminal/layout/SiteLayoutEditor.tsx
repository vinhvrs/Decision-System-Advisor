"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dsa.site-layout.v1";
const CARD_SELECTOR = [
  ".nt-main [data-layout-key]",
  ".nt-main .nt-panel",
  ".nt-main .nt-flat-surface",
  ".nt-main .nt-context-strip",
  ".nt-main .nt-toolbar",
  ".nt-main .nt-news-article",
].join(",");

type CardLayout = {
  id: string;
  label: string;
  order: number;
  widthPx: number;
  heightPx: number;
  widthRatioParent: number;
  heightRatioViewport: number;
  xRatioViewport: number;
  yRatioViewport: number;
};

type RouteLayout = {
  pathname: string;
  viewport: { width: number; height: number };
  updatedAt: string;
  cards: Record<string, CardLayout>;
};

type LayoutStore = {
  version: 1;
  routes: Record<string, RouteLayout>;
};

type EditorAction = "toggle" | "enable" | "disable" | "export" | "reset";

function emptyStore(): LayoutStore {
  return { version: 1, routes: {} };
}

function readStore(): LayoutStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (parsed?.version === 1 && parsed.routes && typeof parsed.routes === "object") return parsed;
  } catch {
    // Ignore malformed browser-local layout state.
  }
  return emptyStore();
}

function writeStore(store: LayoutStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function clean(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function labelFor(element: HTMLElement) {
  const explicit = element.dataset.layoutKey;
  if (explicit) return explicit;
  const heading = element.querySelector<HTMLElement>(
    ":scope > .nt-panel-title strong, :scope > .nt-subsection-title strong, :scope > h1, :scope > h2, :scope > header h2"
  );
  return heading?.textContent?.trim() || element.getAttribute("aria-label") || element.className || element.tagName;
}

function collectCards(pathname: string) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR))
    .filter(element => element.closest(".nt-main"))
    .filter(element => !element.closest(".nt-utility-drawer"))
    .filter((element, index, all) => all.indexOf(element) === index);

  const counts = new Map<string, number>();
  return candidates.map(element => {
    const label = labelFor(element);
    const base = clean(element.dataset.layoutKey || label || element.tagName) || "card";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const id = `${pathname}::${base}::${count}`;
    element.dataset.dsaLayoutId = id;
    element.dataset.dsaLayoutLabel = label;
    return element;
  });
}

function currentOrder(element: HTMLElement) {
  const raw = Number.parseInt(element.style.order || "", 10);
  if (Number.isFinite(raw)) return raw;
  if (!element.parentElement) return 0;
  return Array.from(element.parentElement.children).indexOf(element);
}

function measure(element: HTMLElement): CardLayout {
  const rect = element.getBoundingClientRect();
  const parentRect = element.parentElement?.getBoundingClientRect();
  const vw = Math.max(window.innerWidth, 1);
  const vh = Math.max(window.innerHeight, 1);
  return {
    id: element.dataset.dsaLayoutId || "",
    label: element.dataset.dsaLayoutLabel || labelFor(element),
    order: currentOrder(element),
    widthPx: Math.round(rect.width),
    heightPx: Math.round(rect.height),
    widthRatioParent: Number((rect.width / Math.max(parentRect?.width ?? rect.width, 1)).toFixed(5)),
    heightRatioViewport: Number((rect.height / vh).toFixed(5)),
    xRatioViewport: Number((rect.left / vw).toFixed(5)),
    yRatioViewport: Number((rect.top / vh).toFixed(5)),
  };
}

function snap4(value: number) {
  return Math.max(0, Math.round(value / 4) * 4);
}

export default function SiteLayoutEditor() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const dragged = useRef<HTMLElement | null>(null);

  const persistCurrent = useCallback(() => {
    const cards = collectCards(pathname);
    const store = readStore();
    const measured = Object.fromEntries(cards.map(card => {
      const item = measure(card);
      return [item.id, item];
    }));
    store.routes[pathname] = {
      pathname,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      updatedAt: new Date().toISOString(),
      cards: measured,
    };
    writeStore(store);
    return store;
  }, [pathname]);

  const applySaved = useCallback(() => {
    const saved = readStore().routes[pathname];
    const cards = collectCards(pathname);
    for (const card of cards) {
      const state = saved?.cards?.[card.dataset.dsaLayoutId || ""];
      if (!state) continue;
      card.style.order = String(state.order);
      if (state.widthPx > 0) card.style.width = `${state.widthPx}px`;
      if (state.heightPx > 0) card.style.height = `${state.heightPx}px`;
    }
  }, [pathname]);

  const resetCurrent = useCallback(() => {
    const store = readStore();
    delete store.routes[pathname];
    writeStore(store);
    for (const card of collectCards(pathname)) {
      card.style.removeProperty("order");
      card.style.removeProperty("width");
      card.style.removeProperty("height");
    }
  }, [pathname]);

  const exportContract = useCallback(() => {
    const store = persistCurrent();
    const payload = {
      format: "dsa-layout-contract",
      version: 1,
      exportedAt: new Date().toISOString(),
      rules: {
        targetDeadSpacePercentMax: 5,
        snapPx: 4,
        note: "Use widthRatioParent and viewport-relative ratios as the primary implementation reference; pixel sizes document the captured viewport only.",
      },
      routes: store.routes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dsa-layout-contract-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [persistCurrent]);

  useEffect(() => {
    applySaved();
    const timer = window.setTimeout(applySaved, 350);
    return () => window.clearTimeout(timer);
  }, [applySaved]);

  useEffect(() => {
    document.body.classList.toggle("dsa-layout-editing", active);
    const cards = collectCards(pathname);
    cards.forEach(card => {
      card.draggable = active;
      card.classList.toggle("dsa-layout-card", active);
      if (active) {
        card.style.resize = "both";
        card.style.overflow = "auto";
      } else {
        card.style.removeProperty("resize");
        card.style.removeProperty("overflow");
      }
    });

    if (!active) return;

    function onDragStart(event: DragEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dsa-layout-card");
      if (!target) return;
      dragged.current = target;
      target.classList.add("dsa-layout-dragging");
      event.dataTransfer?.setData("text/plain", target.dataset.dsaLayoutId || "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    }

    function onDragOver(event: DragEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dsa-layout-card");
      if (!target || !dragged.current || target === dragged.current) return;
      if (target.parentElement !== dragged.current.parentElement) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    }

    function onDrop(event: DragEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dsa-layout-card");
      const source = dragged.current;
      if (!target || !source || target === source || target.parentElement !== source.parentElement) return;
      event.preventDefault();
      const sourceOrder = currentOrder(source);
      const targetOrder = currentOrder(target);
      source.style.order = String(targetOrder);
      target.style.order = String(sourceOrder);
      persistCurrent();
    }

    function onDragEnd() {
      dragged.current?.classList.remove("dsa-layout-dragging");
      dragged.current = null;
      persistCurrent();
    }

    function onPointerUp(event: PointerEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dsa-layout-card");
      if (target) {
        const rect = target.getBoundingClientRect();
        target.style.width = `${snap4(rect.width)}px`;
        target.style.height = `${snap4(rect.height)}px`;
      }
      persistCurrent();
    }

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragend", onDragEnd);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [active, pathname, persistCurrent]);

  useEffect(() => {
    function handleAction(event: Event) {
      const action = (event as CustomEvent<{ action?: EditorAction }>).detail?.action;
      if (action === "toggle") setActive(value => !value);
      if (action === "enable") setActive(true);
      if (action === "disable") {
        persistCurrent();
        setActive(false);
      }
      if (action === "export") exportContract();
      if (action === "reset") resetCurrent();
    }

    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setActive(value => !value);
      }
    }

    window.addEventListener("dsa:layout-editor", handleAction as EventListener);
    window.addEventListener("keydown", shortcut);
    (window as Window & { DSALayout?: Record<string, () => void> }).DSALayout = {
      edit: () => setActive(true),
      done: () => { persistCurrent(); setActive(false); },
      export: exportContract,
      reset: resetCurrent,
    };

    return () => {
      window.removeEventListener("dsa:layout-editor", handleAction as EventListener);
      window.removeEventListener("keydown", shortcut);
      delete (window as Window & { DSALayout?: Record<string, () => void> }).DSALayout;
    };
  }, [exportContract, persistCurrent, resetCurrent]);

  if (!active) return null;

  return (
    <div className="dsa-layout-editor-bar" role="toolbar" aria-label="DSA layout editor">
      <strong>Layout edit</strong>
      <span>Drag cards · resize from bottom-right · 4px snap</span>
      <button type="button" onClick={exportContract}>Export JSON</button>
      <button type="button" onClick={resetCurrent}>Reset route</button>
      <button type="button" onClick={() => { persistCurrent(); setActive(false); }}>Done</button>
    </div>
  );
}
