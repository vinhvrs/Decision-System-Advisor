/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Search, 
  Filter,
  FileCode,
  FileBarChart,
  BookOpen
} from 'lucide-react';

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Flat data danh sách tài liệu
  const documents = [
    {
      id: 1,
      title: 'Market Analysis Report - Q1 2024',
      description: 'Comprehensive analysis of stock market trends and liquidity rankings for the first quarter.',
      category: 'Report',
      type: 'PDF',
      size: '2.4 MB',
      updatedAt: '2 hours ago',
      icon: <FileBarChart className="text-blue-400" size={28} />
    },
    {
      id: 2,
      title: 'Algorithmic Strategy Guide',
      description: 'A detailed guide on how to implement technical indicators in automated trading strategies.',
      category: 'Technical',
      type: 'DOCX',
      size: '1.8 MB',
      updatedAt: '1 day ago',
      icon: <FileCode className="text-purple-400" size={28} />
    },
    {
      id: 3,
      title: 'Trading Terms & Conditions',
      description: 'Official documentation regarding platform usage, data privacy, and trading regulations.',
      category: 'Legal',
      type: 'PDF',
      size: '850 KB',
      updatedAt: 'Mar 12, 2024',
      icon: <BookOpen className="text-orange-400" size={28} />
    },
    {
      id: 4,
      title: 'Indicator Calculation Formula',
      description: 'Mathematical breakdowns of RSI, MACD, and custom liquidity indicators used in DSA.',
      category: 'Math',
      type: 'PDF',
      size: '1.2 MB',
      updatedAt: '3 days ago',
      icon: <FileText className="text-green-400" size={28} />
    }
  ];

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-3">Resource Center</h1>
            <p className="text-gray-400">Access our latest market reports, technical guides, and legal documents.</p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <input 
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#161a21] border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          </div>
        </div>

        {/* Categories Quick Filter */}
        <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-2 no-scrollbar">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium">
            <Filter size={16} /> All Files
          </button>
          {['Reports', 'Technical', 'Legal', 'Guides'].map((cat) => (
            <button key={cat} className="px-4 py-2 rounded-lg bg-[#161a21] border border-gray-800 text-gray-400 text-sm font-medium hover:text-white hover:border-gray-600 transition-all">
              {cat}
            </button>
          ))}
        </div>

        {/* Document Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id} 
              className="group bg-[#161a21] border border-gray-800/50 rounded-2xl p-6 hover:border-indigo-500/40 transition-all shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                  {doc.icon}
                </div>
                <div className="flex gap-2">
                  <button className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Preview">
                    <ExternalLink size={18} />
                  </button>
                  <button className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Download">
                    <Download size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                {doc.title}
              </h3>
              <p className="text-sm text-gray-400 line-clamp-2 mb-6 leading-relaxed">
                {doc.description}
              </p>

              <div className="flex items-center justify-between border-t border-gray-800/50 pt-4 mt-auto">
                <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {doc.type}
                  </span>
                  <span>{doc.size}</span>
                </div>
                <span className="text-[11px] text-gray-600 font-medium italic">
                  Updated {doc.updatedAt}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredDocs.length === 0 && (
          <div className="text-center py-20 bg-[#161a21] rounded-3xl border border-dashed border-gray-800">
            <FileText size={48} className="mx-auto text-gray-700 mb-4" />
            <h3 className="text-xl font-semibold text-white">No documents found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}