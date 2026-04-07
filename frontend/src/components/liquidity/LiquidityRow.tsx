/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LiquidityRow({ row, onHover }: any) {
  const router = useRouter();
  const sym = String(row.symbol || "").toLowerCase();
  return (
    <tr
      className="hover:bg-[#1e222d] cursor-pointer"
      onMouseEnter={() => onHover(row)}
      onMouseLeave={() => onHover(null)}
      onClick={() => router.push(`/companies/profile/${sym}`)}
    >
      <td className="px-6 py-5 text-gray-500 font-mono">
        #{row.rank}
      </td>

      <td className="px-6 py-5 text-white font-bold">
        <Link
          href={`/companies/profile/${sym}`}
          className="hover:text-blue-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.symbol}
        </Link>
      </td>

      <td className="px-6 py-5 text-right font-bold text-blue-400">
        {row.liquidity.toLocaleString()}
      </td>
    </tr>
  );
}
