"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface Option {
  id: string | number;
  label: string;
}

interface Props {
  options: Option[];
  selected: Option | null;
  onSelect: (item: Option) => void;
  placeholder?: string;
}

export default function SelectDropdown({ options, selected, onSelect, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-72">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-2 border rounded-lg bg-white shadow-sm"
      >
        <span>{selected?.label || placeholder || "Select..."}</span>
        <ChevronDown size={18} />
      </button>

      {open && (
        <div className="absolute w-full mt-2 border bg-white rounded-lg shadow-md z-50">
          <div className="p-2">
            <input
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-gray-500">No matches</p>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
