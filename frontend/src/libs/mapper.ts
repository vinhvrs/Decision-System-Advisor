import { Instrument, InstrumentAPI } from "../types/Instrument";
import { InstrumentPeriod, InstrumentPeriodAPI } from "../types/InstrumentPeriod";
import { InstrumentData, InstrumentDataAPI } from "../types/InstrumentData";
import { Stock, StockAPI } from "../types/Stock";
import { User, UserAPI } from "../types/User";
import { News, NewsApi } from "../types/News";

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

export function stockMapper(apiData: StockAPI[]): Stock[] {
    return apiData.map(data => ({
        id: data.id,
        date: data.date,
        instrument_id: data.instrument_id,
        revenue_low: data.revenue_low,
        revenue_high: data.revenue_high,
        revenue_avg: data.revenue_avg,
        ebitda_low: data.ebitda_low,
        ebitda_high: data.ebitda_high,
        ebitda_avg: data.ebitda_avg,
        ebit_low: data.ebit_low,
        ebit_high: data.ebit_high,
        ebit_avg: data.ebit_avg,
        net_income_low: data.net_income_low,
        net_income_high: data.net_income_high,
        net_income_avg: data.net_income_avg,
        sga_expense_low: data.sga_expense_low,
        sga_expense_high: data.sga_expense_high,
        sga_expense_avg: data.sga_expense_avg,
        eps_low: data.eps_low,
        eps_high: data.eps_high,
        eps_avg: data.eps_avg,
        num_analysts_revenue: data.num_analysts_revenue,
        num_analysts_eps: data.num_analysts_eps,
        confidence_score: data.confidence_score,
        recommendation: data.recommendation,
    }));
}
    
export function userMapper(apiData: UserAPI): User {
    return {
        id: apiData.id,
        name: apiData.name,
        username: apiData.username,
        email: apiData.email,
        phone: apiData.phone,
    };
}

export function newsMapper(apiData: NewsApi[]): News[] {
    return apiData.map(data => ({
        id: data.id,
        topic: data.topic,
        content: data.content,
        author: data.author,
        url_slug: data.url_slug,
        published_at: data.published_at,
    }));
}