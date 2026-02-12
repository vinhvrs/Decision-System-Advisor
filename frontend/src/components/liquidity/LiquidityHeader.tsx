import { Search, Filter } from "lucide-react";

export default function LiquidityHeader() {
  return (
    <div className="max-w-7xl mx-auto mb-8 flex justify-between">
      <div>
        <h1 className="text-4xl font-black text-white mb-2">
          Market Liquidity
        </h1>
        <p className="text-gray-500 text-sm">
          Top companies by trading liquidity
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Search ticker..."
            className="bg-[#131722] border border-gray-800 rounded-lg pl-9 pr-4 py-2"
          />
        </div>

        <button className="bg-[#131722] border border-gray-800 p-2 rounded-lg">
          <Filter size={18}/>
        </button>
      </div>
    </div>
  );
}
