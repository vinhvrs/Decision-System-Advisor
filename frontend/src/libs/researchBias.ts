import type { BeginnerBoardRow } from "@/src/services/Beginner.service";

/**
 * Internal research-bias keys. Values stay compatible with legacy UI branches,
 * while all user-facing copy uses Bullish / Bearish terminology.
 */
export type ResearchBiasKey =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell"
  | "unrated";

export function isBeginnerRowEligibleForBias(row: BeginnerBoardRow): boolean {
  if (row.analysis_eligible === false) return false;
  if (
    row.data_state === "missing" ||
    row.data_state === "partial" ||
    row.data_state === "synthetic"
  ) {
    return false;
  }

  const scores = row.scores;
  const scoreValues = [
    scores?.reputation,
    scores?.price_period,
    scores?.candle_change,
    scores?.volume,
    scores?.liquidity,
    scores?.people_care,
  ].map((value) => Number(value));
  const strong = Number(row.strong_count);

  return (
    scoreValues.length === 6 &&
    scoreValues.every((value) => Number.isFinite(value) && value >= 1 && value <= 5) &&
    Number.isFinite(strong) &&
    strong >= 0 &&
    strong <= 5 &&
    Array.isArray(row.radar) &&
    row.radar.length >= 5
  );
}

function radarScoresAverage(row: BeginnerBoardRow): number {
  const scores = row.scores;
  const parts = [
    scores.reputation,
    scores.price_period,
    scores.candle_change,
    scores.volume,
    scores.liquidity,
    scores.people_care,
  ].map(Number);

  return parts.reduce((sum, value) => sum + value, 0) / parts.length;
}

/**
 * Canonical five-tier multi-factor research bias.
 *
 * IMPORTANT: thresholds and weights intentionally match the previously
 * validated Market View implementation. Do not change them as part of UI work.
 */
export function researchBiasFromRow(row: BeginnerBoardRow): ResearchBiasKey {
  if (!isBeginnerRowEligibleForBias(row)) return "unrated";

  const strong = Math.max(0, Math.min(5, Math.round(Number(row.strong_count)) || 0));
  const average = radarScoresAverage(row);
  const indicatorTilt = (strong - 2.5) * 1.25 + (average - 3) * 1.1;

  if (indicatorTilt >= 2.2) return "strong_buy";
  if (indicatorTilt >= 0.8) return "buy";
  if (indicatorTilt <= -2.2) return "strong_sell";
  if (indicatorTilt <= -0.8) return "sell";
  return "hold";
}

export function researchBiasSortOrder(bias: ResearchBiasKey): number {
  switch (bias) {
    case "strong_buy":
      return 4;
    case "buy":
      return 3;
    case "hold":
      return 2;
    case "sell":
      return 1;
    case "strong_sell":
      return 0;
    case "unrated":
    default:
      return -1;
  }
}

export function researchBiasLabel(bias: ResearchBiasKey): string {
  switch (bias) {
    case "strong_buy":
      return "Strong Bullish";
    case "buy":
      return "Bullish";
    case "hold":
      return "Neutral";
    case "sell":
      return "Bearish";
    case "strong_sell":
      return "Strong Bearish";
    case "unrated":
    default:
      return "Not Rated";
  }
}

export function researchBiasTitle(bias: ResearchBiasKey): string {
  switch (bias) {
    case "strong_buy":
      return "Strong Bullish — the multi-factor indicator composite has a materially positive tilt. Research signal, not investment advice.";
    case "buy":
      return "Bullish — the multi-factor indicator composite has a positive tilt. Research signal, not investment advice.";
    case "hold":
      return "Neutral — the multi-factor indicator composite is balanced or mixed. Research signal, not investment advice.";
    case "sell":
      return "Bearish — the multi-factor indicator composite has a negative tilt. Research signal, not investment advice.";
    case "strong_sell":
      return "Strong Bearish — the multi-factor indicator composite has a materially negative tilt. Research signal, not investment advice.";
    case "unrated":
    default:
      return "Not Rated — required ranking/radar inputs are incomplete or synthetic.";
  }
}
