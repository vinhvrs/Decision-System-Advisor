import type { SimulatorIndicatorId } from '../indicators/indicatorTypes';

export type StrategyId = 'liq_break' | 'conservative' | 'scalp' | 'mean_rev';

export type StrategyTradeCase = {
  label: string;
  when: string;
};

export type StrategyDef = {
  id: StrategyId;
  name: string;
  risk: 'Low' | 'Medium' | 'High';
  winRate: string;
  profit: string;
  tags: string[];
  description: string;
  /** Primary pane overlay / sub-pane in “indicator” explain mode */
  linkedIndicator: SimulatorIndicatorId;
  explainIndicator: string;
  /** How the six radar-style scores + F&G relate to this playbook */
  explainAttributes: string;
  /** Illustrative long-side checks (paper rules; not live execution) */
  buyCases: StrategyTradeCase[];
  /** Illustrative flat / exit checks */
  sellCases: StrategyTradeCase[];
};

export const STRATEGY_DEFINITIONS: StrategyDef[] = [
  {
    id: 'liq_break',
    name: 'Liquidity Breakout',
    risk: 'Medium',
    winRate: '68%',
    profit: '+12.5%',
    tags: ['Trend', 'Momentum'],
    description: 'Trades when Liquidity Score surges with price confirmation.',
    linkedIndicator: 'ls',
    explainIndicator:
      'Uses the same Liquidity Score (LS) lane as the indicator simulator: yellow score (0–100) and raw P×V on its own scale. A “breakout” read is when score pushes into the top quartile while candles print higher highs — here you only see the synthetic replay, not a live signal. The lower strip also shows hybrid MACD: SMA(fast) − EMA(slow), plus signal — so momentum agrees (or not) with liquidity.',
    explainAttributes:
      'On the beginner board, Liquidity and Volume spikes lift liquidity and volume spokes; Fear & Greed tilts with the day’s close-to-close move (50 + 3.25×r, clamped). Reputation and People care reward green sessions and participation. This strategy conceptually wants high liquidity + volume with supportive F&G, not extreme fear spikes alone. In 6 + F&G view the six scores and F&G line sit on the main chart (0–100 overlay); hybrid MACD is hidden there but still drives the illustrative buy/sell arrows.',
    buyCases: [
      {
        label: 'Liquidity thrust + MACD firming',
        when:
          'LS score pushes into the top band (e.g. >80) on rising P×V while hybrid MACD histogram crosses from negative to positive (fast SMA pulling above slow EMA) and the candle closes strong.',
      },
      {
        label: 'Trend resume after shallow dip',
        when:
          'Score held elevated, price dips to short-term mean but LS never collapses; MACD line crosses back above signal while breadth-style attributes (volume + liquidity spokes) stay elevated.',
      },
    ],
    sellCases: [
      {
        label: 'Score rolls over',
        when:
          'LS score falls sharply from an extended high while MACD line crosses below signal — treat as momentum loss even if price is still up (illustrative exit / de-risk).',
      },
      {
        label: 'False breakout',
        when:
          'Price spikes but LS fails to confirm (score flat/down) and hybrid MACD prints a lower high — narrative “no participation” fade.',
      },
    ],
  },
  {
    id: 'conservative',
    name: 'Conservative Growth',
    risk: 'Low',
    winRate: '75%',
    profit: '+4.2%',
    tags: ['Stable', 'Long-term'],
    description: 'Favors steady money flow without chasing extremes.',
    linkedIndicator: 'mfi',
    explainIndicator:
      'MFI combines price and volume in one oscillator (0–100). The conservative read looks for MFI drifting up through the mid-range without long stays above 80 — smooth flow rather than blow-off tops. Hybrid MACD on its own scale helps confirm that the SMA/EMA spread is building, not spiking and dying.',
    explainAttributes:
      'Price period and Reputation scores trending up slowly — with Fear & Greed mostly Neutral to Greed — match a “don’t fight the tape gently” stance. Volume and Liquidity should confirm interest without single-bar exhaustion (very high candle-change spoke). In 6 + F&G view the board overlay is on the main chart; MACD is hidden but still used for arrow logic.',
    buyCases: [
      {
        label: 'Orderly MFI lift',
        when:
          'MFI crosses above 50 from below, stays under ~75, and hybrid MACD line is above signal with histogram mostly ≥ 0 — “accumulation without euphoria.”',
      },
      {
        label: 'Post-reset re-entry',
        when:
          'MFI dipped to the 40s on a mild pullback, F&G not in extreme fear; MACD turns up from a shallow negative pocket while MFI turns higher.',
      },
    ],
    sellCases: [
      {
        label: 'Overbought + MACD roll',
        when:
          'MFI lingers above ~80 and MACD line crosses below signal — reduce exposure in the playbook story even if price grinds (illustrative).',
      },
      {
        label: 'Flow divergence',
        when:
          'MFI makes a lower high while price makes a higher high, and hybrid MACD histogram shrinks — volume-supported trend may be weakening.',
      },
    ],
  },
  {
    id: 'scalp',
    name: 'Aggressive Scalping',
    risk: 'High',
    winRate: '54%',
    profit: '+28.1%',
    tags: ['Fast', 'Scalp'],
    description: 'Short holding periods; reacts to fast oscillators and vol spikes.',
    linkedIndicator: 'stoch',
    explainIndicator:
      'Stochastic %K / %D highlights short-term overbought/oversold swings. Scalping-style logic watches rapid crossbacks from the edges — the chart uses the same fixed synthetic candles as everywhere else on the site. Hybrid MACD filters for very short trend impulse in the same window.',
    explainAttributes:
      'High Candle change and Volume spokes with choppy Fear & Greed (quick moves in the 0–100 strip) mirror fast markets. Liquidity must stay supportive so fills aren’t imaginary; People care rises when activity clusters. This is illustrative — real scalping needs latency and fees you don’t see here. In 6 + F&G view MACD is not drawn; arrows still combine stoch-style rules with hybrid MACD behind the scenes.',
    buyCases: [
      {
        label: 'Oversold bounce + MACD flip',
        when:
          '%K crosses up through %D from under ~20 while hybrid MACD histogram flips positive within a bar or two — quick long bias for the playbook narrative.',
      },
      {
        label: 'Pop & hold',
        when:
          'Stoch clears 50 with both lines rising and MACD line above signal; use as a “continuation scalp” illustration (tight risk in reality).',
      },
    ],
    sellCases: [
      {
        label: 'Overbought cross down',
        when:
          '%K crosses down through %D from above ~80, especially if MACD line crosses below signal — illustrative take-profit / stop for the fast playbook.',
      },
      {
        label: 'MACD failure',
        when:
          'Stoch is still elevated but hybrid MACD prints a sharp negative histogram bar — fade or exit the scalp story as impulse dies.',
      },
    ],
  },
  {
    id: 'mean_rev',
    name: 'Mean Reversion',
    risk: 'Medium',
    winRate: '62%',
    profit: '+8.9%',
    tags: ['Oscillator', 'Reversion'],
    description: 'Looks for stretched price versus a middle band (RSI-style context in prose).',
    linkedIndicator: 'bb',
    explainIndicator:
      'Bollinger mid/upper/lower bands plot on the candle pane. Mean-reversion stories often pair tag extremes at the bands with RSI-style logic in words; the sub-pane adds hybrid MACD so you see whether the SMA/EMA spread is exhausted at the same time as the tag.',
    explainAttributes:
      'Price period spoke stretched away from neutral while Fear & Greed hits an extreme often precedes reversion narratives in plain language. Reputation softening (fewer green closes) plus elevated Candle change can mean volatility cluster — the six attributes are the same axes as the beginner radar, plus F&G as a line on the main-chart overlay. MACD is hidden in this view but still informs the arrows.',
    buyCases: [
      {
        label: 'Lower band washout',
        when:
          'Close tags / pierces the lower Bollinger band, F&G is Fear or colder, and hybrid MACD histogram starts curling up from a pronounced negative — illustrative “snap back” long.',
      },
      {
        label: 'Band squeeze resolution',
        when:
          'Bands were narrow (volatility compression), first expansion candle down fails; MACD line crosses above signal while price reclaims the mid-band — contrarian bounce setup in story form.',
      },
    ],
    sellCases: [
      {
        label: 'Upper band stretch',
        when:
          'Close rides the upper band, F&G in Greed+, MACD line crosses below signal — illustrative short / trim into euphoria.',
      },
      {
        label: 'Failed breakdown bounce',
        when:
          'Price bounced from the lower band but MACD fails to get above signal and mid-band is lost again — story “reversion didn’t stick.”',
      },
    ],
  },
];

export function strategyById(id: StrategyId): StrategyDef | undefined {
  return STRATEGY_DEFINITIONS.find((s) => s.id === id);
}
