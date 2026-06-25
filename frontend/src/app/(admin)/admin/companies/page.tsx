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
    <div>
      <h1 className="text-2xl font-bold mb-2">Company / Symbol Management</h1>
      <p className="mb-6 text-sm text-white/50">
        Demo universe only — symbols from the resolved instruments table (
        <span className="font-mono text-white/70">instrument_demo</span> when{" "}
        <span className="font-mono text-white/70">DEV_MODE=dev</span>)
        (10 US tech names). Search and pagination apply within this set.
      </p>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by symbol or company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchCompanies(1, search)}
          className="px-4 py-2 rounded-lg bg-[#161D2C] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-w-[250px]"
        />
        <button
          onClick={() => fetchCompanies(1, search)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
        >
          Search
        </button>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#161D2C]">
        {loading ? (
          <div className="p-12 text-center text-white/60 flex items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-white/60">
                  <th className="p-4 font-medium">Symbol</th>
                  <th className="p-4 font-medium">Company Name</th>
                  <th className="p-4 font-medium">Industry</th>
                  <th className="p-4 font-medium">Sector</th>
                  <th className="p-4 font-medium">Exchange</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={`${String(c.symbol || "").toUpperCase()}-${c.exchange ?? "na"}`}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-4 font-mono font-bold">
                      <Link
                        href={`/companies/profile/${String(c.symbol || "").toLowerCase()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {c.symbol}
                      </Link>
                    </td>
                    <td className="p-4">{c.company_name}</td>
                    <td className="p-4">{c.industry ?? "—"}</td>
                    <td className="p-4">{c.sector ?? "—"}</td>
                    <td className="p-4">{c.exchange ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={pagination.current_page <= 1}
            onClick={() => fetchCompanies(pagination.current_page - 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/60">
            {pagination.current_page} / {pagination.last_page}
          </span>
          <button
            disabled={pagination.current_page >= pagination.last_page}
            onClick={() => fetchCompanies(pagination.current_page + 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
