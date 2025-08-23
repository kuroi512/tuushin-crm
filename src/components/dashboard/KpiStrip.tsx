'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';

type StatusKey =
  | 'CANCELLED'
  | 'CREATED'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'ARRIVED'
  | 'RELEASED'
  | 'CLOSED';

interface QuotationLite {
  status?: StatusKey;
}

export function KpiStrip({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<QuotationLite[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/quotations');
        const json = await res.json();
        setData(json?.data ?? []);
      } catch {}
    })();
  }, []);

  const counts = useMemo(() => {
    const keys: StatusKey[] = [
      'CANCELLED',
      'CREATED',
      'QUOTATION',
      'CONFIRMED',
      'ONGOING',
      'ARRIVED',
      'RELEASED',
      'CLOSED',
    ];
    const map = Object.fromEntries(keys.map((k) => [k, 0])) as Record<StatusKey, number>;
    for (const q of data) {
      const s = (q.status ?? 'QUOTATION') as StatusKey;
      map[s]++;
    }
    return map;
  }, [data]);

  const items: { key: StatusKey; label: string; color: string }[] = [
    { key: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-200 text-gray-800' },
    { key: 'CREATED', label: 'Created', color: 'bg-sky-100 text-sky-700' },
    { key: 'QUOTATION', label: 'Quotation', color: 'bg-indigo-100 text-indigo-700' },
    { key: 'CONFIRMED', label: 'Confirmed', color: 'bg-green-100 text-green-700' },
    { key: 'ONGOING', label: 'Ongoing', color: 'bg-amber-100 text-amber-700' },
    { key: 'ARRIVED', label: 'Arrived', color: 'bg-blue-100 text-blue-700' },
    { key: 'RELEASED', label: 'Released', color: 'bg-emerald-100 text-emerald-700' },
    { key: 'CLOSED', label: 'Closed', color: 'bg-zinc-100 text-zinc-800' },
  ];

  return (
    <div className={`${compact ? '' : 'px-1'} w-full overflow-x-auto`}>
      <div className={`flex items-stretch ${compact ? 'gap-2' : 'gap-3'} min-w-max`}>
        {items.map((it) => (
          <div
            key={it.key}
            className={`flex items-center ${compact ? 'rounded px-2 py-1 text-xs' : 'rounded-md px-3 py-2 text-sm'} ${it.color} shadow-sm`}
          >
            <div className={`font-semibold ${compact ? 'text-sm' : 'text-base'} mr-2`}>
              {counts[it.key]}
            </div>
            <div className="opacity-80">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
