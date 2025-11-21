export type InstrumentPeriod = {
    id: string;
    instrument_id: string;
    period: string;
    type: string;
    prefix: string;
};

export interface InstrumentPeriodAPI {
    id: string;
    instrument_id: string;
    period: string;
    market: string;
    prefix: string;
}