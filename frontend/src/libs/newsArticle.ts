/** Helpers for `knowledge_docs` rows returned by `/news` APIs. */

export function normalizeNewsListResponse(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: any[] }).data;
  }
  return [];
}

export type NewsHref = { kind: "external" | "internal"; href: string };

export function resolveNewsHref(item: {
  id?: string;
  source?: string | null;
}): NewsHref {
  const src = typeof item.source === "string" ? item.source.trim() : "";
  if (src && /^https?:\/\//i.test(src)) {
    return { kind: "external", href: src };
  }
  if (item.id) {
    return { kind: "internal", href: `/news/${encodeURIComponent(item.id)}` };
  }
  return { kind: "internal", href: "#" };
}

export function newsSourceLabel(item: { source?: string | null; author?: string | null }): string {
  if (item.source) {
    try {
      return new URL(item.source).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  const a = item.author?.trim();
  if (a) return a;
  return "News";
}

export function pickNewsThumbImage(item: { image?: string | null; content?: string | null }): string | null {
  const fromCol = item.image?.trim();
  if (fromCol && fromCol !== "null") return fromCol;
  const imgPrefix = "Image URL: ";
  const c = item.content || "";
  if (c.startsWith(imgPrefix)) {
    const line = c.split("\n\n")[0]?.replace(imgPrefix, "").trim();
    if (line && line !== "null") return line;
  }
  return null;
}
