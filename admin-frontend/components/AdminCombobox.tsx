'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface AdminComboboxOption {
  value: string;
  label: string;
  description?: string | null;
  badge?: string | null;
  keywords?: string[];
}

export default function AdminCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Qidiring...',
  emptyMessage = 'Mos natija topilmadi',
  disabled = false,
  compact = false,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AdminComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => {
      const haystack = [
        option.label,
        option.description || '',
        option.badge || '',
        ...(option.keywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filteredOptions, open, value]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const commit = (nextValue: string) => {
    onChange(nextValue);
    close();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!filteredOptions.length && event.key !== 'Escape') return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) commit(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`admin-combobox ${compact ? 'compact' : ''} ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <button
        type="button"
        className={`admin-combobox-trigger ${selected ? 'has-value' : ''}`}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span className="admin-combobox-copy">
          <span className="admin-combobox-value">{selected?.label || placeholder}</span>
          {!compact ? (
            <span className="admin-combobox-description">
              {selected?.description || hint || 'Qidiruv bilan tez tanlash mumkin'}
            </span>
          ) : null}
        </span>
        <span className="admin-combobox-chevron" aria-hidden="true">v</span>
      </button>

      {open ? (
        <div className="admin-combobox-popover">
          <div className="admin-combobox-search">
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="admin-combobox-list" role="listbox" id={listboxId}>
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`admin-combobox-option ${option.value === value ? 'is-selected' : ''} ${index === highlightedIndex ? 'is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commit(option.value)}
                >
                  <span className="admin-combobox-option-copy">
                    <span className="admin-combobox-option-label">{option.label}</span>
                    {option.description ? <span className="admin-combobox-option-description">{option.description}</span> : null}
                  </span>
                  {option.badge ? <span className="admin-combobox-option-badge">{option.badge}</span> : null}
                </button>
              ))
            ) : (
              <div className="admin-combobox-empty">{emptyMessage}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
