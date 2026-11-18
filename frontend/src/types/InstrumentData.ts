export type InstrumentData = {
    id: string;
    instrument_period_id: string;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    slug: string;
    source?: string | null;
}

export interface InstrumentDataAPI {
    id: string;
    instrument_period_id: string;
    timestamps?: string;
    timestamp?: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    slug: string;
    source?: string | null;
}