'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ComboBoxProps = {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

export function ComboBox({
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

  const filtered = useMemo(() => {
    const v = (value ?? '').toLowerCase().trim();
    if (!v) return options.slice(0, 20);
    return options.filter((o) => o.toLowerCase().includes(v)).slice(0, 20);
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
    <div ref={wrapRef} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled || (isLoading && options.length === 0)}
        className={cn(isLoading ? 'pr-8' : undefined)}
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
      {isLoading && (
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
