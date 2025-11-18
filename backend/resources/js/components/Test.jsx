import React, { useState } from 'react';

const StockAttributeImporter = () => {
  const [step, setStep] = useState(1);
  const [selectedStock, setSelectedStock] = useState(null);
  const [fetchedData, setFetchedData] = useState(null);
  const [saving, setSaving] = useState(false);

  const stockList = [{ symbol: "AAPL", name: "Apple Inc." }];

  // Step 1: Fetch stock data from API (FMP or TwelveData)
  const handleFetch = async (symbol) => {
    setSelectedStock(symbol);
    try {
      // 🎯 Dùng FMP (Financial Modeling Prep) – free & nhanh
      const response = await fetch(`https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=1&apikey=demo`);
      const data = await response.json();

      if (data && data.length > 0) {
        const latest = data[0]; // Dữ liệu ngày gần nhất

        const mapped = {
          date: latest.date, // ví dụ: "2025-09-08"
          revenue_avg: latest.revenue,
          ebitda_avg: latest.ebitda,
          ebit_avg: latest.ebit,
          net_income_avg: latest.netIncome,
          sga_expense_avg: latest.sellingGeneralAndAdministrativeExpenses,
          eps_avg: latest.eps,
          num_analysts_eps: 6,
          num_analysts_revenue: 10,
          confidence_score: 85.5,
          recommendation: "Buy",
        };

        setFetchedData(mapped);
        setStep(2);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Step 2: Save to Laravel
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:8000/api/stock-attributes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instrument_id: 1, // Giả lập ID của bảng instruments
          ...fetchedData,
        }),
      });

      const res = await response.json();
      alert('✅ Saved to database!');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '30px' }}>
      <h2>🧠 Stock Attribute Importer</h2>

      {step === 1 && (
        <>
          <p><strong>Step 1:</strong> Chọn stock cần fetch dữ liệu ngày 08/09/2025</p>
          <ul>
            {stockList.map((s, idx) => (
              <li key={idx}>
                {s.name} ({s.symbol})
                <button onClick={() => handleFetch(s.symbol)} style={{ marginLeft: '10px' }}>
                  Fetch
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && fetchedData && (
        <>
          <p><strong>Step 2:</strong> Xem và lưu dữ liệu vào hệ thống</p>
          <pre>{JSON.stringify(fetchedData, null, 2)}</pre>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✅ Lưu vào database'}
          </button>
          <br /><br />
          <button onClick={() => setStep(1)}>🔙 Quay lại chọn khác</button>
        </>
      )}
    </div>
  );
};

export default StockAttributeImporter;
