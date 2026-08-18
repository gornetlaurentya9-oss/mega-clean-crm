import { useEffect, useMemo, useRef, useState } from "react";
import { FieldWrap, cx } from "./ui";
import { ChevronRightIcon, CloseIcon } from "./Icons";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Optional secondary text shown under the label in the dropdown (e.g. phone number). */
  sublabel?: string;
}

interface SearchSelectProps {
  label?: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  /** Shown when nothing is selected, and as the top "clear" option when the field isn't required. */
  placeholder: string;
  disabled?: boolean;
}

/**
 * A type-to-search replacement for a plain <select> full of client/employee names — a native
 * select only lets you jump between options by typing their first letter (and only ever one
 * letter at a time before it resets), which gets unusable once there are 60+ names in it.
 * Filters by substring anywhere in the label as you type, not just from the start.
 */
export function SearchSelect({ label, hint, required, value, onChange, options, placeholder, disabled }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectOption(v: string) {
    onChange(v);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) selectOption(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <FieldWrap label={label} hint={hint} required={required}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className={cx(
              "block w-full min-h-[44px] rounded-control border border-gray-300 bg-white py-2 pl-3 pr-16 text-base text-gray-900",
              "placeholder-gray-400 transition-all duration-150 ease-out focus:border-brand-accent focus:outline-none",
              "focus:ring-2 focus:ring-brand-accent/40 disabled:bg-gray-100"
            )}
            placeholder={placeholder}
            value={open ? query : (selected?.label ?? "")}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {!disabled && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-gray-400">
              {value && (
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectOption("");
                  }}
                  className="pointer-events-auto rounded-full p-1 hover:bg-gray-100 hover:text-gray-600"
                >
                  <CloseIcon size={14} />
                </button>
              )}
              <ChevronRightIcon size={14} className="rotate-90" />
            </div>
          )}
        </div>

        {open && !disabled && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-panel border border-gray-200 bg-white py-1 shadow-soft-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No matches.</p>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.value || "__empty__"}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep input focus so the click still registers
                  onClick={() => selectOption(opt.value)}
                  className={cx(
                    "block w-full px-3 py-2 text-left text-sm transition-colors",
                    i === highlighted ? "bg-brand-accent/10 text-brand-primary" : "text-gray-800 hover:bg-gray-50",
                    opt.value === value && "font-semibold"
                  )}
                >
                  {opt.label}
                  {opt.sublabel && <span className="ml-1.5 text-xs text-gray-400">{opt.sublabel}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </FieldWrap>
  );
}
