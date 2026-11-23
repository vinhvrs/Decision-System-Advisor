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

type EditorAction = "toggle" | "enable" | "disable" | "export" | "reset" | "test";

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

  const editing = document.body.classList.contains("dsa-layout-editing");
  const counts = new Map<string, number>();

  return candidates.map(element => {
    const label = labelFor(element);
    const base = clean(element.dataset.layoutKey || label || element.tagName) || "card";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const id = `${pathname}::${base}::${count}`;

    element.dataset.dsaLayoutId = id;
    element.dataset.dsaLayoutLabel = label;

    let handle = element.querySelector<HTMLElement>(":scope > .dsa-layout-top-handle");

    if (editing) {
      if (!handle) {
        handle = document.createElement("div");
        handle.className = "dsa-layout-top-handle dsa-layout-drag-handle";
        element.appendChild(handle);
      }
      handle.dataset.dsaDragHandle = "true";
      handle.dataset.dsaLayoutOwner = id;
      handle.setAttribute("aria-label", `Drag ${label}`);
      handle.setAttribute("title", `Drag ${label}`);
    } else if (handle) {
      handle.remove();
    }

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
  const [testStatus, setTestStatus] = useState<string>("");
  const dragState = useRef<{
    source: HTMLElement;
    handle: HTMLElement;
    startX: number;
    startY: number;
    target: HTMLElement | null;
    started: boolean;
    pointerId: number;
  } | null>(null);

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
    const main = document.querySelector(".nt-main");
    let refreshTimer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(applySaved, 80);
    });
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(refreshTimer);
      observer.disconnect();
    };
  }, [applySaved]);

  useEffect(() => {
    document.body.classList.toggle("dsa-layout-editing", active);
    const cards = collectCards(pathname);

    cards.forEach(card => {
      card.draggable = false;
      card.classList.toggle("dsa-layout-card", active);

      let handle = card.querySelector<HTMLElement>("[data-dsa-drag-handle='true']");
      const staleSynthetic = card.querySelector<HTMLElement>(":scope > .dsa-layout-top-handle");

      if (active && !handle) {
        const synthetic = staleSynthetic ?? document.createElement("div");
        synthetic.className = "dsa-layout-top-handle";
        synthetic.dataset.dsaDragHandle = "true";
        synthetic.setAttribute("aria-label", `Drag ${card.dataset.dsaLayoutLabel || "panel"}`);
        synthetic.setAttribute("title", "Drag panel");
        if (!staleSynthetic) card.appendChild(synthetic);
        handle = synthetic;
      }

      if (!active && staleSynthetic) staleSynthetic.remove();
      if (handle) handle.classList.toggle("dsa-layout-drag-handle", active);

      if (active) {
        card.style.resize = "both";
        card.style.overflow = "auto";
      } else {
        card.style.removeProperty("resize");
        card.style.removeProperty("overflow");
        card.style.removeProperty("transform");
        card.style.removeProperty("z-index");
        card.style.removeProperty("pointer-events");
      }
    });

    if (!active) return;

    function orderedSiblings(source: HTMLElement) {
      if (!source.parentElement) return [];
      return Array.from(source.parentElement.children)
        .filter((item): item is HTMLElement => item instanceof HTMLElement && item.classList.contains("dsa-layout-card"))
        .sort((a, b) => currentOrder(a) - currentOrder(b));
    }

    function commitReorder(source: HTMLElement, target: HTMLElement, event: PointerEvent) {
      if (!source.parentElement || source.parentElement !== target.parentElement) return;

      const ordered = orderedSiblings(source);
      const sourceIndex = ordered.indexOf(source);
      const targetIndex = ordered.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

      const next = ordered.filter(item => item !== source);
      const targetRect = target.getBoundingClientRect();
      const parentStyle = getComputedStyle(source.parentElement);
      const horizontal =
        parentStyle.display.includes("grid") ||
        parentStyle.flexDirection === "row" ||
        parentStyle.flexDirection === "row-reverse";
      const after = horizontal
        ? event.clientX > targetRect.left + targetRect.width / 2
        : event.clientY > targetRect.top + targetRect.height / 2;

      const baseIndex = next.indexOf(target);
      next.splice(Math.max(0, baseIndex + (after ? 1 : 0)), 0, source);
      next.forEach((item, index) => {
        item.style.order = String(index);
      });
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const eventTarget = event.target as HTMLElement | null;
      const handle = eventTarget?.closest<HTMLElement>("[data-dsa-drag-handle='true']");
      if (!handle) return;

      const source = handle.closest<HTMLElement>(".dsa-layout-card");
      if (!source) return;

      event.preventDefault();
      event.stopPropagation();

      dragState.current = {
        source,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        target: null,
        started: false,
        pointerId: event.pointerId,
      };

      try { handle.setPointerCapture(event.pointerId); } catch {}
      document.body.classList.add("dsa-layout-pointer-armed");
    }

    function onPointerMove(event: PointerEvent) {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (!state.started && Math.hypot(dx, dy) < 5) return;

      if (!state.started) {
        state.started = true;
        state.source.classList.add("dsa-layout-dragging");
        document.body.classList.add("dsa-layout-pointer-dragging");
        state.source.style.zIndex = "450";
        state.source.style.pointerEvents = "none";
      }

      event.preventDefault();
      state.source.style.transform = `translate(${dx}px, ${dy}px)`;

      const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const candidate = hit?.closest<HTMLElement>(".dsa-layout-card") ?? null;
      const valid =
        candidate &&
        candidate !== state.source &&
        candidate.parentElement === state.source.parentElement
          ? candidate
          : null;

      if (state.target !== valid) {
        state.target?.classList.remove("dsa-layout-drop-target");
        state.target = valid;
        state.target?.classList.add("dsa-layout-drop-target");
      }
    }

    function finishPointerDrag(event: PointerEvent, cancelled = false) {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;

      if (!cancelled && state.started && state.target) {
        commitReorder(state.source, state.target, event);
      }

      state.target?.classList.remove("dsa-layout-drop-target");
      state.source.classList.remove("dsa-layout-dragging");
      state.source.style.removeProperty("transform");
      state.source.style.removeProperty("z-index");
      state.source.style.removeProperty("pointer-events");
      document.body.classList.remove("dsa-layout-pointer-armed", "dsa-layout-pointer-dragging");

      try { state.handle.releasePointerCapture(event.pointerId); } catch {}
      dragState.current = null;
      persistCurrent();
    }

    function onPointerUp(event: PointerEvent) {
      const state = dragState.current;
      if (state && state.pointerId === event.pointerId) {
        finishPointerDrag(event);
        return;
      }

      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dsa-layout-card");
      if (target) {
        const rect = target.getBoundingClientRect();
        target.style.width = `${snap4(rect.width)}px`;
        target.style.height = `${snap4(rect.height)}px`;
        persistCurrent();
      }
    }

    function onPointerCancel(event: PointerEvent) {
      finishPointerDrag(event, true);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.body.classList.remove("dsa-layout-pointer-armed", "dsa-layout-pointer-dragging");
      dragState.current = null;
    };
  }, [active, pathname, persistCurrent]);

  const runSelfTest = useCallback(() => {
    setActive(true);
    setTestStatus("Testing drag…");

    window.setTimeout(() => {
      const cards = collectCards(pathname);
      const group = cards.find(card => {
        if (!card.parentElement) return false;
        return Array.from(card.parentElement.children).filter(
          item => item instanceof HTMLElement && item.classList.contains("dsa-layout-card")
        ).length >= 2;
      });

      if (!group?.parentElement) {
        setTestStatus("Drag test: no sibling card group");
        return;
      }

      const siblings = Array.from(group.parentElement.children).filter(
        (item): item is HTMLElement => item instanceof HTMLElement && item.classList.contains("dsa-layout-card")
      );
      const source = siblings[0];
      const target = siblings[1];
      const handle = source.querySelector<HTMLElement>("[data-dsa-drag-handle='true']");
      if (!source || !target || !handle) {
        setTestStatus("Drag test: handle unavailable");
        return;
      }

      const original = siblings.map(item => item.style.order);
      const sourceBefore = currentOrder(source);
      const targetBefore = currentOrder(target);
      const handleRect = handle.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const pointerId = 777;

      handle.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        clientX: handleRect.left + Math.min(12, handleRect.width / 2),
        clientY: handleRect.top + Math.min(10, handleRect.height / 2),
      }));

      document.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        buttons: 1,
        clientX: targetRect.left + targetRect.width * 0.75,
        clientY: targetRect.top + targetRect.height * 0.75,
      }));

      document.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
        clientX: targetRect.left + targetRect.width * 0.75,
        clientY: targetRect.top + targetRect.height * 0.75,
      }));

      window.setTimeout(() => {
        const moved = currentOrder(source) !== sourceBefore || currentOrder(target) !== targetBefore;
        siblings.forEach((item, index) => {
          if (original[index]) item.style.order = original[index];
          else item.style.removeProperty("order");
        });
        persistCurrent();
        setTestStatus(moved ? "Drag test: PASS" : "Drag test: FAIL");
      }, 40);
    }, 120);
  }, [pathname, persistCurrent]);

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
      if (action === "test") runSelfTest();
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
      test: runSelfTest,
    };

    return () => {
      window.removeEventListener("dsa:layout-editor", handleAction as EventListener);
      window.removeEventListener("keydown", shortcut);
      delete (window as Window & { DSALayout?: Record<string, () => void> }).DSALayout;
    };
  }, [exportContract, persistCurrent, resetCurrent, runSelfTest]);

  if (!active) return null;

  return (
    <div className="dsa-layout-editor-bar" role="toolbar" aria-label="DSA layout editor">
      <strong>Layout edit</strong>
      <span>Drag from panel header · resize bottom-right · 4px snap{testStatus ? ` · ${testStatus}` : ""}</span>
      <button type="button" onClick={exportContract}>Export JSON</button>
      <button type="button" onClick={resetCurrent}>Reset route</button>
      <button type="button" onClick={() => { persistCurrent(); setActive(false); }}>Done</button>
    </div>
  );
}
