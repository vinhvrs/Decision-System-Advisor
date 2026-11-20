"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { AdminService } from "@/src/services/Admin.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { Loader2 } from "lucide-react";

type Company = {
  instrument_id?: string;
  symbol: string;
  company_name: string;
  industry?: string;
  sector?: string;
  exchange?: string;
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  /** Last search term used for the current result set (pagination + instant Search/Enter). */
  const appliedSearchRef = useRef("");

  const fetchCompanies = useCallback(async (page = 1, searchTerm?: string) => {
    const raw = searchTerm !== undefined ? searchTerm : appliedSearchRef.current;
    const term = raw.trim() || undefined;
    setLoading(true);
    try {
      const res = await AdminService.companies.list({
        page,
        per_page: 25,
        search: term,
      });
      setCompanies(res.data ?? []);
      setPagination({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
      });
      appliedSearchRef.current = raw.trim();
    } catch (e) {
      console.error(e);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies(1, debouncedSearch);
  }, [debouncedSearch, fetchCompanies]);

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Market data</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">Company / symbol management</h1>
          <p className="mt-0.5 max-w-3xl truncate text-[10px] text-[var(--dsa-text-muted)]">
            Resolved instrument universe; search and pagination stay inside the configured admin dataset.
          </p>
        </div>
        <div className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
          Page {pagination.current_page}/{pagination.last_page}
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <input
            type="text"
            placeholder="Filter symbol / company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCompanies(1, search)}
            className="dsa-control h-7 min-h-0 w-[280px] max-w-[65vw] px-2.5 text-[11px] outline-none"
          />
          <button
            type="button"
            onClick={() => fetchCompanies(1, search)}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[11px]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
            <Loader2 size={15} className="animate-spin" />
            Loading companies…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dsa-terminal-table min-w-[820px]">
              <thead>
                <tr>
                  <th className="text-left">Symbol</th>
                  <th className="text-left">Company</th>
                  <th className="text-left">Industry</th>
                  <th className="text-left">Sector</th>
                  <th className="text-left">Exchange</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={`${String(company.symbol || "").toUpperCase()}-${company.exchange ?? "na"}`}>
                    <td>
                      <Link
                        href={`/companies/profile/${String(company.symbol || "").toLowerCase()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-semibold text-[#8ab4ff] hover:underline"
                      >
                        {company.symbol}
                      </Link>
                    </td>
                    <td className="font-medium text-white">{company.company_name}</td>
                    <td className="text-[var(--dsa-text-secondary)]">{company.industry ?? "—"}</td>
                    <td className="text-[var(--dsa-text-secondary)]">{company.sector ?? "—"}</td>
                    <td className="font-mono text-[var(--dsa-text-muted)]">{company.exchange ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--dsa-border)] px-3 py-2">
            <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.current_page <= 1}
                onClick={() => fetchCompanies(pagination.current_page - 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => fetchCompanies(pagination.current_page + 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
