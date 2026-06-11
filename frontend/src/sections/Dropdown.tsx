"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

export interface DropdownOption {
  id: string;
  label: string;
}

interface SelectDropdownProps {
  options: DropdownOption[];
  selected: DropdownOption | null;
  selectedIds?: string[];
  onSelect: (option: DropdownOption) => void;
  placeholder?: string;
  maxRender?: number;
  /** Show search box (long lists only). Default: simple list. */
  searchable?: boolean;
  className?: string;
  /** Render menu at document body level to escape chart/canvas stacking contexts. */
  portalMenu?: boolean;
}

export default function SelectDropdown({
  options,
  selected,
  selectedIds,
  onSelect,
  placeholder = "Select an option",
  maxRender = 100,
  searchable = false,
  className = "",
  portalMenu = false,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
    if (portalMenu) {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (rect) {
        setPortalStyle({
          position: "fixed",
          left: rect.left,
          top: rect.bottom + 4,
          width: rect.width,
          zIndex: 10020,
        });
      }
    }
    const idx = selected
      ? Math.max(0, options.findIndex((o) => o.id === selected.id))
      : 0;
    setActiveIndex(idx);
  };

  const handleSelect = (option: DropdownOption) => {
    onSelect(option);
    closeDropdown();
  };

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options.slice(0, maxRender);

    const lower = searchTerm.toLowerCase();
    return options
      .filter((opt) => opt.label.toLowerCase().includes(lower))
      .slice(0, maxRender);
  }, [options, searchTerm, maxRender, searchable]);

  useEffect(() => {
    if (searchTerm === "" && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
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

  useEffect(() => {
    if (!isOpen || !portalMenu) return;

    const updatePortalStyle = () => {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPortalStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 10020,
      });
    };

    updatePortalStyle();
    window.addEventListener("resize", updatePortalStyle);
    window.addEventListener("scroll", updatePortalStyle, true);

    return () => {
      window.removeEventListener("resize", updatePortalStyle);
      window.removeEventListener("scroll", updatePortalStyle, true);
    };
  }, [isOpen, portalMenu]);

  const menu = isOpen ? (
    <div
      ref={menuRef}
      style={portalMenu ? portalStyle ?? undefined : undefined}
      className={`${portalMenu ? "fixed" : "absolute"} z-[100] mt-1 w-full min-w-full overflow-hidden rounded-lg border border-white/10 bg-[#1e212b] shadow-xl`}
    >
      {searchable ? (
        <div className="border-b border-white/10 p-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
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
              placeholder="Search…"
              className="w-full rounded-md border border-white/10 bg-[#262a3b] py-2 pl-8 pr-2 text-xs text-white placeholder:text-white/35 focus:border-[#3861fb]/50 focus:outline-none"
            />
          </div>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="max-h-56 overflow-y-auto no-scrollbar py-0.5"
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, idx) => {
            const isActive = idx === activeIndex;
            const isSelected = selectedIds?.includes(option.id) || selected?.id === option.id;

            return (
              <button
                key={option.id}
                type="button"
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? "bg-[#2c344e] text-white"
                    : isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-white/90 hover:bg-white/[0.06]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check size={16} className="shrink-0 text-[#3861fb]" />
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center text-xs text-white/45">
            No results
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-expanded={isOpen}
        className="flex w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#262a3b] px-3 py-2.5 text-sm font-medium text-white transition hover:border-white/20 hover:bg-[#2d3148]"
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/45 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {portalMenu && menu && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : menu}
    </div>
  );
}
