"""Read-only macro context from SQL. Requests never crawl the upstream provider."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import pymysql
from fastapi import APIRouter, HTTPException, Query
from app.config.market_universe import BY_SYMBOL
from config.settings import settings
from app.jobs.economic_calendar_job import SOURCE
from app.jobs.content_tags import classify, options

router = APIRouter()
FX_CURRENCIES = {'EURUSD=X':('EUR','USD'),'GBPUSD=X':('GBP','USD'),
                  'JPY=X':('USD','JPY'),'AUDUSD=X':('AUD','USD'),'CHF=X':('USD','CHF')}


def currencies_for_symbol(symbol):
    symbol = symbol.upper()
    if symbol not in BY_SYMBOL:
        raise ValueError('Unsupported symbol')
    if symbol in FX_CURRENCIES:
        return FX_CURRENCIES[symbol]
    return {'^N225':('JPY',),'^GDAXI':('EUR',)}.get(symbol, ('USD',))


def utc_text(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


@router.get('/api/v1/economic-calendar')
def economic_calendar(symbol: Optional[str] = None, currency: Optional[str] = None,
                      impact: Optional[str] = None, start: Optional[datetime] = None,
                      end: Optional[datetime] = None, limit: int = Query(500, ge=1, le=1000),
                      tag: Optional[str] = None, page: Optional[int] = Query(None, ge=1, le=100000),
                      per_page: int = Query(25, ge=1, le=100)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    def utc_bound(value, default):
        if value is None:
            return default
        if value.tzinfo is None:
            raise HTTPException(400, 'Use an explicit timezone for start/end')
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    lower, upper = utc_bound(start,now-timedelta(days=7)), utc_bound(end,now+timedelta(days=14))
    if upper <= lower or upper-lower > timedelta(days=31):
        raise HTTPException(400, 'Calendar range must be positive and at most 31 days')
    currencies = None
    if symbol:
        try:
            currencies = currencies_for_symbol(symbol)
        except ValueError as exc:
            raise HTTPException(400,str(exc)) from exc
    if currency:
        from app.jobs.economic_calendar_job import CURRENCIES
        currency = currency.upper() if currency.lower() != 'all' else 'All'
        if currency not in CURRENCIES:
            raise HTTPException(400, 'Unsupported currency')
        currencies = (currency,) if currencies is None else tuple(c for c in currencies if c == currency)
    if tag and tag not in {t['slug'] for t in options('event')}:
        raise HTTPException(400,'Unsupported event tag')
    conditions = ['source=%s', 'active=1', 'scheduled_at >= %s', 'scheduled_at < %s']
    args = [SOURCE,lower,upper]
    if currencies is not None:
        included = (*currencies, 'All')
        conditions.append('currency IN ('+','.join(['%s']*len(included))+')')
        args.extend(included)
    if impact:
        impact = impact.capitalize()
        if impact not in ('High','Medium','Low','Holiday'):
            raise HTTPException(400,'Unsupported impact')
        conditions.append('impact=%s');args.append(impact)
    if tag:
        conditions.append("EXISTS (SELECT 1 FROM content_labels t WHERE t.kind='event' AND t.document_id=economic_events.id AND t.tag=%s)")
        args.append(tag)
    conn = pymysql.connect(**settings.DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT * FROM economic_calendar_sync WHERE source=%s',(SOURCE,))
            state = cur.fetchone() or {}
            total=None
            if page is not None:
                cur.execute('SELECT COUNT(*) AS total FROM economic_events WHERE '+' AND '.join(conditions),tuple(args))
                total=cur.fetchone()['total']
                page=min(page,max(1,(total+per_page-1)//per_page))
            cur.execute('SELECT id,title,currency,impact,scheduled_at,all_day,forecast,previous,actual FROM economic_events WHERE '
                        +' AND '.join(conditions)+' ORDER BY scheduled_at,id LIMIT %s OFFSET %s', (*args,per_page if page is not None else limit,(page-1)*per_page if page is not None else 0))
            rows = cur.fetchall()
    finally:
        conn.close()
    for row in rows:
        row['scheduled_at'] = utc_text(row['scheduled_at'])
        row['all_day'] = bool(row['all_day'])
        row['tags'] = classify(row['title'],'event')
    last = state.get('last_success_at')
    stale = not last or now-last > timedelta(hours=3) or bool(state.get('last_error'))
    return {'source':SOURCE,'source_url':'https://www.forexfactory.com/calendar',
            'symbol':symbol.upper() if symbol else None,'context_currencies':currencies,
            'last_success_at':utc_text(last),'stale':stale,'provider_error':bool(state.get('last_error')),
            'coverage':{'start':str(state['week_start']) if state.get('week_start') else None,
                        'end':str(state['week_end']) if state.get('week_end') else None},
            'actual_available':False,'events':rows,'limit':per_page if page is not None else limit,
            'available_tags':options('event'),
            'pagination':{'current_page':page,'per_page':per_page,'total':total,'last_page':max(1,(total+per_page-1)//per_page)} if page is not None else None,
            'possibly_truncated':page is None and len(rows)==limit}
