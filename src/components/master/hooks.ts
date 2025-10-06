import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { JsonValue } from '@/types/common';

export interface MasterOption {
  id: string;
  category: string;
  name: string;
  code?: string | null;
  meta?: JsonValue;
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
      const qs = category ? `?category=${encodeURIComponent(category)}` : '';
      // Relative fetch works both client-side and (if ever needed) in RSC transitions.
      const res = await fetch(`/api/master${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch master options');
      return res.json();
    },
  });
}

interface CreatePayload {
  category: string;
  name: string;
  code?: string | null;
  meta?: JsonValue;
}

type MasterMutationResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: MasterOption;
};

export function useCreateMasterOption() {
  const qc = useQueryClient();
  return useMutation<MasterMutationResponse, Error, CreatePayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      return json;
    },
    onSuccess: (data) => {
      if (data.data?.category) {
        qc.invalidateQueries({ queryKey: baseKey(data.data.category) });
      } else {
        qc.invalidateQueries({ queryKey: baseKey() });
      }
    },
  });
}

interface UpdatePayload {
  id: string;
  name?: string;
  code?: string | null;
  meta?: JsonValue;
  isActive?: boolean;
}

export function useUpdateMasterOption(category?: string) {
  const qc = useQueryClient();
  return useMutation<MasterMutationResponse, Error, UpdatePayload>({
    mutationFn: async (payload) => {
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
  return useMutation<MasterMutationResponse, Error, string>({
    mutationFn: async (id) => {
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
