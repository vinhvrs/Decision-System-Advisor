import pandas as pd

def wilder_rsi(close, period):
    values = [None] * len(close)
    if len(close) <= period:
        return pd.Series(values, index=close.index, dtype=float)
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    g, l = float(gain.iloc[1:period+1].mean()), float(loss.iloc[1:period+1].mean())
    for i in range(period, len(close)):
        if i > period:
            g = (g*(period-1)+float(gain.iloc[i]))/period
            l = (l*(period-1)+float(loss.iloc[i]))/period
        values[i] = 100*g/(g+l) if g+l else 50.0
    return pd.Series(values, index=close.index, dtype=float)

