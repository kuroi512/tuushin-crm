'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '@/lib/utils';
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';

interface DatePickerProps {
  id?: string;
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select date',
  className,
  disabled,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) {
      const parsed = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const displayValue =
    selectedDate && isValid(selectedDate) ? format(selectedDate, 'MMM dd, yyyy') : '';

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is outside both the input wrapper and the calendar popup
      const isOutsideInput = wrapRef.current && !wrapRef.current.contains(target);
      const isOutsideCalendar = calendarRef.current && !calendarRef.current.contains(target);

      if (isOutsideInput && isOutsideCalendar) {
        setOpen(false);
      }
    };

    const onEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      // Small delay to prevent immediate closing when opening
      setTimeout(() => {
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEscKey);
      }, 0);

      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onEscKey);
      };
    }
  }, [open]);

  useEffect(() => {
    if (open && wrapRef.current) {
      const updatePosition = () => {
        if (!wrapRef.current) return;
        const rect = wrapRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      };

      updatePosition();

      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open]);

  const handleDateSelect = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');

    // Check min/max constraints
    if (minDate && formatted < minDate) return;
    if (maxDate && formatted > maxDate) return;

    onChange(formatted);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const goToPrevMonth = () => setViewMonth((prev) => subMonths(prev, 1));
  const goToNextMonth = () => setViewMonth((prev) => addMonths(prev, 1));

  const start = startOfMonth(viewMonth);
  const end = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start, end });

  // Calculate padding days for calendar grid
  const startDayOfWeek = start.getDay(); // 0 = Sunday
  const paddingStart = Array(startDayOfWeek).fill(null);

  const today = new Date();

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Input
          id={id}
          value={displayValue}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly
          className="cursor-pointer pr-20"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {value && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={handleClear}
            >
              <X className="text-muted-foreground hover:text-foreground h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-transparent"
            onClick={() => !disabled && setOpen(true)}
          >
            <Calendar className="text-muted-foreground h-4 w-4" />
          </Button>
        </div>
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={calendarRef}
            className="fixed z-[9999] w-[280px] rounded-md border bg-white p-3 shadow-xl"
            style={{
              top: `${position.top + 8}px`,
              left: `${position.left}px`,
              maxWidth: '280px',
            }}
          >
            {/* Month/Year header */}
            <div className="mb-3 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToPrevMonth}
                className="h-7 w-7 p-0"
              >
                ‹
              </Button>
              <span className="text-sm font-medium">
                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                className="h-7 w-7 p-0"
              >
                ›
              </Button>
            </div>

            {/* Days of week */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="text-muted-foreground text-center text-xs font-medium">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {paddingStart.map((_, idx) => (
                <div key={`pad-${idx}`} />
              ))}
              {daysInMonth.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const isDisabled = Boolean(
                  (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate),
                );

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isDisabled && handleDateSelect(date)}
                    disabled={isDisabled}
                    className={cn(
                      'h-8 w-8 rounded-md text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isSelected &&
                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                      isToday && !isSelected && 'border-primary border',
                      !isSameMonth(date, viewMonth) && 'text-muted-foreground opacity-50',
                      isDisabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Quick actions */}
            <div className="mt-3 flex justify-between border-t pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const todayStr = format(today, 'yyyy-MM-dd');
                  if ((!minDate || todayStr >= minDate) && (!maxDate || todayStr <= maxDate)) {
                    onChange(todayStr);
                    setOpen(false);
                  }
                }}
                className="text-xs"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
