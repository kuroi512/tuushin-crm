import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

export type LookupOption = { id: string; name: string; code?: string | null; meta?: unknown };

type IncludeOption = 'code' | 'meta';

interface UseLookupOptions {
  include?: IncludeOption | IncludeOption[];
  includeInactive?: boolean;
}

export function useLookup(slug: string, opts?: UseLookupOptions) {
  const includeValues = useMemo(() => {
    if (!opts?.include) return [] as IncludeOption[];
    return Array.isArray(opts.include) ? opts.include : [opts.include];
  }, [opts?.include]);

  const qs = new URLSearchParams();
  if (includeValues.length) qs.set('include', includeValues.join(','));
  if (opts?.includeInactive) qs.set('includeInactive', 'true');
  const url = `/api/lookup/${encodeURIComponent(slug)}${qs.toString() ? `?${qs.toString()}` : ''}`;

  const includeKey = includeValues.length ? includeValues.slice().sort().join(',') : undefined;

  return useQuery<{ success: boolean; category: string; data: LookupOption[] }>({
    queryKey: ['lookup', slug, includeKey, opts?.includeInactive],
    queryFn: async () => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load lookup');
      return res.json();
    },
  });
}
