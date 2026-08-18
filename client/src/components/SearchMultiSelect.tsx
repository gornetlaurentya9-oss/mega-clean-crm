import { useEffect, useMemo, useRef, useState } from "react";
import { FieldWrap, cx } from "./ui";
import { ChevronRightIcon, CloseIcon } from "./Icons";
import type { SearchSelectOption } from "./SearchSelect";

interface SearchMultiSelectProps {
  label?: string;
  hint?: string;
  required?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
  options: SearchSelectOption[];
  /** Shown in the search input when nothing (more) is selected yet. */
  placeholder: string;
  disabled?: boolean;
}

/**
 * Multi-select sibling of `SearchSelect` — same type-to-filter/keyboard-nav combobox, but
 * selections accumulate as removable chips above the input instead of replacing a single value.
 * Used for job/pattern employee assignment, where a house can be cleaned by more than one person
 * at once. Chip styling matches the app's existing chip pattern (see EmployeeDetail's time-off
 * chips) rather than inventing a new visual language.
 */
export function SearchMultiSelect({ label, hint, required, values, onChange, options, placeholder, disabled }: SearchMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = useMemo(
    () => values.map((v) => options.find((o) => o.value === v)).filter((o): o is SearchSelectOption => !!o),
    [values, options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = options.filter((o) => !values.includes(o.value));
    if (!q) return available;
    return available.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, values, query]);

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

  function addOption(v: string) {
    onChange([...values, v]);
    setQuery("");
    setHighlighted(0);
    inputRef.current?.focus();
  }

  function removeOption(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "Backspace" && query === "" && values.length > 0) {
      removeOption(values[values.length - 1]);
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
      if (opt) addOption(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <FieldWrap label={label} hint={hint} required={required}>
      <div ref={containerRef} className="relative">
        {selectedOptions.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="flex items-center gap-1.5 rounded-control border border-brand-accent/30 bg-brand-accent/5 px-2.5 py-1 text-sm font-medium text-brand-navy"
              >
                {opt.label}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeOption(opt.value)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                    aria-label={`Remove ${opt.label}`}
                  >
                    <CloseIcon size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className={cx(
              "block w-full min-h-[44px] rounded-control border border-gray-300 bg-white py-2 pl-3 pr-9 text-base text-gray-900",
              "placeholder-gray-400 transition-all duration-150 ease-out focus:border-brand-accent focus:outline-none",
              "focus:ring-2 focus:ring-brand-accent/40 disabled:bg-gray-100"
            )}
            placeholder={selectedOptions.length > 0 ? "Add another…" : placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {!disabled && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
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
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep input focus so the click still registers
                  onClick={() => addOption(opt.value)}
                  className={cx(
                    "block w-full px-3 py-2 text-left text-sm transition-colors",
                    i === highlighted ? "bg-brand-accent/10 text-brand-primary" : "text-gray-800 hover:bg-gray-50"
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
