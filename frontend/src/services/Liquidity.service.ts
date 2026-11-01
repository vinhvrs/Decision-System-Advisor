/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";
class LiquidityService {

  async fetchLiquidityTop() {

    const res = await api.get("/liquidity/top");

    // axios đã parse JSON
    const obj = res.data?.data ?? {};

    return Object.entries(obj).map(([symbol, liq]: any, i) => ({
      rank: i + 1,
      ticker: symbol,
      name: symbol + " Corp", // tạm
      price: (Math.random() * 500 + 100).toFixed(2),
      change: (Math.random() * 10 - 5).toFixed(2),
      volume: (Number(liq) / 1e9).toFixed(2) + "B",
      marketCap: (Math.random() * 3 + 0.5).toFixed(2) + "T",
      scores: [
        { subject: 'Growth', value: 60 },
        { subject: 'Value', value: 55 },
        { subject: 'Health', value: 70 },
        { subject: 'Dividend', value: 40 },
        { subject: 'Liquidity', value: 90 },
        { subject: 'Sentiment', value: 65 },
      ]
    }));
  }
}

const liquidityService = new LiquidityService();
export default liquidityService;