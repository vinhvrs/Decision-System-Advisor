"use client";

import React, { use, useState, useEffect } from 'react';
import { 
  ArrowUpRight, ArrowDownRight, History, BarChart3, 
  Globe, Users, ShieldCheck, Newspaper, ExternalLink, TrendingUp 
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import LightChart from '@/src/components/charts/LightChart'; // Đảm bảo đường dẫn này đúng với cấu trúc thư mục của bạn

interface Props {
  params: Promise<{ "inc-slug": string }>;
}

const StockProfile = ({ params }: Props) => {
  const resolvedParams = use(params);
  const ticker = resolvedParams["inc-slug"]?.split('-').pop()?.toUpperCase() || "AAPL";

  // Mock Data cho Biểu đồ giá (Lightweight Charts)
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Tạo dữ liệu nến giả lập cho lần đầu load
    const data = [];
    let time = new Date('2025-01-01').getTime();
    let value = 250;
    for (let i = 0; i < 100; i++) {
      const open = value + Math.random() * 10 - 5;
      const high = open + Math.random() * 5;
      const low = open - Math.random() * 5;
      const close = (high + low) / 2;
      data.push({ time, open, high, low, close });
      time += 24 * 60 * 60 * 1000; // Tăng 1 ngày
      value = close;
    }
    setChartData(data);
  }, []);

  // Mock data cho Radar Chart
  const analysisData = [
    { subject: 'Growth', value: 85 },
    { subject: 'Value', value: 65 },
    { subject: 'Health', value: 90 },
    { subject: 'Dividend', value: 45 },
    { subject: 'Liquidity', value: 95 },
    { subject: 'Sentiment', value: 80 },
  ];

  const news = [
    { id: 1, title: `${ticker} công bố báo cáo tài chính quý mới nhất với doanh thu kỷ lục.`, time: "2 giờ trước", source: "Bloomberg" },
    { id: 2, title: "Phân tích xu hướng dòng tiền vào các nhóm cổ phiếu công nghệ lớn.", time: "5 giờ trước", source: "Reuters" },
    { id: 3, title: "Dự kiến các quy định mới sẽ ảnh hưởng đến chuỗi cung ứng của tập đoàn.", time: "1 ngày trước", source: "Wall Street Journal" },
  ];

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-800 pb-8 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-500/20">
              {ticker[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-bold text-white tracking-tight">{ticker} - Corporation</h1>
                <ShieldCheck className="text-blue-400" size={24} />
              </div>
              <div className="flex gap-5 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Globe size={16}/> NASDAQ</span>
                <span className="flex items-center gap-1.5"><Users size={16}/> 150k+ Employees</span>
              </div>
            </div>
          </div>
          <div className="text-right bg-[#131722] p-4 rounded-2xl border border-gray-800 min-w-[200px]">
            <div className="text-3xl font-mono font-bold text-white">$275.91</div>
            <div className="text-green-400 font-bold flex items-center justify-end gap-1 mt-1 text-lg">
              +2.15% <ArrowUpRight size={20} />
            </div>
          </div>
        </div>

        {/* PRICE CHART SECTION (MỚI) */}
        <section className="bg-[#131722] border border-gray-800 rounded-3xl p-6 mb-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={22} /> Market Price (Daily)
            </h2>
            <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
              {['1D', '1W', '1M', '1Y'].map(t => (
                <button key={t} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${t === '1D' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="h-[450px] w-full bg-[#0B1220] rounded-xl overflow-hidden border border-gray-800">
            {chartData.length > 0 ? (
              <LightChart 
                symbol={ticker}
                data={chartData}
                period="daily"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500">Loading Chart...</div>
            )}
          </div>
        </section>

        {/* BOTTOM CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* CỘT TRÁI: HISTORY & NEWS */}
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 italic">
                <History className="text-blue-500" size={20} /> Company Formation
              </h2>
              <p className="leading-relaxed text-gray-400 italic">
                Được thành lập với mục tiêu đổi mới công nghệ toàn cầu, {ticker} đã trải qua hơn 3 thập kỷ phát triển mạnh mẽ. Hiện đứng đầu trong việc cung cấp các giải pháp tiên tiến.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-800 flex gap-6 text-sm">
                <div><span className="text-gray-500">Founder:</span> <span className="text-blue-400 ml-1">John Doe & Co.</span></div>
                <div><span className="text-gray-500">Founded:</span> <span className="text-white ml-1">1985</span></div>
              </div>
            </section>

            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2 italic">
                <Newspaper className="text-blue-500" size={20} /> Related News
              </h2>
              <div className="space-y-4">
                {news.map(item => (
                  <div key={item.id} className="group flex justify-between items-start p-4 rounded-xl hover:bg-[#1c212d] transition-colors border border-transparent hover:border-gray-700 cursor-pointer">
                    <div className="pr-4">
                      <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">{item.title}</h3>
                      <div className="flex gap-3 mt-2 text-xs text-gray-500"><span>{item.source}</span><span>•</span><span>{item.time}</span></div>
                    </div>
                    <ExternalLink size={16} className="text-gray-600 group-hover:text-white" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: ANALYSIS & STATS */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Fundamental Strength</h2>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <aside className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2 uppercase text-xs tracking-widest text-gray-500">
                <BarChart3 size={16} /> Market Statistics
              </h3>
              <div className="space-y-5">
                {[
                  { label: 'Market Cap', value: '2.84T' },
                  { label: 'P/E Ratio', value: '28.45' },
                  { label: 'Inst. Ownership', value: '64.2%', color: 'text-blue-400' },
                ].map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-gray-400">{stat.label}</span>
                    <span className={`font-mono font-bold ${stat.color || 'text-white'}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        {/* RELATED COMPANIES */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8">Compare with Related Companies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { ticker: 'MSFT', price: '420.12', change: '+1.2%' },
              { ticker: 'GOOGL', price: '175.45', change: '-0.5%' },
              { ticker: 'NVDA', price: '890.00', change: '+4.3%' },
              { ticker: 'AMZN', price: '180.00', change: '+0.8%' },
            ].map((item) => (
              <div key={item.ticker} className="bg-[#131722] hover:bg-[#1c212d] border border-gray-800 p-6 rounded-2xl transition-all shadow-lg group hover:-translate-y-1">
                <div className="flex justify-between items-start mb-5">
                  <span className="text-white font-bold text-xl group-hover:text-blue-400">{item.ticker}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${item.change.includes('+') ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {item.change}
                  </span>
                </div>
                <div className="text-2xl font-mono font-bold text-white">${item.price}</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default StockProfile;