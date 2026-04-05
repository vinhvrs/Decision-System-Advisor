"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  KeyboardEvent,
} from "react";
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
  maxRender?: number;
}

export default function SelectDropdown({
  options,
  selected,
  onSelect,
  placeholder = "Select an option",
  maxRender = 100,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  /* ================= REFS ================= */
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(0);
  };

  const openDropdown = () => {
    setIsOpen(true);
    setSearchTerm("");
    setActiveIndex(0);
  };

  const handleSelect = (option: Option) => {
    onSelect(option);
    closeDropdown();
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options.slice(0, maxRender);

    const lower = searchTerm.toLowerCase();
    return options
      .filter((opt) => opt.label.toLowerCase().includes(lower))
      .slice(0, maxRender);
  }, [options, searchTerm, maxRender]);

  useEffect(() => {
    if (searchTerm === "" && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        Math.min(i + 1, filteredOptions.length - 1)
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) handleSelect(option);
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  };

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* BUTTON */}
      <button
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className="flex items-center justify-between w-full min-w-[200px] gap-3 px-4 py-2.5 text-sm font-medium text-white bg-[#1e293b]/60 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-[#1e293b]/80 transition-all"
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-white/40 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-[260px] mt-2 bg-[#161D2C] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-150">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === "") {
                    setActiveIndex(0);
                  }
                }}
                placeholder="Type to search..."
                className="w-full bg-white/5 border border-white/5 rounded-xl px-9 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto custom-scrollbar"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = selected?.id === option.id;

                return (
                  <button
                    key={option.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(option)}
                    className={`flex items-center justify-between w-full px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-xs text-center text-white/30 italic">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
