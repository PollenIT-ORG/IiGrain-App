import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  searchable?: boolean;
  error?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  id,
  disabled = false,
  searchable = false,
  error = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const visibleOptions =
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase())
        )
      : options;

  const close = useCallback(() => setOpen(false), []);

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = Math.min(240, options.length * 40 + 8);
      const goUp = spaceBelow < menuHeight && rect.top > spaceBelow;

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        ...(goUp
          ? { bottom: window.innerHeight - rect.top - window.scrollY, top: "auto" }
          : { top: rect.bottom + 6 }),
        zIndex: 9999,
      });
    }
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    if (searchable) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = Math.min(240, options.length * 40 + 8);
      const goUp = spaceBelow < menuHeight && rect.top > spaceBelow;

      setMenuStyle((prev) => ({
        ...prev,
        left: rect.left,
        width: rect.width,
        ...(goUp
          ? { bottom: window.innerHeight - rect.top, top: "auto" }
          : { top: rect.bottom + 6 }),
      }));
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (open && !searchable) {
      const idx = options.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, value, searchable]);

  function pick(v: string) {
    onChange(v);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(visibleOptions.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (visibleOptions[activeIndex]) pick(visibleOptions[activeIndex].value);
        break;
    }
  }

  const menu = open
    ? createPortal(
        <div
          style={menuStyle}
          className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-card-hover"
        >
          {searchable && (
            <div className="border-b border-gray-200 p-2">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {visibleOptions.length === 0 ? (
              <li className="px-3.5 py-2 text-sm text-gray-500">
                No matches.
              </li>
            ) : (
              visibleOptions.map((opt, i) => {
                const isSelected = opt.value === value;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(opt.value);
                    }}
                    className={`flex cursor-pointer items-center justify-between px-3.5 py-2 text-sm ${
                      isActive ? "bg-primary/10" : ""
                    } ${
                      isSelected
                        ? "font-semibold text-primary"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isSelected && (
                      <svg
                        className="ml-2 h-4 w-4 shrink-0 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${
          error
            ? "border-danger focus:ring-danger/20"
            : open
              ? "border-primary"
              : "border-gray-300"
        }`}
      >
        <span
          className={`min-w-0 truncate ${
            selected ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {menu}
    </div>
  );
}
