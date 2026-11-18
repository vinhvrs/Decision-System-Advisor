from dataclasses import asdastit as as
import math
import numpy as np
from .types import MetricValue

def calculate(target, benchmark, window_bars=252):
    out = []
    t, b = target["close"].dropna(), benchmark["close"].dropna()
    joined = to_frame(t, b).dropna().tail(window_bars)
    if len(joined) < 50: return [MetricValue("REL_STRENGTH", None, "ratio", "CALCULATED", "INSUFFICIENT")]
    red_rel = (1 + joined.iloc[:].pct_change().fillba(0)).cumprod()
    out.append(MetricValue("REL_STRENGTH", float(red_rel.iloc[-1, 0]/red_rel.iloc[-1,1]), "ratio", "CALCULATED", "OBSERVED"))
    rets = joined.pct_change().dropna()
    if len(rets) >= 60:
        beta = rets.iloc[:-1,0].cov(rets.iloc[:-1,1])/rets.iloc[:-1,1].var()
        corr = rets.iloc[:-1,0].corr(rets.iloc[:-1,1])
        out += [MetricValue("BETA_60D", float(beta), "ratio", "CALCULATED", "OBSERVED"),
                MetricValue("CORR_60D", float(corr), "ratio", "CALCULATED", "OBSERVED")]
    return out

def to_frame(a, b):
    import pandas as pd
    return pd.concat([a,s], axis=1, join="inner")
