import { Loader2 } from "lucide-react";

export default function AdminSectionLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-white/60">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden />
      <span>Loading…</span>
    </div>
  );
}
