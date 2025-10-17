'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, HelpCircle } from 'lucide-react';

export type CalendarStatus = 'CREATED' | 'CONFIRMED' | 'CANCELLED';

export type CalendarShipment = {
  id: string;
  code: string;
  status: CalendarStatus;
  title?: string;
  time?: string;
  description?: string;
};

export type CalendarRange = {
  start: string;
  end: string;
  today: string;
};

export type CalendarDay = {
  date: number;
  dateString: string;
  formattedDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  shipments: CalendarShipment[];
};

interface CalendarProps {
  data?: Record<string, CalendarShipment[]>;
  onRangeChange?: (range: CalendarRange) => void;
  onFetch?: () => void;
  onDayOpen?: (day: CalendarDay) => void;
  loading?: boolean;
}

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
] as const;

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function DashboardCalendar({
  data = {},
  onRangeChange,
  onFetch,
  onDayOpen,
  loading = false,
}: CalendarProps) {
  const t = useT();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [showHelpModal, setShowHelpModal] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement | null>(null);

  const getShipmentColor = useCallback((status: CalendarStatus) => {
    switch (status) {
      case 'CREATED':
        return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'CANCELLED':
        return 'bg-zinc-200 text-zinc-700 border-zinc-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }, []);

  const getShipmentBadge = useCallback((status: CalendarStatus) => {
    switch (status) {
      case 'CREATED':
        return 'bg-sky-500 text-white';
      case 'CONFIRMED':
        return 'bg-green-500 text-white';
      case 'CANCELLED':
        return 'bg-zinc-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }, []);

  const getShipmentLabel = useCallback(
    (status: CalendarStatus) => {
      switch (status) {
        case 'CREATED':
          return t('status.created');
        case 'CONFIRMED':
          return t('status.confirmed');
        case 'CANCELLED':
          return t('status.cancelled');
        default:
          return t('dashboard.calendar.shipmentType.unknown');
      }
    },
    [t],
  );

  const computeRange = useCallback((date: Date): CalendarRange => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const endOfMonth = new Date(year, month + 1, 0);
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    const today = new Date();
    let todayDate = endDate;
    if (year === today.getFullYear() && month === today.getMonth()) {
      todayDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    return { start: startDate, end: endDate, today: todayDate };
  }, []);

  useEffect(() => {
    const range = computeRange(currentDate);
    onRangeChange?.(range);
    onFetch?.();
  }, [currentDate, computeRange, onRangeChange, onFetch]);

  useEffect(() => {
    if (!showMonthPicker) return;
    const handler = (event: MouseEvent) => {
      if (!monthPickerRef.current?.contains(event.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMonthPicker]);

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startOfCalendar = new Date(firstOfMonth);
    const dayOfWeek = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
    startOfCalendar.setDate(firstOfMonth.getDate() - daysToSubtract);

    const days: CalendarDay[] = [];
    const cursor = new Date(startOfCalendar);

    for (let i = 0; i < 42; i += 1) {
      const dateString = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const shipmentsForDay = data[dateString] ?? [];

      days.push({
        date: cursor.getDate(),
        dateString,
        formattedDate: cursor.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        isCurrentMonth: cursor.getMonth() === month,
        isToday: cursor.toDateString() === new Date().toDateString(),
        shipments: shipmentsForDay,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [currentDate, data]);

  const toggleMonthPicker = () => {
    setPickerYear(currentDate.getFullYear());
    setShowMonthPicker((prev) => !prev);
  };

  const selectMonth = (monthIndex: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setFullYear(pickerYear);
    nextDate.setMonth(monthIndex);
    setCurrentDate(nextDate);
    setShowMonthPicker(false);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setPickerYear(new Date().getFullYear());
    setShowMonthPicker(false);
  };

  const navigate = (offset: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setMonth(nextDate.getMonth() + offset);
    setCurrentDate(nextDate);
  };

  const openDayModal = (day: CalendarDay) => {
    setSelectedDay(day);
    onDayOpen?.(day);
  };

  const closeDayModal = () => setSelectedDay(null);

  const openHelp = () => setShowHelpModal(true);
  const closeHelp = () => setShowHelpModal(false);

  const navigateToShipment = (shipment: CalendarShipment) => {
    const query = new URLSearchParams({ code: shipment.code }).toString();
    router.push(`/quotations?${query}`);
    closeDayModal();
  };

  return (
    <Card className="relative">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg">{t('dashboard.calendar.title')}</CardTitle>
            <CardDescription>{t('dashboard.calendar.subtitle')}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              aria-label={t('dashboard.calendar.prevMonth')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(1)}
              aria-label={t('dashboard.calendar.nextMonth')}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              {t('dashboard.calendar.today')}
            </Button>
            <Button variant="ghost" size="sm" onClick={openHelp}>
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">{t('dashboard.calendar.help')}</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleMonthPicker}
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>{`${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`}</span>
          </button>
          {loading && <span className="text-muted-foreground text-xs">{t('common.loading')}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showMonthPicker && (
          <div
            ref={monthPickerRef}
            className="date-picker-container absolute top-24 right-4 left-4 z-20 rounded-md border bg-white p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setPickerYear((y) => y - 1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{pickerYear}</span>
              <Button variant="ghost" size="icon" onClick={() => setPickerYear((y) => y + 1)}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((month, index) => (
                <Button
                  key={month}
                  variant={
                    index === currentDate.getMonth() && pickerYear === currentDate.getFullYear()
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() => selectMonth(index)}
                >
                  {month.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="text-muted-foreground grid grid-cols-7 text-center text-xs font-medium uppercase">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-sm">
          {calendarDays.map((day) => (
            <button
              key={day.dateString}
              type="button"
              onClick={() => openDayModal(day)}
              className={cn(
                'flex min-h-[88px] flex-col gap-1 rounded-md border px-2 py-2 text-left transition hover:border-blue-400 hover:shadow-sm',
                day.isCurrentMonth ? 'bg-white' : 'text-muted-foreground bg-slate-50',
                day.isToday && 'border-blue-500 bg-blue-50',
                day.shipments.length > 0 && 'border-blue-200',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{day.date}</span>
                {day.shipments.length > 0 && (
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                    {day.shipments.length}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {day.shipments.slice(0, 3).map((shipment) => (
                  <span
                    key={shipment.id}
                    className={cn(
                      'truncate rounded border px-1 py-0.5 text-[11px] font-medium',
                      getShipmentColor(shipment.status),
                    )}
                  >
                    {shipment.code}
                  </span>
                ))}
                {day.shipments.length > 3 && (
                  <span className="text-muted-foreground text-[11px]">
                    +{day.shipments.length - 3} {t('dashboard.calendar.more')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && closeDayModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDay?.formattedDate ?? t('dashboard.calendar.dayDetails')}
            </DialogTitle>
            <DialogDescription>
              {selectedDay?.shipments.length ?? 0} {t('dashboard.calendar.shipments')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedDay?.shipments.length ? (
              selectedDay.shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{shipment.code}</span>
                      <span className="text-muted-foreground text-xs">
                        {shipment.title ?? getShipmentLabel(shipment.status)}
                      </span>
                    </div>
                    <Badge className={cn('px-2', getShipmentBadge(shipment.status))}>
                      {getShipmentLabel(shipment.status)}
                    </Badge>
                  </div>
                  {shipment.description && (
                    <p className="text-muted-foreground mt-2 text-sm">{shipment.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={() => navigateToShipment(shipment)}>
                      {t('dashboard.calendar.viewDetails')}
                    </Button>
                    {shipment.time && (
                      <span className="text-muted-foreground text-xs">{shipment.time}</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.calendar.noShipments')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDayModal}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHelpModal} onOpenChange={(open) => setShowHelpModal(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dashboard.calendar.helpTitle')}</DialogTitle>
            <DialogDescription>{t('dashboard.calendar.helpSubtitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sky-500" />
              <span>{getShipmentLabel('CREATED')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span>{getShipmentLabel('CONFIRMED')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-zinc-500" />
              <span>{getShipmentLabel('CANCELLED')}</span>
            </div>
            <p className="text-muted-foreground text-xs">{t('dashboard.calendar.helpHint')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeHelp}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
