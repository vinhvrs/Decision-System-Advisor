"use client";

import { useEffect } from "react";

const SNAPSHOT_SELECTOR = '[data-layout-key="company:snapshot"]';
const RADAR_VIEWBOX = "42 18 152 172";

type Metric = { label: string; value: string };

function readMetrics(table: HTMLTableElement): Metric[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))
    .slice(0, 6)
    .map((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>("td");
      return {
        label: cells[0]?.textContent?.trim() ?? "",
        value: cells[1]?.textContent?.trim() || "—",
      };
    })
    .filter((metric) => metric.label);
}

function ensureTooltip(wrap: HTMLElement): HTMLDivElement {
  const existing = wrap.querySelector<HTMLDivElement>(":scope > .nt-radar-hover-value");
  if (existing) return existing;

  const tooltip = document.createElement("div");
  tooltip.className = "nt-radar-hover-value";
  tooltip.hidden = true;
  tooltip.setAttribute("role", "status");
  tooltip.setAttribute("aria-live", "polite");
  wrap.append(tooltip);
  return tooltip;
}

function enhanceSnapshot(snapshot: HTMLElement) {
  const wrap = snapshot.querySelector<HTMLElement>(":scope > .nt-radar-wrap");
  const svg = wrap?.querySelector<SVGSVGElement>("svg.nt-radar");
  const table = wrap?.querySelector<HTMLTableElement>("table.nt-radar-values");
  if (!wrap || !svg || !table) return;

  const metrics = readMetrics(table);
  if (metrics.length !== 6) return;

  const signature = metrics.map((metric) => `${metric.label}:${metric.value}`).join("|");
  const existingLayer = wrap.querySelector<HTMLElement>(":scope > .nt-radar-axis-label-layer");
  if (
    svg.dataset.axisLabelsSignature === signature
    && existingLayer
    && svg.getAttribute("viewBox") === RADAR_VIEWBOX
    && svg.getAttribute("preserveAspectRatio") === "none"
  ) return;

  // Use the actual plot bounds rather than the original padded SVG bounds.
  // preserveAspectRatio="none" lets the chart grow with both card dimensions;
  // labels live in HTML so their typography stays crisp and undistorted.
  svg.setAttribute("viewBox", RADAR_VIEWBOX);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.querySelector(".nt-radar-axis-label-layer")?.remove();
  existingLayer?.remove();

  table.classList.add("nt-radar-values-source");
  table.setAttribute("aria-hidden", "true");

  const tooltip = ensureTooltip(wrap);
  tooltip.hidden = true;
  tooltip.textContent = "";

  const layer = document.createElement("div");
  layer.className = "nt-radar-axis-label-layer";

  metrics.forEach((metric, index) => {
    const label = document.createElement("button");
    label.type = "button";
    label.className = "nt-radar-axis-label";
    label.dataset.axis = String(index);
    label.textContent = metric.label;
    label.setAttribute("aria-label", `${metric.label}: ${metric.value}`);

    const showValue = () => {
      tooltip.textContent = metric.value;
      tooltip.hidden = false;
      label.classList.add("is-active");
    };
    const hideValue = () => {
      tooltip.hidden = true;
      tooltip.textContent = "";
      label.classList.remove("is-active");
    };

    label.addEventListener("pointerenter", showValue);
    label.addEventListener("pointerleave", hideValue);
    label.addEventListener("focus", showValue);
    label.addEventListener("blur", hideValue);
    layer.append(label);
  });

  wrap.append(layer);
  svg.dataset.axisLabelsSignature = signature;
}

export default function CompanyRadarEnhancer() {
  useEffect(() => {
    let frame = 0;

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document
          .querySelectorAll<HTMLElement>(SNAPSHOT_SELECTOR)
          .forEach(enhanceSnapshot);
      });
    };

    schedule();

    const observer = new MutationObserver((mutations) => {
      const onlyEnhancerChanges = mutations.every((mutation) => {
        const element = mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
        return Boolean(element?.closest(".nt-radar-axis-label-layer, .nt-radar-hover-value"));
      });
      if (!onlyEnhancerChanges) schedule();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
