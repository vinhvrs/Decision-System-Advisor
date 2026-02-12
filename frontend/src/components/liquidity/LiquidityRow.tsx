/* eslint-disable @typescript-eslint/no-explicit-any */
export default function LiquidityRow({ row, onHover }: any) {

  return (
    <tr
      className="hover:bg-[#1e222d] cursor-pointer"
      onMouseEnter={() => onHover(row)}
      onMouseLeave={() => onHover(null)}
    >
      <td className="px-6 py-5 text-gray-500 font-mono">
        #{row.rank}
      </td>

      <td className="px-6 py-5 text-white font-bold">
        {row.symbol}
      </td>

      <td className="px-6 py-5 text-right font-bold text-blue-400">
        {row.liquidity.toLocaleString()}
      </td>
    </tr>
  );
}
