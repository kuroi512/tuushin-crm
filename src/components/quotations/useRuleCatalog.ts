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

type TranslationMap = Record<string, string>;

function cleanTranslations(map?: Record<string, unknown> | null): TranslationMap | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const entries = Object.entries(map).reduce<TranslationMap>((acc, [key, value]) => {
    if (typeof value !== 'string') return acc;
    const trimmed = value.trim();
    if (!trimmed) return acc;
    acc[key.toLowerCase()] = trimmed;
    return acc;
  }, {});
  return Object.keys(entries).length ? entries : undefined;
}

function normalizeTranslations(
  input: Record<string, unknown> | null | undefined,
  fallback?: string,
): TranslationMap | undefined {
  const base = cleanTranslations(input) ?? {};
  if (typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed) {
      if (!base.en) {
        base.en = trimmed;
      } else if (!base.en.trim()) {
        base.en = trimmed;
      }
    }
  }
  return Object.keys(base).length ? base : undefined;
}

function translationsEqual(
  a?: Record<string, string> | null,
  b?: Record<string, string> | null,
): boolean {
  const sortEntries = (map?: Record<string, string> | null) => {
    const cleaned = cleanTranslations(map) ?? {};
    return Object.entries(cleaned)
      .map(([key, value]) => [key, value.trim()] as [string, string])
      .sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  };
  const aEntries = sortEntries(a);
  const bEntries = sortEntries(b);
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([key, value], idx) => {
    const [otherKey, otherValue] = bEntries[idx];
    return key === otherKey && value === otherValue;
  });
}

function normalizeSnippetTranslations(snippet: QuotationRuleSnippet): TranslationMap | undefined {
  const map = normalizeTranslations(snippet.contentTranslations ?? undefined, snippet.content);
  if (!map && snippet.content.trim()) {
    return { en: snippet.content.trim() };
  }
  return map;
}

export function getSelectionContent(item: QuotationRuleSelection, language: string = 'en'): string {
  const lang = (language || 'en').toLowerCase().trim();
  const translations = cleanTranslations(item.translations ?? undefined) ?? {};

  // Prioritize translations.en over item.content, as item.content might be in a different language
  const english = translations.en?.trim() || (item.content ?? '').trim() || '';

  // If language is English, return English content from translations first
  if (lang === 'en') {
    return english;
  }

  // Try to get translation for the requested language
  const translated = translations[lang]?.trim();
  if (translated) return translated;

  // Fallback to English if translation not found
  return english;
}

export function useRuleCatalog(incoterm?: string | null, transportMode?: string | null) {
  const inc = (incoterm || '').trim();
  const mode = (transportMode || '').trim();

  return useQuery<{ success: boolean; data: RuleCatalogResponse } | null>({
    queryKey: ['quotation-rule-catalog', inc, mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (inc) params.set('incoterm', inc);
      if (mode) params.set('transportMode', mode);
      const query = params.toString();
      const url = query ? `/api/quotation-rules/catalog?${query}` : '/api/quotation-rules/catalog';
      const res = await fetch(url, { cache: 'no-store' });
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

export function buildRuleText(items: QuotationRuleSelection[], language = 'en'): string {
  return items
    .map((item) => getSelectionContent(item, language).trim())
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
        .map((s) => {
          const translations = normalizeSnippetTranslations(s);
          const content = (translations?.en ?? s.content ?? '').trim();
          return {
            snippetId: s.id,
            label: s.label,
            type: s.type,
            content,
            source: 'default' as const,
            incoterm: s.incoterm ?? null,
            transportMode: s.transportMode ?? null,
            translations,
          };
        });
    } else if (!existing.length && !next[key]?.length) {
      // fall back to snippets flagged as default if no existing selections
      const flagged = (catalog.snippets[type] || []).filter((s) => s.isDefault);
      if (flagged.length) {
        next[key] = flagged.map((s) => {
          const translations = normalizeSnippetTranslations(s);
          const content = (translations?.en ?? s.content ?? '').trim();
          return {
            snippetId: s.id,
            label: s.label,
            type: s.type,
            content,
            source: 'default' as const,
            incoterm: s.incoterm ?? null,
            transportMode: s.transportMode ?? null,
            translations,
          };
        });
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
        (item.source ?? 'default') === (other.source ?? 'default') &&
        translationsEqual(item.translations ?? undefined, other.translations ?? undefined)
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
      const rawContent = typeof entry?.content === 'string' ? entry.content : '';
      const fallback = typeof fallbackText === 'string' ? fallbackText : '';
      const translations = normalizeTranslations(
        (entry?.translations as Record<string, unknown>) ?? undefined,
        rawContent || fallback,
      );
      const content = (rawContent || translations?.en || fallback).trim();
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
        translations,
      });
    }
  }

  if (!result.length && fallbackText && fallbackText.trim()) {
    const fallbackContent = typeof fallbackText === 'string' ? fallbackText.trim() : '';
    result.push({
      snippetId: null,
      label: DEFAULT_LABELS[type],
      type,
      content: fallbackContent,
      source: 'custom',
      incoterm: null,
      transportMode: null,
      translations: normalizeTranslations(undefined, fallbackContent),
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
