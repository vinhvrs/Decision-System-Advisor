/* eslint-disable @typescript-eslint/no-explicit-any */
import LiquidityRow from "./LiquidityRow";

export default function LiquidityTable({ data, onHover }: any) {

  return (
    <div className="max-w-7xl mx-auto bg-[#131722] border border-gray-800 rounded-2xl overflow-hidden">

      <table className="w-full">
        <thead>
          <tr className="bg-[#1c212d] text-gray-400 text-xs uppercase">
            <th className="px-6 py-5">Rank</th>
            <th className="px-6 py-5">Symbol</th>
            <th className="px-6 py-5 text-right text-blue-400">
              Liquidity
            </th>
          </tr>
        </thead>

        <tbody>
          {data.map((row: any) => (
            <LiquidityRow
              key={row.symbol}
              row={row}
              onHover={onHover}
            />
          ))}
        </tbody>

      </table>
    </div>
  );
}
