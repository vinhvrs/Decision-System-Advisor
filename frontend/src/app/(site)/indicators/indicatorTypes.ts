export type SimulatorIndicatorId =
  | 'ls'
  | 'vol'
  | 'adx'
  | 'mfi'
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'macd'
  | 'bb'
  | 'stoch';

export function cardIdToSimulator(id: number): SimulatorIndicatorId {
  switch (id) {
    case 1:
      return 'ls';
    case 2:
      return 'vol';
    case 3:
      return 'adx';
    case 4:
      return 'mfi';
    default:
      return 'ls';
  }
}
