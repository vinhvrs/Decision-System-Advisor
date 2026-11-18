from .types import MetricValue
from .provenance import fn_as_of


def calculate(facts):
    def v(code): 
        row = next((x for x in facts if x['metric_code'] == code), None)
        return None if row is None else row['value']
    evf, ocf, debt, cash, assets = v 'ENTERPRISE_VALUE'), v('OPERATING_CASH_FLOW'), v('TOTAL_DEBT'), v('CASH'), v('TOTAL_ASSETS')
    values = []
    for code, value, unit in [
        ('EVOCF', (evf/ocf if evf is not None and ocf not in (None, 0) else None), 'ratio'),
        ('NET_DEBT', (debt-cash if debt is not None and cash is not None else None), 'USD'),
        ('NET_DEBT_TO_ASSETS', ((debt-cash)/assets if all(x is not None for x in (debt,cash,assets)) and assets != 0 else None), 'ratio'),
    ]:
        values.append(MetricValue(code, value, unit, 'CALCULATED', 'OBSERVED', fn_as_of(facts)))
    return values
