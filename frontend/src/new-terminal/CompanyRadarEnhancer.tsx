"use client";

import { useEffect } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const SNAPSHOT_SELECTOR = '[data-layout-key="company:snapshot"]';

type Metric = { label: string; value: string };
type LabelPosition = {
  x: number;
  y: number;
  hitX: number;
  hitY: number;
  anchor: "start" | "middle" | "end";
};

// The radar viewBox is 236 x 208. Labels sit just outside each of the six
// outer vertices and extend inward so long titles stay inside the plotting area.
const LABEL_POSITIONS: readonly LabelPosition[] = [
  { x: 118, y: 12, hitX: 118, hitY: 28, anchor: "middle" },
  { x: 224, y: 54, hitX: 184, hitY: 66, anchor: "end" },
  { x: 224, y: 158, hitX: 184, hitY: 142, anchor: "end" },
  { x: 118, y: 201, hitX: 118, hitY: 180, anchor: "middle" },
  { x: 12, y: 158, hitX: 52, hitY: 142, anchor: "start" },
  { x: 12, y: 54, hitX: 52, hitY: 66, anchor: "start" },
];

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function readMetrics(table: HTMLTableElement): Metric[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))
    .slice(0, LABEL_POSITIONS.length)
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
  if (metrics.length !== LABEL_POSITIONS.length) return;

  const signature = metrics.map((metric) => `${metric.label}:${metric.value}`).join("|");
  if (
    svg.dataset.axisLabelsSignature === signature
    && svg.querySelector(".nt-radar-axis-label-layer")
  ) return;

  svg.querySelector(".nt-radar-axis-label-layer")?.remove();
  table.classList.add("nt-radar-values-source");
  table.setAttribute("aria-hidden", "true");

  const tooltip = ensureTooltip(wrap);
  tooltip.hidden = true;
  tooltip.textContent = "";

  const layer = svgElement("g");
  layer.setAttribute("class", "nt-radar-axis-label-layer");

  metrics.forEach((metric, index) => {
    const position = LABEL_POSITIONS[index];
    const group = svgElement("g");
    group.setAttribute("class", "nt-radar-axis-label");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "img");
    group.setAttribute("aria-label", `${metric.label}: ${metric.value}`);

    const hitArea = svgElement("circle");
    hitArea.setAttribute("class", "nt-radar-axis-label-hit");
    hitArea.setAttribute("cx", String(position.hitX));
    hitArea.setAttribute("cy", String(position.hitY));
    hitArea.setAttribute("r", "15");

    const label = svgElement("text");
    label.setAttribute("x", String(position.x));
    label.setAttribute("y", String(position.y));
    label.setAttribute("text-anchor", position.anchor);
    label.setAttribute("dominant-baseline", "middle");
    label.textContent = metric.label;

    const showValue = () => {
      tooltip.textContent = metric.value;
      tooltip.hidden = false;
      group.classList.add("is-active");
    };
    const hideValue = () => {
      tooltip.hidden = true;
      tooltip.textContent = "";
      group.classList.remove("is-active");
    };

    group.addEventListener("pointerenter", showValue);
    group.addEventListener("pointerleave", hideValue);
    group.addEventListener("focus", showValue);
    group.addEventListener("blur", hideValue);
    group.append(hitArea, label);
    layer.append(group);
  });

  svg.append(layer);
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
