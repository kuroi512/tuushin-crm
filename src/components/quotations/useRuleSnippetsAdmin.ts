import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QuotationRuleSnippet, RuleSnippetType } from '@/types/quotation';

type QueryOptions = {
  type?: RuleSnippetType;
  incoterm?: string;
  transportMode?: string;
  includeInactive?: boolean;
  search?: string;
};

type SnippetResponse = {
  success: boolean;
  data: QuotationRuleSnippet[];
  error?: string;
};

type MutationResponse = {
  success: boolean;
  data?: QuotationRuleSnippet;
  message?: string;
  error?: string;
};

type CreatePayload = {
  label: string;
  type: RuleSnippetType;
  incoterm?: string | null;
  transportMode?: string | null;
  content: string;
  isDefault?: boolean;
  order?: number;
  isActive?: boolean;
};

type UpdatePayload = {
  id: string;
  label?: string;
  type?: RuleSnippetType;
  incoterm?: string | null;
  transportMode?: string | null;
  content?: string;
  isDefault?: boolean;
  order?: number;
  isActive?: boolean;
};

type DeletePayload = {
  id: string;
  force?: boolean;
};

const baseKey = 'quotation-rule-snippets';

export function useRuleSnippets(options: QueryOptions) {
  const { type, incoterm, transportMode, includeInactive, search } = options;
  return useQuery<SnippetResponse>({
    queryKey: [
      baseKey,
      type ?? 'ALL',
      incoterm ?? '',
      transportMode ?? '',
      includeInactive ?? false,
      search ?? '',
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (incoterm) params.set('incoterm', incoterm);
      if (transportMode) params.set('transportMode', transportMode);
      if (includeInactive) params.set('includeInactive', 'true');
      if (search) params.set('search', search);
      const qs = params.toString();
      const res = await fetch(`/api/quotation-rules/snippets${qs ? `?${qs}` : ''}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as SnippetResponse | null;
        throw new Error(json?.error || 'Failed to fetch rule snippets');
      }
      return res.json();
    },
  });
}

export function useCreateRuleSnippet() {
  const qc = useQueryClient();
  return useMutation<MutationResponse, Error, CreatePayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/quotation-rules/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as MutationResponse;
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create snippet');
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [baseKey] });
    },
  });
}

export function useUpdateRuleSnippet() {
  const qc = useQueryClient();
  return useMutation<MutationResponse, Error, UpdatePayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/quotation-rules/snippets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as MutationResponse;
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update snippet');
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [baseKey] });
    },
  });
}

export function useDeleteRuleSnippet() {
  const qc = useQueryClient();
  return useMutation<MutationResponse, Error, DeletePayload>({
    mutationFn: async ({ id, force }) => {
      const params = new URLSearchParams({ id });
      if (force) params.set('force', 'true');
      const res = await fetch(`/api/quotation-rules/snippets?${params.toString()}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => ({}))) as MutationResponse;
      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete snippet');
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [baseKey] });
    },
  });
}
