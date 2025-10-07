import { useQuery } from '@tanstack/react-query';
import type {
  QuotationRuleSelection,
  QuotationRuleSelectionState,
  QuotationRuleSnippet,
  RuleSnippetType,
} from '@/types/quotation';

export type RuleCatalogEntry = QuotationRuleSnippet;

export interface RuleCatalogDefaults {
  snippetIds: string[];
  source: 'mapping' | 'isDefault';
  matched: { incoterm: string | null; transportMode: string | null } | null;
}

export interface RuleCatalogResponse {
  incoterm: string | null;
  transportMode: string | null;
  snippets: Record<RuleSnippetType, RuleCatalogEntry[]>;
  defaults: Record<RuleSnippetType, RuleCatalogDefaults | null>;
}

const RULE_TYPES: RuleSnippetType[] = ['INCLUDE', 'EXCLUDE', 'REMARK'];

const DEFAULT_LABELS: Record<RuleSnippetType, string> = {
  INCLUDE: 'Include',
  EXCLUDE: 'Exclude',
  REMARK: 'Remark',
};

export function useRuleCatalog(incoterm?: string | null, transportMode?: string | null) {
  const inc = (incoterm || '').trim();
  const mode = (transportMode || '').trim();

  return useQuery<{ success: boolean; data: RuleCatalogResponse } | null>({
    queryKey: ['quotation-rule-catalog', inc, mode],
    enabled: !!inc || !!mode,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (inc) params.set('incoterm', inc);
      if (mode) params.set('transportMode', mode);
      const res = await fetch(`/api/quotation-rules/catalog?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to load quotation rule catalog');
      }
      return res.json();
    },
  });
}

export function toRuleKey(type: RuleSnippetType): keyof QuotationRuleSelectionState {
  if (type === 'INCLUDE') return 'include';
  if (type === 'EXCLUDE') return 'exclude';
  return 'remark';
}

export function fromRuleKey(key: keyof QuotationRuleSelectionState): RuleSnippetType {
  if (key === 'include') return 'INCLUDE';
  if (key === 'exclude') return 'EXCLUDE';
  return 'REMARK';
}

export function buildRuleText(items: QuotationRuleSelection[]): string {
  return items
    .map((item) => item.content.trim())
    .filter(Boolean)
    .join('\n');
}

export function applyCatalogDefaults(
  current: QuotationRuleSelectionState,
  catalog: RuleCatalogResponse | undefined,
): QuotationRuleSelectionState {
  if (!catalog) return current;

  const next: QuotationRuleSelectionState = {
    include: [...current.include],
    exclude: [...current.exclude],
    remark: [...current.remark],
  };

  for (const type of RULE_TYPES) {
    const key = toRuleKey(type);
    const def = catalog.defaults[type];
    const existing = current[key] ?? [];
    const shouldOverride =
      existing.length === 0 || existing.every((item) => (item.source ?? 'default') === 'default');
    if (def && def.snippetIds.length && shouldOverride) {
      const snippets = catalog.snippets[type] || [];
      next[key] = def.snippetIds
        .map((id) => snippets.find((s) => s.id === id))
        .filter((s): s is RuleCatalogEntry => Boolean(s))
        .map((s) => ({
          snippetId: s.id,
          label: s.label,
          type: s.type,
          content: s.content,
          source: 'default',
          incoterm: s.incoterm ?? null,
          transportMode: s.transportMode ?? null,
        }));
    } else if (!existing.length && !next[key]?.length) {
      // fall back to snippets flagged as default if no existing selections
      const flagged = (catalog.snippets[type] || []).filter((s) => s.isDefault);
      if (flagged.length) {
        next[key] = flagged.map((s) => ({
          snippetId: s.id,
          label: s.label,
          type: s.type,
          content: s.content,
          source: 'default',
          incoterm: s.incoterm ?? null,
          transportMode: s.transportMode ?? null,
        }));
      }
    }
  }
  return next;
}

export function emptyRuleSelectionState(): QuotationRuleSelectionState {
  return {
    include: [],
    exclude: [],
    remark: [],
  };
}

export function equalRuleStates(
  a: QuotationRuleSelectionState,
  b: QuotationRuleSelectionState,
): boolean {
  const keys: (keyof QuotationRuleSelectionState)[] = ['include', 'exclude', 'remark'];
  return keys.every((key) => {
    const arrA = a[key] ?? [];
    const arrB = b[key] ?? [];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((item, idx) => {
      const other = arrB[idx];
      return (
        item.snippetId === other.snippetId &&
        item.label === other.label &&
        item.content === other.content &&
        item.type === other.type &&
        (item.source ?? 'default') === (other.source ?? 'default')
      );
    });
  });
}

function normalizeList(
  raw: any,
  type: RuleSnippetType,
  fallbackText?: string,
): QuotationRuleSelection[] {
  const result: QuotationRuleSelection[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const content = typeof entry?.content === 'string' ? entry.content : '';
      const labelCandidate =
        typeof entry?.label === 'string'
          ? entry.label
          : typeof entry?.snippetLabel === 'string'
            ? entry.snippetLabel
            : DEFAULT_LABELS[type];
      if (!content && !fallbackText) {
        // allow empty content only if snippet still referenced to keep metadata
        if (!entry?.snippetId) continue;
      }
      result.push({
        snippetId: typeof entry?.snippetId === 'string' ? entry.snippetId : null,
        label: labelCandidate,
        type,
        content,
        source:
          entry?.source === 'custom' || entry?.source === 'manual'
            ? entry.source
            : entry?.source === 'default'
              ? 'default'
              : entry?.snippetId
                ? 'manual'
                : 'custom',
        incoterm: typeof entry?.incoterm === 'string' ? entry.incoterm : null,
        transportMode: typeof entry?.transportMode === 'string' ? entry.transportMode : null,
      });
    }
  }

  if (!result.length && fallbackText && fallbackText.trim()) {
    result.push({
      snippetId: null,
      label: DEFAULT_LABELS[type],
      type,
      content: fallbackText,
      source: 'custom',
      incoterm: null,
      transportMode: null,
    });
  }

  return result;
}

export function normalizeRuleSelectionState(source: any): QuotationRuleSelectionState {
  const base = emptyRuleSelectionState();
  if (!source) return base;
  const selections = source.ruleSelections ?? source;

  return {
    include: normalizeList(selections?.include, 'INCLUDE', source.include ?? source.included),
    exclude: normalizeList(selections?.exclude, 'EXCLUDE', source.exclude ?? source.excluded),
    remark: normalizeList(selections?.remark, 'REMARK', source.remark ?? source.specialNotes),
  };
}
