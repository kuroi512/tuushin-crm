import { useQuery } from '@tanstack/react-query';

export type LookupOption = { id: string; name: string; code?: string | null };

export function useLookup(slug: string, opts?: { include?: 'code'; includeInactive?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.include) qs.set('include', opts.include);
  if (opts?.includeInactive) qs.set('includeInactive', 'true');
  const url = `/api/lookup/${encodeURIComponent(slug)}${qs.toString() ? `?${qs.toString()}` : ''}`;

  return useQuery<{ success: boolean; category: string; data: LookupOption[] }>({
    queryKey: ['lookup', slug, opts?.include, opts?.includeInactive],
    queryFn: async () => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load lookup');
      return res.json();
    },
  });
}
