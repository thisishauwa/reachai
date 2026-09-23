"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: readonly SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase().trim())
      )
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full bg-white rounded-[12px] px-4 py-3.5 text-left text-sm sm:text-base flex items-center justify-between transition-all outline-none",
          isOpen ? "ring-2 ring-[#0073f3]" : "hover:bg-[#fafafa]",
          selectedOption ? "text-[#242b33]" : "text-[#a1aebc]"
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selectedOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="text-[#a1aebc] hover:text-[#495766] p-0.5 rounded-full transition-colors"
            >
              <X className="size-4" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-5 text-[#6e8298] transition-transform duration-200",
              isOpen && "rotate-180 text-[#0073f3]"
            )}
          />
        </div>
      </button>

      {/* Popover Dropdown with Search */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-[16px] shadow-lg border border-[#e4e8ec] p-2 flex flex-col gap-2 max-h-[300px]">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-4 text-[#a1aebc] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#f4f4f5] rounded-[10px] pl-9 pr-3 py-2 text-sm text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:ring-1 focus:ring-[#0073f3]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 text-[#a1aebc] hover:text-[#495766]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-[220px] flex flex-col gap-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs sm:text-sm text-[#6e8298]">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-[10px] text-left text-sm flex items-center justify-between transition-colors",
                      isSelected
                        ? "bg-[#f0f7ff] text-[#0073f3] font-medium"
                        : "hover:bg-[#f9f9f9] text-[#242b33]"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="size-4 text-[#0073f3]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
