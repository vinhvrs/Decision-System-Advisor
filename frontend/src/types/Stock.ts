export type Stock = {
    id: string;
    date: string;
    instrument_id: string;
    revenue_low: number;
    revenue_high: number;
    revenue_avg: number;
    ebitda_low: number;
    ebitda_high: number;
    ebitda_avg: number;
    ebit_low: number;
    ebit_high: number;
    ebit_avg: number;
    net_income_low: number;
    net_income_high: number;
    net_income_avg: number;
    sga_expense_low: number;
    sga_expense_high: number;
    sga_expense_avg: number;
    eps_low: number;
    eps_high: number;
    eps_avg: number;
    num_analysts_revenue: number;
    num_analysts_eps: number;
    confidence_score: number;
    recommendation: string;
};

/**
 * Represents the structure of stock-related data retrieved from the API.
 *
 * @interface StockAPI
 * 
 * @property {string} id - The unique identifier for the stock data entry.
 * @property {string} date - The date associated with the stock data (in ISO 8601 format).
 * @property {string} instrument_id - The identifier for the financial instrument.
 * @property {number} revenue_low - The lower bound of the revenue estimate.
 * @property {number} revenue_high - The upper bound of the revenue estimate.
 * @property {number} revenue_avg - The average revenue estimate.
 * @property {number} ebitda_low - The lower bound of the EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization) estimate.
 * @property {number} ebitda_high - The upper bound of the EBITDA estimate.
 * @property {number} ebitda_avg - The average EBITDA estimate.
 * @property {number} ebit_low - The lower bound of the EBIT (Earnings Before Interest and Taxes) estimate.
 * @property {number} ebit_high - The upper bound of the EBIT estimate.
 * @property {number} ebit_avg - The average EBIT estimate.
 * @property {number} net_income_low - The lower bound of the net income estimate.
 * @property {number} net_income_high - The upper bound of the net income estimate.
 * @property {number} net_income_avg - The average net income estimate.
 * @property {number} sga_expense_low - The lower bound of the Selling, General, and Administrative (SG&A) expense estimate.
 * @property {number} sga_expense_high - The upper bound of the SG&A expense estimate.
 * @property {number} sga_expense_avg - The average SG&A expense estimate.
 * @property {number} eps_low - The lower bound of the Earnings Per Share (EPS) estimate.
 * @property {number} eps_high - The upper bound of the EPS estimate.
 * @property {number} eps_avg - The average EPS estimate.
 * @property {number} num_analysts_revenue - The number of analysts contributing to the revenue estimate.
 * @property {number} num_analysts_eps - The number of analysts contributing to the EPS estimate.
 * @property {number} confidence_score - A score indicating the confidence level of the estimates.
 * @property {string} recommendation - The recommendation or rating for the stock (e.g., "Buy", "Hold", "Sell").
 */
export interface StockAPI {
    id: string;
    date: string;
    instrument_id: string;
    revenue_low: number;
    revenue_high: number;
    revenue_avg: number;
    ebitda_low: number;
    ebitda_high: number;
    ebitda_avg: number;
    ebit_low: number;
    ebit_high: number;
    ebit_avg: number;
    net_income_low: number;
    net_income_high: number;
    net_income_avg: number;
    sga_expense_low: number;
    sga_expense_high: number;
    sga_expense_avg: number;
    eps_low: number;
    eps_high: number;
    eps_avg: number;
    num_analysts_revenue: number;
    num_analysts_eps: number;
    confidence_score: number;
    recommendation: string;
}