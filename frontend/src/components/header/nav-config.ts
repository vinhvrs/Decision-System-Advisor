/** Static research-workspace navigation metadata. */
export const SITE_NAV_LINKS = [
  { label: "Markets", href: "/" },
  { label: "Screener", href: "/screener" },
  { label: "Companies", href: "/companies" },
  { label: "Research", href: "/investing" },
  { label: "Indicators", href: "/indicators" },
  { label: "News", href: "/news" },
  { label: "Documents", href: "/documents" },
] as const;

/** Paths that should highlight a nav item (e.g. legacy routes merged into one workspace). */
export const SITE_NAV_ACTIVE_ALIASES: Record<string, string[]> = {
  "/screener": ["/screener", "/instrument"],
  "/companies": ["/companies", "/stock-profile"],
  "/investing": ["/investing", "/trading"],
  "/indicators": ["/indicators", "/analysis", "/strategy"],
};
