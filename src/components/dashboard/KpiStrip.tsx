'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';

type StatusKey =
  | 'CANCELLED'
  | 'CREATED'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'ARRIVED'
  | 'RELEASED'
  | 'CLOSED';

export function KpiStrip({ compact = false }: { compact?: boolean }) {
  const fallbackCounts: Record<StatusKey, number> = useMemo(
    () => ({
      CANCELLED: 0,
      CREATED: 0,
      QUOTATION: 0,
      CONFIRMED: 0,
      ONGOING: 0,
      ARRIVED: 0,
      RELEASED: 0,
      CLOSED: 0,
    }),
    [],
  );

  const { data: counts = fallbackCounts } = useQuery<Record<StatusKey, number>>({
    queryKey: ['kpi-strip-counts'],
    queryFn: async () => {
      const res = await fetch('/api/quotations?includeCounts=1&scope=all');
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.counts) {
        throw new Error(json?.error || 'Failed to load KPI counts');
      }
      return { ...fallbackCounts, ...json.counts } as Record<StatusKey, number>;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const router = useRouter();
  const t = useT();

  const items: { key: StatusKey; label: string; color: string }[] = [
    { key: 'CREATED', label: t('status.created'), color: 'bg-sky-100 text-sky-700' },
    { key: 'CONFIRMED', label: t('status.confirmed'), color: 'bg-green-100 text-green-700' },
    { key: 'CANCELLED', label: t('status.cancelled'), color: 'bg-gray-200 text-gray-800' },
  ];

  const handleNavigate = (status: StatusKey) => {
    router.push(`/quotations?status=${status}`);
  };

  return (
    <div className={`${compact ? '' : 'px-1'} w-full overflow-x-auto`}>
      <div
        className={`flex items-stretch ${compact ? 'gap-1.5 sm:gap-2' : 'gap-2 sm:gap-3'} min-w-max`}
      >
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => handleNavigate(it.key)}
            className={`flex items-center whitespace-nowrap ${compact ? 'rounded px-1.5 py-1 text-xs sm:px-2' : 'rounded px-2 py-1.5 text-xs sm:rounded-md sm:px-3 sm:py-2 sm:text-sm'} ${it.color} shadow-sm transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
          >
            <div
              className={`font-semibold ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} mr-1 sm:mr-2`}
            >
              {counts[it.key]}
            </div>
            <div className="text-xs opacity-80 sm:text-sm">{it.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
