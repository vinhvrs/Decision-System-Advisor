/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "../libs/api";
import chatbot from "../libs/chatbot";
import { stockMapper } from "../libs/mapper";

export const AdviceService = {
    handleChatbot: async (message: string) => {
        try {
            const response = await chatbot.post("/chat", { "message": message });
            return response.data;
        }
        catch (error) {
            console.error("Error in chatbot communication:", error);
            throw error;
        }
    },

    getAdvices: async (limit: number = 10, page: number = 1, select?: Array<string>) => {
        try {
            const response = await api.get(`/stocks?per_page=${limit}&page=${page}${select ? select.map(s => `&select[]=${s}`).join('') : ''}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advices:", error);
            throw error;
        }
    },

    getAdviceById: async (id: string) => {
        try {
            const response = await api.get(`/advices/stocks/${id}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by ID:", error);
            throw error;
        }
    },

    getAdviceBySymbol: async (symbol: string) => {
        try {
            const response = await api.get(`/stocks/symbol/${symbol}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by symbol:", error);
            throw error;
        }
    },

    getAdviceByName: async (name: string) => {
        try {
            const response = await api.get(`/stocks/name/${name}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by name:", error);
            throw error;
        }
    },

    createAdvice: async (data: any) => {
        try {
            const response = await api.post(`/advices/stocks`, data);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error creating advice:", error);
            throw error;
        }
    },

    updateAdvice: async (id: string, data: any) => {
        try {
            const response = await api.put(`/stocks/${id}`, data);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error updating advice:", error);
            throw error;
        }
    },

    deleteAdvice: async (id: string) => {
        try {
            const response = await api.delete(`/stocks/${id}`);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error deleting advice:", error);
            throw error;
        }
    },

    askingAdvice: async (symbol: string, name: string, question: string) => {
        try {
            if (!symbol && !name) {
                throw new Error("Either symbol or name must be provided");
            }
            let symbolResponse;
            if (symbol) {
                symbolResponse = await api.get(`/stocks/symbol/${symbol}`);
                console.log("Fetched advice by symbol:", symbolResponse.data);
            }
            let nameResponse;
            if (name) {
                nameResponse = await api.get(`/stocks/name/${name}`);
                console.log("Fetched advice by name:", nameResponse.data);
            }
            let type = 'Expert Analysis';
            if (!symbolResponse?.data.recommendation && !nameResponse?.data.recommendation && symbol) {
                symbolResponse = await api.get(`/stocks/indicator/${symbol}`);
                type = 'RSI Indicator';
                console.log("Fetched advice by indicator for symbol:", symbolResponse.data);
            }
            const symbolData = { ...symbolResponse?.data, type };
            const nameData = nameResponse?.data;
            const payload = {
                symbol: symbolData?.recommendation || 'Hold',
                name: nameData?.recommendation || 'Hold',
                question: (question as any)?.answer,
                explain: symbol ? AdviceService.generateExplanation(symbolData) : name ? AdviceService.generateExplanation(nameData) : undefined
            };
            return payload;
        } catch (error) {
            console.error("Error asking advice:", error);
            throw error;
        }
    },

    similar: async (symbol: string) => {
        const similarResponse = await api.get(`/similar-signals/generate/${symbol}`);
        const similarData = similarResponse?.data.data;
        return similarData;
    },

    generateExplanation: (payload: any) => {
    const {
      date,
      revenue_avg,
      ebitda_avg,
      ebit_avg,
      net_income_avg,
      eps_avg,
      confidence_score,
      recommendation,
      num_analysts_eps,
      num_analysts_revenue,
      type
    } = payload;

    console.log("Generating explanation with payload:", payload);

    const revenue = revenue_avg / 1_000_000;
    const ebitda = ebitda_avg / 1_000_000;
    const ebit = ebit_avg / 1_000_000;
    const netIncome = net_income_avg / 1_000_000;
    const eps = parseFloat(eps_avg || '0');
    const confidence = parseFloat(confidence_score ||'0');
    const analysts = Math.max(num_analysts_eps || 0, num_analysts_revenue || 0);

    const rec = recommendation?.toUpperCase() || 'HOLD';
    const emoji = rec === 'BUY' ? '🟢' : rec === 'SELL' ? '🔴' : '🟡';

    let tone = '';
    const reasoning = [];

    // Phân tích chỉ số EPS
    if (eps > 0.02) {
      reasoning.push(`EPS is relatively high at ${eps.toFixed(4)}, indicating strong earnings per share`);
    } else if (eps < 0.005) {
      reasoning.push(`EPS is quite low at ${eps.toFixed(4)}, suggesting limited profitability`);
    } else {
      reasoning.push(`EPS is moderate at ${eps.toFixed(4)}`);
    }

    // Phân tích Net Income
    if (netIncome > 100) {
      reasoning.push(`Net income is impressive at ${netIncome.toFixed(2)}M, showing solid financial performance`);
    } else if (netIncome < 10) {
      reasoning.push(`Net income is below expectations at ${netIncome.toFixed(2)}M`);
    }

    // Confidence
    if (confidence > 85) {
      reasoning.push(`High confidence score of ${confidence}% supports the reliability of these forecasts`);
    } else if (confidence < 60) {
      reasoning.push(`Low confidence (${confidence}%) may reflect uncertainty or mixed analyst opinions`);
    }

    // Analysts count
    if (analysts <= 1) {
      reasoning.push(`Only ${analysts} analyst contributed, so the prediction may lack consensus`);
    } else {
      reasoning.push(`Based on insights from ${analysts} analysts`);
    }

    // Chọn tone văn bản
    if (rec === 'BUY') {
      tone = "Overall, this stock presents a <b>promising opportunity</b>, especially for investors seeking growth.";
    } else if (rec === 'SELL') {
      tone = "Given the data, caution is advised, and it may be wise to <b>reduce exposure</b> to this stock.";
    } else {
      tone = "The stock appears to be in a <b>neutral position</b>, with no strong signals for immediate action.";
    }

    // Kết luận
    //const explanation = `${emoji} As of ${date}, the forecast indicates revenue: ${revenue.toFixed(2)}M, EBITDA: ${ebitda.toFixed(2)}M, EBIT: ${ebit.toFixed(2)}M, and net income: ${netIncome.toFixed(2)}M. ${reasoning.join('. ')}. ${tone}`;

    const explanation = `This recommendation was made based on the latest financial forecasts as of <b>${date}</b>, indicating expected revenue of <b>${revenue.toFixed(2)}M</b>, EBITDA of <b>${ebitda.toFixed(2)}M</b>, EBIT of <b>${ebit.toFixed(2)}M</b>, and net income of <b>${netIncome.toFixed(2)}M</b>. ${reasoning.join('. ')}. ${tone}`;
    if (type === 'RSI Indicator') {
      return `Based on the RSI indicator analysis, the stock is currently in an overbought/oversold condition which may impact its short-term price movements.`;
    }
    return explanation;
  }
};