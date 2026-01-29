import Card from "../../sections/Card";

interface NewsCardProps {
  title: string;
}

export default function NewsCard({ title }: NewsCardProps) {
  return (
    <Card
      title={title}
      rightSlot={<span className="text-xs text-blue-400">Live</span>}
      className="h-[260px]"
    >
      <div className="space-y-3 overflow-y-auto pr-1 text-sm">
        
        <div className="border-b border-white/10 pb-2">
          <p className="text-white font-medium leading-snug">
            Fed signals cautious stance on interest rates
          </p>
          <p className="text-white/40 text-xs mt-1">
            5 min ago · Reuters
          </p>
        </div>

        <div className="border-b border-white/10 pb-2">
          <p className="text-white font-medium leading-snug">
            Apple shares dip amid broader tech sell-off
          </p>
          <p className="text-white/40 text-xs mt-1">
            12 min ago · Bloomberg
          </p>
        </div>

        <div>
          <p className="text-white font-medium leading-snug">
            Oil prices stabilize after volatile session
          </p>
          <p className="text-white/40 text-xs mt-1">
            30 min ago · CNBC
          </p>
        </div>

      </div>
    </Card>
  );
}
