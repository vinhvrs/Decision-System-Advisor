/**
 * Demo / dev dataset mode: smaller symbol lists and local IndexedDB seed for faster UI.
 * Set `DEV_MODE=dev` in `.env.local` (exposed as `NEXT_PUBLIC_DEV_MODE` via next.config).
 */
export function isDemoDevMode(): boolean {
  const raw = (process.env.NEXT_PUBLIC_DEV_MODE ?? "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "prod" || raw === "production" || raw === "false" || raw === "0") return false;
  return raw === "dev" || raw === "true" || raw === "1" || raw === "yes" || raw === "demo";
}
