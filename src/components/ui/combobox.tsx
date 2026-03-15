'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';

type ComboBoxProps = {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

export function ComboBox({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
  isLoading,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasValue = typeof value === 'string' && value.trim().length > 0;
  const canClear = hasValue && !disabled;
  const showLoading = Boolean(isLoading) && !canClear;

  const filtered = useMemo(() => {
    const v = (value ?? '').toLowerCase().trim();
    if (!v) return options;
    return options.filter((o) => o.toLowerCase().includes(v));
  }, [options, value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled || (isLoading && options.length === 0)}
        className={cn(canClear || showLoading ? 'pr-8' : undefined)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setOpen(true);
            return;
          }
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            setActive((a) => Math.min(a + 1, filtered.length - 1));
            e.preventDefault();
          }
          if (e.key === 'ArrowUp') {
            setActive((a) => Math.max(a - 1, 0));
            e.preventDefault();
          }
          if (e.key === 'Enter') {
            if (active >= 0 && filtered[active]) {
              onChange(filtered[active]);
              setOpen(false);
            }
          }
        }}
      />
      {canClear ? (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
            setActive(-1);
            setOpen(false);
          }}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center"
          aria-label="Clear selection"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {showLoading && (
        <Loader2 className="text-muted-foreground absolute top-2 right-2 h-4 w-4 animate-spin" />
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow">
          <ul className="max-h-56 overflow-auto py-1 text-sm">
            {filtered.map((opt, idx) => (
              <li
                key={opt + idx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'hover:bg-accent cursor-pointer px-3 py-2',
                  active === idx && 'bg-accent',
                )}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
