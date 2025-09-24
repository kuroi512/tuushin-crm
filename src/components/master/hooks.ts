import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MasterOption {
  id: string;
  category: string;
  name: string;
  code?: string | null;
  meta?: any;
  externalId?: string | null;
  source: 'EXTERNAL' | 'INTERNAL';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const baseKey = (category?: string) => ['master-options', category || 'ALL'];

export function useMasterOptions(category?: string) {
  return useQuery<{ success: boolean; data: MasterOption[] }>({
    queryKey: baseKey(category),
    queryFn: async () => {
      const url = new URL('/api/master', window.location.origin);
      if (category) url.searchParams.set('category', category);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch master options');
      return res.json();
    },
  });
}

interface CreatePayload {
  category: string;
  name: string;
  code?: string | null;
  meta?: any;
}

export function useCreateMasterOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const res = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      return json;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: baseKey(data.data?.category) });
    },
  });
}

interface UpdatePayload {
  id: string;
  name?: string;
  code?: string | null;
  meta?: any;
  isActive?: boolean;
}

export function useUpdateMasterOption(category?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      const res = await fetch('/api/master', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(category) });
    },
  });
}

export function useDeleteMasterOption(category?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/master?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(category) });
    },
  });
}
