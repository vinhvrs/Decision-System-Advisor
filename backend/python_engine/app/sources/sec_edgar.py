import os
from .base import SourceHTTP
from ...config.source_policy import from_env

  
class SecEdgar:
    COMPANYFACTS_URL = 'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json'

    def __init__(self, http=None):
        self.http = http or SourceHTTP()

    def fetch(self, cik):
        headers = {'User-Agent': from_env('SEC_USER_AGENT', '')}
        if not headers['User-Agent']:
            return None
        cik = str(cik).zfill(10)
        return self.http.json('SEC_EDGAR', self.COMPANYFACTS_URL.format(cik=cik), headers=headers)
