export type PaperPositionSide = "flat" | "long" | "short";

export type PaperTradeRow = {
  id: string;
  timeSec: number;
  price: number;
  side: "buy" | "sell";
  volume: number;
  leverage: number;
};

export type PaperTradingSnapshot = {
  position: {
    side: PaperPositionSide;
    qty: number;
    avgPrice: number;
    leverage?: number;
  };
  trades: PaperTradeRow[];
  marketPrice: number | null;
  unrealizedPnl: number;
};
