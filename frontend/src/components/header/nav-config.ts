/** Static nav metadata — defined once so it is not recreated on every Header render. */
export const SITE_NAV_LINKS = [
  { label: "Search", href: "/search" },
  { label: "News", href: "/news" },
  { label: "Company", href: "/companies" },
  { label: "Screener", href: "/instrument" },
  { label: "Investing", href: "/trading" },
  { label: "Indicators", href: "/indicators" },
  { label: "Strategy", href: "/strategy" },
  { label: "Documents", href: "/documents" },
  { label: "Contact", href: "/contact" },
] as const;
