"""
Normalize SEC companyfacts JSON into annual / quarterly metric rows.

SEC is source of truth; missing tags resolve via aliases. All math is defensive (no crash on None).
"""
from __future__ import annotations

import logging
import math
from collections import defaultdict
from typing import Any, Iterable

logger = logging.getLogger(__name__)


def _f(v: Any) -> float | None:
    if v is None:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    return x


def _us_gaap(companyfacts: dict[str, Any]) -> dict[str, Any]:
    return (((companyfacts or {}).get("facts") or {}).get("us-gaap") or {}) or {}


def _facts_namespace(companyfacts: dict[str, Any], ns: str) -> dict[str, Any]:
    return (((companyfacts or {}).get("facts") or {}).get(ns) or {}) or {}


def _collapse_annual_latest_filed(points: Iterable[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    """Group by fiscal year; keep row with latest *filed* date for annual statements."""
    buckets: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for p in points:
        if not isinstance(p, dict):
            continue
        fy = p.get("fy")
        if fy is None:
            continue
        try:
            fy_i = int(fy)
        except (TypeError, ValueError):
            continue
        fp = (p.get("fp") or "").strip().upper()
        form = (p.get("form") or "").upper()
        if fp != "FY" and not (fp in ("", "CY") and form.startswith("10-K")):
            continue
        if p.get("val") is None:
            continue
        buckets[fy_i].append(p)
    out: dict[int, dict[str, Any]] = {}
    for fy, pts in buckets.items():
        best = max(pts, key=lambda x: str(x.get("filed") or ""))
        out[fy] = best
    return out


def _collapse_quarter_latest_filed(points: Iterable[dict[str, Any]]) -> dict[tuple[int, str], dict[str, Any]]:
    buckets: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    for p in points:
        if not isinstance(p, dict):
            continue
        fy = p.get("fy")
        fp = (p.get("fp") or "").strip().upper()
        if fy is None or fp not in {"Q1", "Q2", "Q3", "Q4"}:
            continue
        if p.get("val") is None:
            continue
        try:
            fy_i = int(fy)
        except (TypeError, ValueError):
            continue
        buckets[(fy_i, fp)].append(p)
    out: dict[tuple[int, str], dict[str, Any]] = {}
    for key, pts in buckets.items():
        best = max(pts, key=lambda x: str(x.get("filed") or ""))
        out[key] = best
    return out


def _revenue_tag_names() -> list[str]:
    """ASC 606 revenue tags first; legacy ``Revenues`` often has stale segment rows only."""
    return [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
        "Revenues",
    ]


def _equity_tag_names() -> list[str]:
    return [
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        "StockholdersEquity",
        "PartnersCapital",
        "PartnersCapitalAttributableToParent",
    ]


def _net_income_tag_names() -> list[str]:
    return [
        "NetIncomeLoss",
        "ProfitLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
        "NetIncomeLossAvailableToCommonStockholdersDiluted",
    ]


def _extract_series_from_tag_block(
    block: dict[str, Any],
    *,
    annual: bool,
) -> dict[int, float] | dict[tuple[int, str], float]:
    units = block.get("units") or {}
    if not isinstance(units, dict):
        return {}
    for unit_key in ("USD", "USD/shares", "shares", "pure"):
        arr = units.get(unit_key)
        if not isinstance(arr, list) or not arr:
            continue
        if annual:
            collapsed = _collapse_annual_latest_filed(arr)
            if collapsed:
                out: dict[int, float] = {}
                for fy_i, row in collapsed.items():
                    v = _f(row.get("val"))
                    if v is not None:
                        out[fy_i] = v
                if out:
                    return out
        else:
            collapsed = _collapse_quarter_latest_filed(arr)
            if collapsed:
                outq: dict[tuple[int, str], float] = {}
                for k, row in collapsed.items():
                    v = _f(row.get("val"))
                    if v is not None:
                        outq[k] = v
                if outq:
                    return outq
    return {}


def _series_score(series: dict[Any, float]) -> tuple[int, int, int]:
    """Prefer the tag whose series reaches the latest period (FY or FY+quarter), then coverage."""
    if not series:
        return (-1, -1, -1)
    sample = next(iter(series.keys()))
    if isinstance(sample, tuple):
        fy, fp = max(
            series.keys(),
            key=lambda k: (int(k[0]), _quarter_index(str(k[1]))),
        )
        return (int(fy), _quarter_index(str(fp)), len(series))
    return (max(series.keys()), 0, len(series))


def _series_for_tags(
    us_gaap: dict[str, Any],
    tag_names: list[str],
    annual: bool,
) -> dict[int, float] | dict[tuple[int, str], float]:
    best: dict[Any, float] = {}
    best_score = (-1, -1, -1)
    for tag in tag_names:
        block = us_gaap.get(tag)
        if not isinstance(block, dict):
            continue
        out = _extract_series_from_tag_block(block, annual=annual)
        if not out:
            continue
        score = _series_score(out)
        if score > best_score:
            best = out
            best_score = score
    return best


def _sum_series_dicts(dicts: list[dict[int, float]]) -> dict[int, float]:
    out: dict[int, float] = defaultdict(float)
    for d in dicts:
        for fy, v in d.items():
            if v is None:
                continue
            out[fy] += float(v)
    return dict(out)


def _fcf(ocf: float | None, capex: float | None) -> float | None:
    if ocf is None:
        return None
    if capex is None:
        return ocf
    # SEC cash-flow tags: CapEx outflows are usually negative.
    if capex <= 0:
        return ocf + capex
    return ocf - capex


def _safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    if b == 0:
        return None
    return a / b


def _cagr(values_by_fy: dict[int, float], end_fy: int, years: int) -> float | None:
    start_fy = end_fy - years
    end_v = values_by_fy.get(end_fy)
    start_v = values_by_fy.get(start_fy)
    if end_v is None or start_v is None:
        return None
    if start_v <= 0 or end_v <= 0 or years <= 0:
        return None
    try:
        return (end_v / start_v) ** (1.0 / years) - 1.0
    except (ArithmeticError, ValueError, ZeroDivisionError):
        return None


def _quarter_index(fp: str) -> int:
    m = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}
    return m.get(fp.upper(), 0)


def build_annual_tables(companyfacts: dict[str, Any]) -> list[dict[str, Any]]:
    us = _us_gaap(companyfacts)

    revenue = _series_for_tags(us, _revenue_tag_names(), True)
    net_income = _series_for_tags(us, _net_income_tag_names(), True)
    gross_profit = _series_for_tags(us, ["GrossProfit"], True)
    operating_income = _series_for_tags(us, ["OperatingIncomeLoss"], True)
    eps = _series_for_tags(us, ["EarningsPerShareDiluted"], True)
    assets = _series_for_tags(us, ["Assets"], True)
    liabilities = _series_for_tags(us, ["Liabilities"], True)
    equity = _series_for_tags(us, _equity_tag_names(), True)
    cash = _series_for_tags(
        us,
        [
            "CashAndCashEquivalentsAtCarryingValue",
            "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        ],
        True,
    )
    ltd = _series_for_tags(us, ["LongTermDebt", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"], True)
    ltd_cur = _series_for_tags(us, ["LongTermDebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent"], True)
    st_borrow = _series_for_tags(us, ["ShortTermBorrowings", "DebtCurrent"], True)
    debt_dicts = [d for d in (ltd, ltd_cur, st_borrow) if d]
    total_debt = _sum_series_dicts(debt_dicts) if debt_dicts else {}

    cur_assets = _series_for_tags(us, ["AssetsCurrent"], True)
    cur_liab = _series_for_tags(us, ["LiabilitiesCurrent"], True)
    inventory = _series_for_tags(us, ["InventoryNet"], True)
    ar = _series_for_tags(us, ["AccountsReceivableNetCurrent"], True)
    cogs = _series_for_tags(
        us,
        ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
        True,
    )
    ocf = _series_for_tags(us, ["NetCashProvidedByUsedInOperatingActivities"], True)
    capex = _series_for_tags(us, ["PaymentsToAcquirePropertyPlantAndEquipment"], True)
    interest = _series_for_tags(us, ["InterestExpense", "InterestAndDebtExpense"], True)
    dividends = _series_for_tags(
        us,
        ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
        True,
    )
    shares = _series_for_tags(
        us,
        [
            "EntityCommonStockSharesOutstanding",
            "WeightedAverageNumberOfDilutedSharesOutstanding",
        ],
        True,
    )
    dei = _facts_namespace(companyfacts, "dei")
    public_float_s = _series_for_tags(dei, ["EntityPublicFloat"], True)
    ebit = _series_for_tags(
        us,
        [
            "EarningsBeforeInterestAndTaxes",
            "OperatingIncomeLoss",
        ],
        True,
    )

    all_years = sorted(
        set(revenue)
        | set(net_income)
        | set(gross_profit)
        | set(operating_income)
        | set(assets)
        | set(liabilities)
        | set(equity),
    )

    rows: list[dict[str, Any]] = []
    equity_sorted = dict(sorted(((k, v) for k, v in equity.items()), key=lambda x: x[0]))
    assets_sorted = dict(sorted(((k, v) for k, v in assets.items()), key=lambda x: x[0]))

    for fy in all_years:
        rev = revenue.get(fy)
        ni = net_income.get(fy)
        gp = gross_profit.get(fy)
        oi = operating_income.get(fy)
        epsv = eps.get(fy)
        ast = assets.get(fy)
        liab = liabilities.get(fy)
        eq = equity.get(fy)
        csh = cash.get(fy)
        td = total_debt.get(fy)
        ca = cur_assets.get(fy)
        cl = cur_liab.get(fy)
        inv = inventory.get(fy)
        arv = ar.get(fy)
        cg = cogs.get(fy)
        ocfv = ocf.get(fy)
        capv = capex.get(fy)
        intv = interest.get(fy)
        div = dividends.get(fy)
        sh = shares.get(fy)
        pf = public_float_s.get(fy)
        ebit_v = ebit.get(fy)

        fcfv = _fcf(_f(ocfv), _f(capv))

        gm = _safe_div(gp, rev)
        om = _safe_div(oi, rev)
        nm = _safe_div(ni, rev)

        prev_fy = fy - 1
        eq_prev = equity_sorted.get(prev_fy)
        avg_eq = None
        if eq is not None and eq_prev is not None:
            avg_eq = (eq + eq_prev) / 2.0
        roe = _safe_div(ni, avg_eq) if avg_eq else _safe_div(ni, eq)

        de = _safe_div(td, eq) if td is not None and eq not in (None, 0) else None
        cr = _safe_div(ca, cl)

        ast_prev = assets_sorted.get(prev_fy)
        avg_ast = None
        if ast is not None and ast_prev is not None:
            avg_ast = (ast + ast_prev) / 2.0
        ato = _safe_div(rev, avg_ast) if avg_ast else _safe_div(rev, ast)

        dso = None
        if rev and arv and rev > 0:
            dso = (arv / rev) * 365.0

        dio = None
        if cg and inv and cg > 0:
            dio = (inv / cg) * 365.0

        ic = None
        if ebit_v is not None and intv not in (None, 0):
            denom = abs(float(intv))
            if denom > 0:
                ic = float(ebit_v) / denom

        period_end = None
        filing_date = None

        row = {
            "fiscal_year": fy,
            "period_end": period_end,
            "filing_date": filing_date,
            "source": "SEC",
            "revenue": rev,
            "net_income": ni,
            "gross_profit": gp,
            "operating_income": oi,
            "eps_diluted": epsv,
            "assets": ast,
            "liabilities": liab,
            "equity": eq,
            "cash": csh,
            "total_debt": td,
            "current_assets": ca,
            "current_liabilities": cl,
            "inventory": inv,
            "accounts_receivable": arv,
            "cost_of_revenue": cg,
            "operating_cash_flow": ocfv,
            "capex": capv,
            "fcf": fcfv,
            "interest_expense": intv,
            "dividends_paid": div,
            "shares_outstanding": sh,
            "public_float": pf,
            "gross_margin": gm,
            "operating_margin": om,
            "net_margin": nm,
            "roe": roe,
            "debt_equity": de,
            "current_ratio": cr,
            "asset_turnover": ato,
            "dso": dso,
            "dio": dio,
            "interest_coverage": ic,
            "revenue_cagr_3y": _cagr(revenue, fy, 3),
            "revenue_cagr_5y": _cagr(revenue, fy, 5),
            "revenue_cagr_10y": _cagr(revenue, fy, 10),
            "net_income_cagr_3y": _cagr(net_income, fy, 3),
            "net_income_cagr_5y": _cagr(net_income, fy, 5),
            "net_income_cagr_10y": _cagr(net_income, fy, 10),
        }
        rows.append(row)

    # Second pass: attach fcf cagr using dict built from rows
    fcf_by_fy: dict[int, float] = {}
    for r in rows:
        fy = int(r["fiscal_year"])
        fv = r.get("fcf")
        if isinstance(fv, (int, float)) and math.isfinite(fv):
            fcf_by_fy[fy] = float(fv)

    for r in rows:
        fy = int(r["fiscal_year"])
        r["fcf_cagr_3y"] = _cagr(fcf_by_fy, fy, 3)
        r["fcf_cagr_5y"] = _cagr(fcf_by_fy, fy, 5)
        r["fcf_cagr_10y"] = _cagr(fcf_by_fy, fy, 10)

    rows.sort(key=lambda x: x["fiscal_year"])
    return rows


def enrich_annual_with_filing_dates(rows: list[dict[str, Any]], companyfacts: dict[str, Any]) -> None:
    """Best-effort: set filing_date / period_end from revenue tag raw point for that FY."""
    us = _us_gaap(companyfacts)
    rev_block = None
    best_score = (-1, -1, -1)
    for tag in _revenue_tag_names():
        if tag not in us:
            continue
        block = us.get(tag)
        if not isinstance(block, dict):
            continue
        out = _extract_series_from_tag_block(block, annual=True)
        if not isinstance(out, dict) or not out:
            continue
        score = _series_score(out)
        if score > best_score:
            rev_block = block
            best_score = score
    if not isinstance(rev_block, dict):
        return
    units = rev_block.get("units") or {}
    if not isinstance(units, dict):
        return
    arr = None
    for unit_key in ("USD", "USD/shares"):
        if units.get(unit_key):
            arr = units.get(unit_key)
            break
    if not isinstance(arr, list):
        return
    collapsed = _collapse_annual_latest_filed(arr)
    by_fy = {int(fy): meta for fy, meta in collapsed.items()}
    for r in rows:
        fy = int(r["fiscal_year"])
        meta = by_fy.get(fy)
        if not meta:
            continue
        r["period_end"] = meta.get("end")
        r["filing_date"] = meta.get("filed")


def build_quarterly_tables(companyfacts: dict[str, Any]) -> list[dict[str, Any]]:
    us = _us_gaap(companyfacts)

    def q_series(tags: list[str]) -> dict[tuple[int, str], float]:
        d = _series_for_tags(us, tags, False)
        return d if isinstance(d, dict) else {}

    revenue = q_series(_revenue_tag_names())
    net_income = q_series(_net_income_tag_names())
    gross_profit = q_series(["GrossProfit"],)
    operating_income = q_series(["OperatingIncomeLoss"],)
    eps = q_series(["EarningsPerShareDiluted"],)
    assets = q_series(["Assets"],)
    liabilities = q_series(["Liabilities"],)
    equity = q_series(_equity_tag_names())
    cash = q_series(
        [
            "CashAndCashEquivalentsAtCarryingValue",
            "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        ],
    )
    ltd = q_series(["LongTermDebt", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],)
    ltd_cur = q_series(["LongTermDebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent"],)
    st_borrow = q_series(["ShortTermBorrowings", "DebtCurrent"],)
    debt_parts = [d for d in (ltd, ltd_cur, st_borrow) if d]

    def sum_q(ds: list[dict[tuple[int, str], float]]) -> dict[tuple[int, str], float]:
        out: dict[tuple[int, str], float] = defaultdict(float)
        for part in ds:
            for k, v in part.items():
                out[k] += float(v)
        return dict(out)

    total_debt = sum_q(debt_parts) if debt_parts else {}
    cur_assets = q_series(["AssetsCurrent"],)
    cur_liab = q_series(["LiabilitiesCurrent"],)
    inventory = q_series(["InventoryNet"],)
    ar = q_series(["AccountsReceivableNetCurrent"],)
    cogs = q_series(
        ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
    )
    ocf = q_series(["NetCashProvidedByUsedInOperatingActivities"],)
    capex = q_series(["PaymentsToAcquirePropertyPlantAndEquipment"],)
    interest = q_series(["InterestExpense", "InterestAndDebtExpense"],)
    dividends = q_series(["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],)
    shares = q_series(
        [
            "EntityCommonStockSharesOutstanding",
            "WeightedAverageNumberOfDilutedSharesOutstanding",
        ],
    )

    keys = (
        set(revenue)
        | set(net_income)
        | set(gross_profit)
        | set(operating_income)
        | set(assets)
        | set(ocf)
        | set(equity)
    )
    out_rows: list[dict[str, Any]] = []
    for (fy, fp) in sorted(keys, key=lambda x: (x[0], _quarter_index(x[1]))):
        rev = revenue.get((fy, fp))
        ni = net_income.get((fy, fp))
        gp = gross_profit.get((fy, fp))
        oi = operating_income.get((fy, fp))
        epsv = eps.get((fy, fp))
        ast = assets.get((fy, fp))
        liab = liabilities.get((fy, fp))
        eq = equity.get((fy, fp))
        csh = cash.get((fy, fp))
        td = total_debt.get((fy, fp))
        ca = cur_assets.get((fy, fp))
        cl = cur_liab.get((fy, fp))
        inv = inventory.get((fy, fp))
        arv = ar.get((fy, fp))
        cg = cogs.get((fy, fp))
        ocfv = ocf.get((fy, fp))
        capv = capex.get((fy, fp))
        intv = interest.get((fy, fp))
        div = dividends.get((fy, fp))
        sh = shares.get((fy, fp))
        fcfv = _fcf(_f(ocfv), _f(capv))
        gm = _safe_div(gp, rev)
        om = _safe_div(oi, rev)
        nm = _safe_div(ni, rev)
        roe = _safe_div(ni, eq)
        de = _safe_div(td, eq) if eq not in (None, 0) else None
        cr = _safe_div(ca, cl)
        out_rows.append(
            {
                "fiscal_year": fy,
                "fiscal_quarter": _quarter_index(fp),
                "period_end": None,
                "filing_date": None,
                "source": "SEC",
                "revenue": rev,
                "net_income": ni,
                "gross_profit": gp,
                "operating_income": oi,
                "eps_diluted": epsv,
                "assets": ast,
                "liabilities": liab,
                "equity": eq,
                "cash": csh,
                "total_debt": td,
                "current_assets": ca,
                "current_liabilities": cl,
                "inventory": inv,
                "accounts_receivable": arv,
                "cost_of_revenue": cg,
                "operating_cash_flow": ocfv,
                "capex": capv,
                "fcf": fcfv,
                "interest_expense": intv,
                "dividends_paid": div,
                "shares_outstanding": sh,
                "gross_margin": gm,
                "operating_margin": om,
                "net_margin": nm,
                "roe": roe,
                "debt_equity": de,
                "current_ratio": cr,
            },
        )
    return out_rows


def parse_issuer_profile(submissions: dict[str, Any], symbol: str, cik: str) -> dict[str, Any] | None:
    """Map SEC submissions root fields to DB row (ticker list, exchange, SIC, fiscal year end)."""
    if not isinstance(submissions, dict):
        return None
    sym = (symbol or "").strip().upper()
    cik_digits = "".join(ch for ch in str(cik) if ch.isdigit())
    name = (submissions.get("name") or "").strip() or None
    tickers = submissions.get("tickers") or []
    exchanges = submissions.get("exchanges") or []
    if not isinstance(tickers, list):
        tickers = []
    if not isinstance(exchanges, list):
        exchanges = []
    exchange = None
    for i, t in enumerate(tickers):
        if str(t).strip().upper() == sym:
            if i < len(exchanges) and exchanges[i]:
                exchange = str(exchanges[i]).strip() or None
            break
    if exchange is None and exchanges:
        exchange = str(exchanges[0]).strip() or None
    sic = submissions.get("sic")
    sic_s = str(sic).strip() if sic is not None and str(sic).strip() != "" else None
    sic_desc = (submissions.get("sicDescription") or "").strip() or None
    fye = submissions.get("fiscalYearEnd")
    fye_s = str(fye).strip()[:8] if fye else None
    return {
        "symbol": sym,
        "cik": cik_digits.zfill(10) if cik_digits else None,
        "company_name": name,
        "tickers": [str(x) for x in tickers if x],
        "exchanges": [str(x) for x in exchanges if x],
        "exchange": exchange,
        "sic": sic_s,
        "sic_description": sic_desc,
        "fiscal_year_end": fye_s,
    }


def parse_filings_from_submissions(submissions: dict[str, Any], symbol: str, cik: str) -> list[dict[str, Any]]:
    """Build filing rows from submissions.recent parallel arrays."""
    recent = ((submissions.get("filings") or {}).get("recent") or {}) if submissions else {}
    if not isinstance(recent, dict):
        return []
    forms = recent.get("form") or []
    accs = recent.get("accessionNumber") or []
    fdates = recent.get("filingDate") or []
    rdates = recent.get("reportDate") or []
    prim = recent.get("primaryDocument") or []
    n = min(len(forms), len(accs), len(fdates))
    cik_int = int("".join(ch for ch in str(cik) if ch.isdigit()) or "0")
    rows: list[dict[str, Any]] = []
    for i in range(n):
        form = str(forms[i] or "")
        acc = str(accs[i] or "")
        if not acc:
            continue
        fd = str(fdates[i] or "")[:10] or None
        rd = str(rdates[i] or "")[:10] if i < len(rdates) and rdates[i] else None
        doc = str(prim[i]) if i < len(prim) and prim[i] else ""
        acc_nd = acc.replace("-", "")
        url = None
        if cik_int and acc_nd and doc:
            url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{acc_nd}/{doc}"
        rows.append(
            {
                "symbol": symbol.upper(),
                "form": form,
                "accession_number": acc,
                "filing_date": fd,
                "report_date": rd,
                "primary_document": doc or None,
                "filing_url": url,
            },
        )
    return rows
