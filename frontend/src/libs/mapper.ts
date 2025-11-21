import { Instrument, InstrumentAPI } from "../types/Instrument";
import { InstrumentPeriod, InstrumentPeriodAPI } from "../types/InstrumentPeriod";
import { InstrumentData, InstrumentDataAPI } from "../types/InstrumentData";


export function instrumentMapper(apiData: InstrumentAPI[]): Instrument[] {
    return apiData.map(data => ({
        id: data.id,
        name: data.name,
        symbol: data.symbol,
        type: data.type,
        exchange: data.exchange,
        slug: data.slug,
    }));
}

export function instrumentPeriodMapper(apiData: InstrumentPeriodAPI[]): InstrumentPeriod[] {
    return apiData.map(data => ({
        id: data.id,
        instrument_id: data.instrument_id,
        period: data.period,
        type: data.market,
        prefix: data.prefix,
    }));
}

export function instrumentDataMapper(apiData: InstrumentDataAPI[]): InstrumentData[] {
    return apiData.map(data => ({
        id: data.id,
        instrument_period_id: data.instrument_period_id,
        timestamp: data.timestamps,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
        slug: data.slug,
    }));
}