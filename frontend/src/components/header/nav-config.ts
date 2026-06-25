/** Static nav metadata — defined once so it is not recreated on every Header render. */
export const SITE_NAV_LINKS = [
  { label: "News", href: "/news" },
  { label: "Screener", href: "/screener" },
  { label: "Investing", href: "/investing" },
  { label: "Indicators", href: "/indicators" },
  { label: "Documents", href: "/documents" },
  { label: "Contact", href: "/contact" },
] as const;

/** Paths that should highlight a nav item (e.g. legacy routes merged into one tab). */
export const SITE_NAV_ACTIVE_ALIASES: Record<string, string[]> = {
  "/screener": ["/screener", "/instrument"],
  "/investing": ["/investing", "/trading"],
  "/indicators": ["/indicators", "/analysis", "/strategy"],
};
