export type Instrument = {
    id: string;
    name: string;
    symbol: string;
    type: string;
    exchange: string;
    slug: string;
};

export interface InstrumentAPI {
    id: string;
    name: string;
    symbol: string;
    type: string;
    exchange: string;
    slug: string;
}