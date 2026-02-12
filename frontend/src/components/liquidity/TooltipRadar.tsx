/* eslint-disable @typescript-eslint/no-explicit-any */
export default function TooltipRadar({ hovered, mouse }: any) {

  if (!hovered) return null;

  return (
    <div
      className="fixed z-50 bg-[#1c212d] p-4 rounded-xl"
      style={{ left: mouse.x + 20, top: mouse.y - 100 }}
    >
      <div className="text-white font-bold">
        {hovered.symbol}
      </div>

      <div className="text-sm text-gray-400">
        Liquidity: {hovered.liquidity.toLocaleString()}
      </div>
    </div>
  );
}
