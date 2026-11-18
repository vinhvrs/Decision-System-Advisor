import csv, io, re
from .base import SourceHTTP
from ...config.source_policy import from_env

  
class CFTC:
    COLUMNS = {
        'Market_and_Exchange_Names': 'contract',
        'Comm_Positions_Long_All': 'long_positions', 'Comm_Positions_Short_All': 'short_positions',
        'Open_Interest_All': 'open_interest',
    }

    def __init__(self, http=None): self.http = http or SourceHTTP()

    def fetch(self):
        url = from_env('CFTC_URL', '')
        if not url: return None
        resp = self.http.get('CFTC', url)
        return self.parse(resp.text)

    @staticmethod
    def parse(text):
        rows = []
        for row in csv.DictReader(io.StringIO(text)):
            if not row.get('Market_and_Exchange_Names'): continue
            long = float(row.get('Comm_Positions_Long_All') or 0)
            short = float(row.get('Comm_Positions_Short_All') or 0)
            oi = float(row.get('Open_Interest_All') or 0)
            rows.append({
                'cftc_contract_code': (row.get('CFTC_Contract_Market_Code') or '').strip(),
                'report_type': 'Legacy', 'report_date': (row.get('Report_Date_as_YYYY-MM-DD') or '').strip(),
                'category': 'COMMERCIAL', 'long_positions': long, 'short_positions': short, 'spread_positions': None,
                'open_interest': oi, 'net_positions': long-short, 'net_pct_oi': ((long-short)/oi*100 if oi else None),
                'metadata_json': {'unit': 'contracts'},
            })
        return rows
