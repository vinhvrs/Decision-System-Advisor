"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface Option {
  id: string;
  label: string;
}

interface SelectDropdownProps {
  options: Option[];
  selected: Option | null;
  onSelect: (option: Option) => void;
  placeholder?: string;
}

export default function SelectDropdown({
  options,
  selected,
  onSelect,
  placeholder = "Select an option",
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lọc danh sách dựa trên từ khóa tìm kiếm
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter((opt) => 
      opt.label.toLowerCase().includes(lowerSearch)
    ).slice(0, 100); // Chỉ hiển thị top 100 kết quả để tối ưu render
  }, [options, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search khi đóng/mở dropdown
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full min-w-[180px] gap-3 px-4 py-2.5 text-sm font-medium text-white bg-[#1e293b]/50 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-[#1e293b]/80 transition-all"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-[250px] mt-2 overflow-hidden bg-[#161D2C] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-150">
          {/* Ô Input tìm kiếm */}
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input
                autoFocus
                className="w-full bg-white/5 border border-white/5 rounded-xl px-9 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onSelect(option);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm text-white/70 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  <span className="truncate">{option.label}</span>
                  {selected?.id === option.id && <Check size={14} className="text-white" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-xs text-center text-white/30 italic">No assets found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}