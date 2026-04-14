'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComboBox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { useLookup, type LookupOption } from '@/components/lookup/hooks';
import {
  DraftsModal,
  addDraft,
  getDraftById,
  QuotationDraft,
} from '@/components/quotations/DraftsModal';
import { useT } from '@/lib/i18n';
import {
  QuotationTextList,
  type QuotationTextItem,
} from '@/components/quotations/QuotationTextList';
import type { QuotationOffer } from '@/types/quotation';
import type { RateItem } from '@/lib/quotations/rates';
import {
  computeProfitFromRates,
  ensureSinglePrimaryRate,
  sumRateAmounts,
} from '@/lib/quotations/rates';
import { EnhancedOfferTabs } from '@/components/quotations/EnhancedOfferTabs';
import { ensureOfferSequence, serializeOffersForPayload } from '@/lib/quotations/offer-helpers';

type Rate = RateItem;
type Dim = { length: number; width: number; height: number; quantity: number; cbm: number };
type DimensionPayload = {
  length: number;
  width: number;
  height: number;
  quantity: number;
  cbm: number;
};

// Helper function to create initial offer
const createInitialOffer = (): QuotationOffer => ({
  id: generateOfferId(),
  quotationId: '',
  title: 'Offer 1',
  order: 0,
  offerNumber: undefined,
  transportMode: undefined,
  borderPort: undefined,
  incoterm: undefined,
  shipper: undefined,
  terminal: undefined,
  transitTime: undefined,
  rate: undefined,
  rateCurrency: 'USD',
  grossWeight: undefined,
  dimensionsCbm: undefined,
  notes: undefined,
});

// Helper to convert OfferDraft to QuotationOffer
const draftToOffer = (draft: any): QuotationOffer => ({
  id: draft.id || generateOfferId(),
  quotationId: '',
  title: draft.title || undefined,
  order: 0,
  offerNumber: draft.offerNumber || undefined,
  transportMode: draft.transportMode || undefined,
  borderPort: draft.borderPort || undefined,
  incoterm: draft.incoterm || undefined,
  shipper: draft.shipper || undefined,
  terminal: draft.terminal || undefined,
  transitTime: draft.transitTime || undefined,
  rate: draft.rate ? Number(draft.rate) : undefined,
  rateCurrency: draft.rateCurrency || 'USD',
  grossWeight: draft.grossWeight ? Number(draft.grossWeight) : undefined,
  dimensionsCbm: draft.dimensionsCbm ? Number(draft.dimensionsCbm) : undefined,
  notes: draft.notes || undefined,
});

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'] as const;
const DIVISIONS = ['import', 'export', 'transit'] as const;
const FALLBACK_TMODES = [
  '20ft Truck',
  '40ft Truck',
  '20ft Container',
  '40ft Container',
  'Car Carrier',
] as const;
const FALLBACK_CARGO_TYPES = [
  'General Cargo',
  'Bulk Cargo',
  'Project Cargo',
  'Dangerous Goods',
  'Perishables',
  'Automotive',
];
const QUOTATION_LANGUAGE_OPTIONS = [
  { value: 'MN', labelKey: 'common.mongolian' },
  { value: 'EN', labelKey: 'common.english' },
  { value: 'RU', labelKey: 'common.russian' },
] as const;
const generateOfferId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

// Legacy support for converting old drafts
const normalizeLegacyOfferDraft = (raw: unknown): QuotationOffer => {
  if (!raw || typeof raw !== 'object') return createInitialOffer();
  const input = raw as Record<string, unknown>;
  return draftToOffer(input);
};

const DIVISION_LABEL_KEYS: Record<(typeof DIVISIONS)[number], string> = {
  import: 'quotation.form.division.import',
  export: 'quotation.form.division.export',
  transit: 'quotation.form.division.transit',
};

const TRANSPORT_MODE_CODE_HINTS = ['transport', 'transport_mode', 'transport-mode', 'tmode'];
const CARGO_TYPE_HINTS = ['cargo', 'commodity', 'freight', 'goods', 'ачаа', 'бараа'];
const DIMENSION_ENABLED_MODES = new Set(
  ['lcl', 'ltl', 'air', 'Задгай ачаа', 'Задгай техник', 'Тавцант вагон', 'вагон'].map((value) =>
    value.toLowerCase(),
  ),
);

const EMPTY_DIMENSION: Dim = {
  length: Number.NaN,
  width: Number.NaN,
  height: Number.NaN,
  quantity: Number.NaN,
  cbm: Number.NaN,
};

const createEmptyDimension = (): Dim => ({ ...EMPTY_DIMENSION });

const parseDimensionValue = (value: string): number => {
  if (value === '' || value === undefined || value === null) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const coerceDimensionValue = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'string') return parseDimensionValue(value);
  return Number.NaN;
};

const recalcDimensionCbm = (dim: Dim): Dim => {
  const length = Number.isFinite(dim.length) ? dim.length : undefined;
  const width = Number.isFinite(dim.width) ? dim.width : undefined;
  const height = Number.isFinite(dim.height) ? dim.height : undefined;
  const quantity = Number.isFinite(dim.quantity) ? dim.quantity : undefined;
  if (
    length === undefined ||
    width === undefined ||
    height === undefined ||
    quantity === undefined
  ) {
    return { ...dim, cbm: Number.NaN };
  }
  const raw = (length * width * height * quantity) / 1_000_000;
  const cbm = Number.isFinite(raw) ? Number(raw.toFixed(3)) : Number.NaN;
  return { ...dim, cbm };
};

const normalizeDimensionEntry = (raw: unknown): Dim => {
  if (!raw || typeof raw !== 'object') return createEmptyDimension();
  const entry = raw as Record<string, unknown>;
  const base: Dim = {
    length: coerceDimensionValue(entry.length),
    width: coerceDimensionValue(entry.width),
    height: coerceDimensionValue(entry.height),
    quantity: coerceDimensionValue(entry.quantity),
    cbm: Number.NaN,
  };
  return recalcDimensionCbm(base);
};

const normalizeDimensionList = (input: unknown): Dim[] => {
  if (!Array.isArray(input)) return [createEmptyDimension()];
  const next = input.map((entry) => normalizeDimensionEntry(entry));
  return next.length ? next : [];
};

const collectMetaStrings = (meta: unknown): string[] => {
  const acc: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      acc.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(meta);
  return acc;
};

const matchesTransportHint = (value: string) =>
  TRANSPORT_MODE_CODE_HINTS.some((hint) => value.includes(hint));

const matchesCargoHint = (value: string) => CARGO_TYPE_HINTS.some((hint) => value.includes(hint));

const isTransportMode = (option: LookupOption | undefined | null) => {
  if (!option || !option.name) return false;
  const name = option.name.toLowerCase();
  if (matchesTransportHint(name)) return true;
  const code = (option.code || '').toLowerCase();
  if (code && matchesTransportHint(code)) return true;
  const metaStrings = collectMetaStrings(option.meta).map((entry) => entry.toLowerCase());
  return metaStrings.some(matchesTransportHint);
};

const isCargoTypeOption = (option: LookupOption | undefined | null) => {
  if (!option || !option.name) return false;
  const name = option.name.toLowerCase();
  if (matchesCargoHint(name)) return true;
  const code = (option.code || '').toLowerCase();
  if (code && matchesCargoHint(code)) return true;
  const metaStrings = collectMetaStrings(option.meta).map((entry) => entry.toLowerCase());
  return metaStrings.some(matchesCargoHint);
};

const requiresDimensions = (transportMode?: string | null) => {
  if (!transportMode) return false;
  return DIMENSION_ENABLED_MODES.has(transportMode.trim().toLowerCase());
};

export default function NewQuotationPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const initialForm: any = {
    // Basics
    client: '',
    cargoType: '',
    origin: '',
    destination: '',
    commodity: '',
    language: 'MN',
    salesManager: '',
    salesManagerId: '',
    // Parties & commercial
    shipper: '',
    division: DIVISIONS[0],
    incoterm: INCOTERMS[0],
    terminal: '',
    condition: '',
    tmode: FALLBACK_TMODES[0],
    // Routing
    originCountry: '',
    originCity: '',
    originAddress: '',
    originIncoterm: '',
    destinationCountry: 'Mongolia',
    destinationCity: 'Ulaanbaatar',
    destinationAddress: '',
    destinationIncoterm: '',
    borderPort: '',
    // Dates
    quotationDate: '',
    validityDate: '',
    estDepartureDate: '',
    actDepartureDate: '',
    estArrivalDate: '',
    actArrivalDate: '',
    // Comments
    include: '',
    exclude: '',
    comment: '',
    remark: '',
    operationNotes: '',
    // cost
    estimatedCost: 0,
    status: 'QUOTATION',
    showDimensionsInPrint: false,
  };
  const [form, setForm] = useState<any>(initialForm);

  const [dimensions, setDimensions] = useState<Dim[]>(() => [createEmptyDimension()]);
  const [offers, setOffers] = useState<QuotationOffer[]>(() =>
    ensureOfferSequence([createInitialOffer()]),
  );
  const [carrierRates, setCarrierRates] = useState<Rate[]>([]);
  const [extraServices, setExtraServices] = useState<Rate[]>([]);
  const [customerRates, setCustomerRates] = useState<Rate[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [includeItems, setIncludeItems] = useState<QuotationTextItem[]>([]);
  const [excludeItems, setExcludeItems] = useState<QuotationTextItem[]>([]);
  const [remarkItems, setRemarkItems] = useState<QuotationTextItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lookups
  const { data: customers, isLoading: customersLoading } = useLookup('customer');
  const { data: ports, isLoading: portsLoading } = useLookup('port');
  const { data: countries, isLoading: countriesLoading } = useLookup('country', {
    include: 'code',
  });
  const { data: typeLookup, isLoading: typesLoading } = useLookup('type', {
    include: ['code', 'meta'],
  });
  const { data: incoterms, isLoading: incotermsLoading } = useLookup('incoterm');

  // Fetch active users from User table for the sales manager selector
  const salesManagersQuery = useQuery<{
    success: boolean;
    data: Array<{ id: string; name: string | null; email: string; role: string }>;
  }>({
    queryKey: ['sales-managers'],
    queryFn: async () => {
      const res = await fetch('/api/users/sales-managers', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load users');
      }
      return res.json();
    },
  });

  const totalCarrier = useMemo(() => sumRateAmounts(carrierRates), [carrierRates]);
  const totalExtra = useMemo(() => sumRateAmounts(extraServices), [extraServices]);
  const showDimensions = requiresDimensions(form?.tmode);
  const effectiveDimensions = useMemo(
    () => (showDimensions ? dimensions : []),
    [showDimensions, dimensions],
  );

  const customerOptions = useMemo(
    () =>
      (customers?.data || [])
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name)),
    [customers?.data],
  );
  const countryOptions = useMemo(
    () =>
      (countries?.data || [])
        .map((c) => (c.code ? `${c.name} (${c.code})` : c.name))
        .filter((name): name is string => Boolean(name)),
    [countries?.data],
  );
  const portOptions = useMemo(
    () => (ports?.data || []).map((p) => p.name).filter((name): name is string => Boolean(name)),
    [ports?.data],
  );
  const salesOptions = useMemo(() => {
    const users = salesManagersQuery.data?.data || [];
    return users
      .map((user) => user.name || user.email)
      .filter((name): name is string => Boolean(name));
  }, [salesManagersQuery.data?.data]);
  const salesOptionByName = useMemo(() => {
    const users = salesManagersQuery.data?.data || [];
    return users.reduce<Map<string, string>>((acc, user) => {
      const label = user.name || user.email;
      if (label) {
        acc.set(label, user.id);
      }
      return acc;
    }, new Map<string, string>());
  }, [salesManagersQuery.data?.data]);
  const autoSelectedSalesManager = useMemo(() => {
    const users = salesManagersQuery.data?.data || [];
    const sessionUserId = session?.user?.id || '';
    const sessionEmail = (session?.user?.email || '').trim().toLowerCase();

    const matchById = sessionUserId ? users.find((user) => user.id === sessionUserId) : null;
    if (matchById) {
      return {
        id: matchById.id,
        name: matchById.name || matchById.email || '',
      };
    }

    const matchByEmail = sessionEmail
      ? users.find((user) => (user.email || '').trim().toLowerCase() === sessionEmail)
      : null;
    if (matchByEmail) {
      return {
        id: matchByEmail.id,
        name: matchByEmail.name || matchByEmail.email || '',
      };
    }

    const fallbackName = session?.user?.name || session?.user?.email || '';
    if (!fallbackName) return null;

    return {
      id: sessionUserId,
      name: fallbackName,
    };
  }, [salesManagersQuery.data?.data, session?.user?.email, session?.user?.id, session?.user?.name]);
  const salesLoading = salesManagersQuery.isLoading;
  const incotermOptions = useMemo(
    () =>
      (incoterms?.data || [])
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name)),
    [incoterms?.data],
  );
  const cargoTypeOptions = useMemo(() => {
    const typeEntries = (typeLookup?.data || []).filter(
      (item): item is LookupOption => Boolean(item) && Boolean(item.name),
    );
    const inferred = typeEntries
      .filter((item) => isCargoTypeOption(item))
      .map((item) => item.name!);
    const unique = Array.from(new Set(inferred));
    if (unique.length) return unique;
    return [...FALLBACK_CARGO_TYPES];
  }, [typeLookup?.data]);
  const transportModeOptions = useMemo(() => {
    const typeEntries = (typeLookup?.data || []).filter(
      (item): item is LookupOption => Boolean(item) && Boolean(item.name),
    );

    const transportEntries = typeEntries
      .filter((item) => isTransportMode(item))
      .map((item) => item.name);
    if (transportEntries.length) return transportEntries;

    const allTypeNames = typeEntries
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name));
    if (allTypeNames.length) return allTypeNames;

    return [...FALLBACK_TMODES];
  }, [typeLookup?.data]);

  useEffect(() => {
    if (!autoSelectedSalesManager) return;
    setForm((prev: any) => {
      const currentSalesManager =
        typeof prev.salesManager === 'string' ? prev.salesManager.trim() : '';
      if (currentSalesManager) return prev;

      return {
        ...prev,
        salesManager: autoSelectedSalesManager.name,
        salesManagerId: autoSelectedSalesManager.id || prev.salesManagerId || '',
      };
    });
  }, [autoSelectedSalesManager]);

  useEffect(() => {
    if (!transportModeOptions.length) return;
    setForm((prev: any) => {
      if (prev.tmode && transportModeOptions.includes(prev.tmode)) {
        return prev;
      }
      return { ...prev, tmode: transportModeOptions[0] };
    });
  }, [transportModeOptions]);

  useEffect(() => {
    if (!form.tmode) return;
    setOffers((prev) => {
      let changed = false;
      const next = prev.map((offer) => {
        if (offer.transportMode) return offer;
        changed = true;
        return { ...offer, transportMode: form.tmode ?? '' };
      });
      return changed ? ensureOfferSequence(next) : prev;
    });
  }, [form.tmode]);

  useEffect(() => {
    setOffers((prev) => {
      let mutated = false;
      const next = prev.map((offer) => {
        const updates: Partial<QuotationOffer> = {};
        if (form.incoterm && !offer.incoterm) updates.incoterm = form.incoterm;
        if (form.shipper && !offer.shipper) updates.shipper = form.shipper;
        if (form.terminal && !offer.terminal) updates.terminal = form.terminal;
        if (form.borderPort && !offer.borderPort) updates.borderPort = form.borderPort;
        if (!Object.keys(updates).length) return offer;
        mutated = true;
        return { ...offer, ...updates };
      });
      return mutated ? ensureOfferSequence(next) : prev;
    });
  }, [form.incoterm, form.shipper, form.terminal, form.borderPort]);

  // Offer management handled by EnhancedOfferTabs component
  const handleOffersChange = (newOffers: QuotationOffer[]) => {
    setOffers(ensureOfferSequence(newOffers));
  };

  // Load draft on mount (supports DB draft by query param and legacy local payload)
  useEffect(() => {
    let cancelled = false;

    const hydrate = (draft: any) => {
      const root = draft?.data ?? draft;
      const formPayload = root?.form ?? root;

      if (formPayload && typeof formPayload === 'object') {
        setForm((f: any) => ({ ...f, ...(formPayload as any) }));
      }

      const dimensionsPayload = root?.dimensions ?? formPayload?.dimensions;
      if (dimensionsPayload) setDimensions(normalizeDimensionList(dimensionsPayload));

      const carrierRatesPayload = root?.carrierRates ?? formPayload?.carrierRates;
      if (carrierRatesPayload) setCarrierRates(carrierRatesPayload);

      const extraServicesPayload = root?.extraServices ?? formPayload?.extraServices;
      if (extraServicesPayload) setExtraServices(extraServicesPayload);

      const customerRatesPayload = root?.customerRates ?? formPayload?.customerRates;
      if (Array.isArray(customerRatesPayload))
        setCustomerRates(ensureSinglePrimaryRate(customerRatesPayload as Rate[]));

      const offersPayload = Array.isArray(root?.offers)
        ? root?.offers
        : Array.isArray(formPayload?.offers)
          ? formPayload?.offers
          : undefined;
      if (offersPayload) {
        const nextOffers = offersPayload
          .map((entry: unknown) => normalizeLegacyOfferDraft(entry))
          .filter(Boolean) as QuotationOffer[];
        const sequenced = nextOffers.length
          ? ensureOfferSequence<QuotationOffer>(nextOffers)
          : ensureOfferSequence<QuotationOffer>([createInitialOffer()]);
        setOffers(sequenced);
      } else if (formPayload?.estimatedCost) {
        const rate = Number(formPayload.estimatedCost);
        const offer = { ...createInitialOffer(), rate: Number.isFinite(rate) ? rate : undefined };
        setOffers(ensureOfferSequence<QuotationOffer>([offer]));
      }

      const includeItemsPayload = root?.includeItems ?? formPayload?.includeItems;
      if (includeItemsPayload) setIncludeItems(includeItemsPayload);

      const excludeItemsPayload = root?.excludeItems ?? formPayload?.excludeItems;
      if (excludeItemsPayload) setExcludeItems(excludeItemsPayload);

      const remarkItemsPayload = root?.remarkItems ?? formPayload?.remarkItems;
      if (remarkItemsPayload) setRemarkItems(remarkItemsPayload);

      const commentPayload = root?.comment ?? formPayload?.comment;
      if (commentPayload) setForm((f: any) => ({ ...f, comment: commentPayload }));
    };

    const loadInitialDraft = async () => {
      const draftId = (searchParams.get('draftId') || '').trim();
      if (draftId) {
        const draft = await getDraftById(draftId);
        if (!draft) {
          toast.error('Draft not found or unavailable');
          return;
        }
        if (cancelled) return;
        hydrate(draft);
        setActiveDraftId(draft.id);
        return;
      }

      if (!cancelled) {
        setActiveDraftId(null);
      }
    };

    loadInitialDraft();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Load draft when originIncoterm changes
  useEffect(() => {
    const loadDraft = async () => {
      if (!form.originIncoterm) {
        // Clear items if no incoterm selected
        setIncludeItems([]);
        setExcludeItems([]);
        setRemarkItems([]);
        return;
      }

      try {
        // Find incoterm by name (ComboBox stores name, not ID)
        const incoterm = incoterms?.data?.find((opt: any) => opt.name === form.originIncoterm);
        if (!incoterm) return;

        const res = await fetch(`/api/incoterm-drafts?incotermId=${incoterm.id}`);
        const result = await res.json();
        if (result.success && result.data) {
          const draft = result.data;
          setIncludeItems((draft.include || []) as QuotationTextItem[]);
          setExcludeItems((draft.exclude || []) as QuotationTextItem[]);
          setRemarkItems((draft.remark || []) as QuotationTextItem[]);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [form.originIncoterm, incoterms]);

  const clearFieldError = (field: string, value: string | undefined | null) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      if (typeof value === 'string' && value.trim() !== '') {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  };
  const submit = async () => {
    const required: Array<{ key: string; label: string }> = [
      { key: 'client', label: t('quotation.form.fields.client') },
      // { key: 'cargoType', label: t('quotation.form.fields.cargoType') },
      { key: 'salesManager', label: t('quotation.form.fields.salesManager') },
      { key: 'division', label: t('quotation.form.fields.division') },
      { key: 'originCountry', label: t('quotation.form.fields.originCountry') },
      { key: 'originCity', label: t('quotation.form.fields.originCity') },
      { key: 'destinationCountry', label: t('quotation.form.fields.destinationCountry') },
      { key: 'destinationCity', label: t('quotation.form.fields.destinationCity') },
      { key: 'quotationDate', label: t('quotation.form.fields.quotationDate') },
      { key: 'validityDate', label: t('quotation.form.fields.validityDate') },
    ];

    const nextErrors: Record<string, string> = {};
    const missingLabels: string[] = [];
    required.forEach(({ key, label }) => {
      const value = (form as Record<string, unknown>)[key];
      if (typeof value !== 'string' || value.trim() === '') {
        nextErrors[key] = t('quotation.form.validation.required');
        missingLabels.push(label);
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const summary = t('quotation.form.validation.summary') || 'Please fill required fields';
      const detail = missingLabels.length ? `\n• ${missingLabels.join('\n• ')}` : '';
      toast.error(`${summary}${detail}`.trim());
      return;
    }

    setSaving(true);
    try {
      const normalizedCustomerRates = ensureSinglePrimaryRate(customerRates);
      const normalizedPrimary = normalizedCustomerRates.find((rate) => rate.isPrimary) || null;
      const payloadProfit = computeProfitFromRates(normalizedPrimary, carrierRates, extraServices);
      const originDisplay = form.originCity || form.originCountry || form.origin || '';
      const destinationDisplay =
        form.destinationCity || form.destinationCountry || form.destination || '';
      const estimatedCost = Math.max(1, totalCarrier + totalExtra);
      const finalCargoType = form.cargoType || form.tmode || '';
      const rawLanguage =
        typeof form.language === 'string' ? form.language.trim().toUpperCase() : '';
      const payloadLanguage =
        rawLanguage === 'EN' || rawLanguage === 'MN' || rawLanguage === 'RU' ? rawLanguage : 'MN';

      // Ensure required fields for API validation
      if (!form.client || !form.client.trim()) {
        toast.error('Client is required');
        setErrors((prev) => ({ ...prev, client: 'Required' }));
        setSaving(false);
        return;
      }
      if (!finalCargoType.trim()) {
        toast.error('Cargo type or transport mode is required');
        setSaving(false);
        return;
      }
      if (!originDisplay.trim()) {
        toast.error('Origin is required (please fill origin country or city)');
        setErrors((prev) => ({ ...prev, originCountry: 'Required', originCity: 'Required' }));
        setSaving(false);
        return;
      }
      if (!destinationDisplay.trim()) {
        toast.error('Destination is required (please fill destination country or city)');
        setErrors((prev) => ({
          ...prev,
          destinationCountry: 'Required',
          destinationCity: 'Required',
        }));
        setSaving(false);
        return;
      }

      const volumeTotal = effectiveDimensions.reduce(
        (sum, dim) => sum + (Number.isFinite(dim.cbm) ? dim.cbm : 0),
        0,
      );
      const roundedVolume = Number(volumeTotal.toFixed(3));
      const dimensionPayload = effectiveDimensions.reduce<DimensionPayload[]>((acc, dim) => {
        if (
          !Number.isFinite(dim.length) ||
          !Number.isFinite(dim.width) ||
          !Number.isFinite(dim.height) ||
          !Number.isFinite(dim.quantity) ||
          !Number.isFinite(dim.cbm)
        ) {
          return acc;
        }
        acc.push({
          length: Number(dim.length),
          width: Number(dim.width),
          height: Number(dim.height),
          quantity: Number(dim.quantity),
          cbm: Number(dim.cbm.toFixed(3)),
        });
        return acc;
      }, []);

      const payload = {
        ...form,
        language: payloadLanguage,
        origin: originDisplay.trim(),
        destination: destinationDisplay.trim(),
        cargoType: finalCargoType.trim(),
        estimatedCost,
        weight: undefined,
        volume: dimensionPayload.length ? roundedVolume : undefined,
        dimensions: dimensionPayload,
        carrierRates,
        extraServices,
        customerRates: normalizedCustomerRates,
        profit: payloadProfit,
        include: includeItems.length > 0 ? includeItems : null,
        exclude: excludeItems.length > 0 ? excludeItems : null,
        remark: remarkItems.length > 0 ? remarkItems : null,
        draftId: activeDraftId || undefined,
        offers: serializeOffersForPayload(ensureOfferSequence(offers)),
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = json?.error || t('quotation.form.toast.saveError');
        const details = json?.details ? JSON.stringify(json.details, null, 2) : '';
        console.error('Quotation creation error:', errorMsg, details);
        toast.error(`${errorMsg}${details ? `\n${details}` : ''}`);
        return;
      }
      toast.success(t('quotation.form.toast.createSuccess'));
      setActiveDraftId(null);
      // Reset form state after success
      setForm(initialForm);
      setDimensions([createEmptyDimension()]);
      setCarrierRates([]);
      setExtraServices([]);
      setCustomerRates([]);
      setOffers(ensureOfferSequence([createInitialOffer()]));
      setIncludeItems([]);
      setExcludeItems([]);
      setRemarkItems([]);
      setErrors({});
    } catch {
      toast.error(t('quotation.form.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const loadDraftIntoForm = (d: QuotationDraft) => {
    const root = (d as any)?.data ?? d;
    const formPayload = root?.form ?? root;

    if (formPayload && typeof formPayload === 'object') {
      setForm((prev: any) => ({ ...prev, ...(formPayload as any) }));
    }

    const dimensionsPayload = root?.dimensions ?? formPayload?.dimensions;
    if (dimensionsPayload) setDimensions(normalizeDimensionList(dimensionsPayload));

    const carrierRatesPayload = root?.carrierRates ?? formPayload?.carrierRates;
    if (carrierRatesPayload) setCarrierRates(carrierRatesPayload);

    const extraServicesPayload = root?.extraServices ?? formPayload?.extraServices;
    if (extraServicesPayload) setExtraServices(extraServicesPayload);

    const customerRatesPayload = root?.customerRates ?? formPayload?.customerRates;
    if (Array.isArray(customerRatesPayload))
      setCustomerRates(ensureSinglePrimaryRate(customerRatesPayload as Rate[]));

    const offersPayload = Array.isArray(root?.offers)
      ? root?.offers
      : Array.isArray(formPayload?.offers)
        ? formPayload?.offers
        : undefined;
    if (offersPayload) {
      const loadedOffers = offersPayload
        .map((entry: unknown) => normalizeLegacyOfferDraft(entry))
        .filter(Boolean) as QuotationOffer[];
      const sequenced = loadedOffers.length
        ? ensureOfferSequence<QuotationOffer>(loadedOffers)
        : ensureOfferSequence<QuotationOffer>([createInitialOffer()]);
      setOffers(sequenced);
    } else if (formPayload?.estimatedCost) {
      const rate = Number(formPayload.estimatedCost);
      const offer = { ...createInitialOffer(), rate: Number.isFinite(rate) ? rate : undefined };
      setOffers(ensureOfferSequence<QuotationOffer>([offer]));
    }

    const includeItemsPayload = root?.includeItems ?? formPayload?.includeItems;
    if (includeItemsPayload) setIncludeItems(includeItemsPayload);

    const excludeItemsPayload = root?.excludeItems ?? formPayload?.excludeItems;
    if (excludeItemsPayload) setExcludeItems(excludeItemsPayload);

    const remarkItemsPayload = root?.remarkItems ?? formPayload?.remarkItems;
    if (remarkItemsPayload) setRemarkItems(remarkItemsPayload);

    const commentPayload = root?.comment ?? formPayload?.comment;
    if (commentPayload) setForm((prev: any) => ({ ...prev, comment: commentPayload }));

    setActiveDraftId(d.id);
    setShowDrafts(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('quotation.form.new.title')}</h1>
      </div>

      <DraftsModal
        open={showDrafts}
        onClose={() => setShowDrafts(false)}
        onLoadQuick={loadDraftIntoForm}
        onOpenFull={loadDraftIntoForm}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('quotation.form.section.basics.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-2">
              <Label htmlFor="client">{t('quotation.form.fields.client')}</Label>
              <ComboBox
                value={form.client}
                onChange={(v) => {
                  setForm({ ...form, client: v });
                  clearFieldError('client', v);
                }}
                options={customerOptions}
                isLoading={customersLoading}
                selectOnly
                placeholder={t('quotation.form.fields.client.placeholder')}
                className="w-full"
              />
              {errors.client && <p className="text-sm text-red-600">{errors.client}</p>}
            </div>
            {/* <div>
              <Label htmlFor="cargoType">{t('quotation.form.fields.cargoType')}</Label>
              <ComboBox
                id="cargoType"
                value={form.cargoType}
                onChange={(v) => {
                  setForm({ ...form, cargoType: v });
                  clearFieldError('cargoType', v);
                }}
                options={cargoTypeOptions}
                isLoading={typesLoading}
                placeholder={t('quotation.form.fields.cargoType')}
                className="w-full"
              />
              {errors.cargoType && <p className="text-sm text-red-600">{errors.cargoType}</p>}
            </div> */}
            <div>
              <Label htmlFor="commodity">
                {t('quotation.form.fields.commodity')}{' '}
                <span className="text-muted-foreground text-xs">
                  {t('quotation.form.fields.optionalHint')}
                </span>
              </Label>
              <Input
                id="commodity"
                value={form.commodity}
                onChange={(e) => {
                  setForm({ ...form, commodity: e.target.value });
                  clearFieldError('commodity', e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="salesManager">{t('quotation.form.fields.salesManager')}</Label>
              <ComboBox
                value={form.salesManager}
                onChange={(v) => {
                  const matchedSalesManagerId = salesOptionByName.get(v) || '';
                  setForm({ ...form, salesManager: v, salesManagerId: matchedSalesManagerId });
                  clearFieldError('salesManager', v);
                }}
                options={salesOptions}
                isLoading={salesLoading}
                placeholder={t('quotation.form.fields.salesManager.placeholder')}
                className="w-full"
              />
              {errors.salesManager && <p className="text-sm text-red-600">{errors.salesManager}</p>}
            </div>
            <div>
              <Label htmlFor="language">{t('quotation.form.fields.language')}</Label>
              <Select
                value={form.language || 'MN'}
                onValueChange={(v) => {
                  setForm({ ...form, language: v });
                  clearFieldError('language', v);
                }}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder={t('quotation.form.fields.language')} />
                </SelectTrigger>
                <SelectContent>
                  {QUOTATION_LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="division">{t('quotation.form.fields.division')}</Label>
              <Select
                value={form.division || ''}
                onValueChange={(v) => {
                  setForm({ ...form, division: v });
                  clearFieldError('division', v);
                }}
              >
                <SelectTrigger
                  id="division"
                  className="w-full"
                  clearable={Boolean(form.division)}
                  hasValue={Boolean(form.division)}
                  onClear={() => setForm({ ...form, division: '' })}
                  clearAriaLabel="Clear division"
                >
                  <SelectValue placeholder={t('quotation.form.fields.division')} />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(DIVISION_LABEL_KEYS[opt])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.division && <p className="text-sm text-red-600">{errors.division}</p>}
            </div>
            <div>
              <Label htmlFor="shipper">
                {t('quotation.form.fields.shipper')}{' '}
                <span className="text-muted-foreground text-xs">
                  {t('quotation.form.fields.optionalHint')}
                </span>
              </Label>
              <Input
                id="shipper"
                value={form.shipper}
                onChange={(e) => {
                  setForm({ ...form, shipper: e.target.value });
                  clearFieldError('shipper', e.target.value);
                }}
                placeholder={t('quotation.form.fields.shipper.placeholder')}
              />
            </div>
            <div>
              <Label htmlFor="quotationDate">{t('quotation.form.fields.quotationDate')}</Label>
              <DatePicker
                id="quotationDate"
                value={form.quotationDate || ''}
                onChange={(v) => {
                  const date = new Date(v + 'T00:00:00');
                  date.setDate(date.getDate() + 7);
                  const validityDate = date.toISOString().split('T')[0];
                  setForm({
                    ...form,
                    quotationDate: v,
                    validityDate: form.validityDate || validityDate,
                  });
                  clearFieldError('quotationDate', v);
                }}
                placeholder="Select quotation date"
              />
              {errors.quotationDate && (
                <p className="text-sm text-red-600">{errors.quotationDate}</p>
              )}
            </div>
            <div>
              <Label htmlFor="validityDate">{t('quotation.form.fields.validityDate')}</Label>
              <DatePicker
                id="validityDate"
                value={form.validityDate || ''}
                onChange={(v) => {
                  setForm({ ...form, validityDate: v });
                  clearFieldError('validityDate', v);
                }}
                placeholder="Select validity date"
                minDate={form.quotationDate || undefined}
              />
              {errors.validityDate && <p className="text-sm text-red-600">{errors.validityDate}</p>}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showDimensionsInPrint"
                checked={form.showDimensionsInPrint || false}
                onCheckedChange={(checked) => {
                  setForm({ ...form, showDimensionsInPrint: checked === true });
                }}
              />
              <Label
                htmlFor="showDimensionsInPrint"
                className="text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('quotation.form.fields.showDimensionsInPrint')}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quotation.form.section.routing.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="originIncoterm">{t('quotation.form.fields.originIncoterm')}</Label>
              <ComboBox
                value={form.originIncoterm}
                onChange={(v) => {
                  setForm({ ...form, originIncoterm: v });
                }}
                options={incotermOptions}
                placeholder={t('quotation.form.fields.incoterm.placeholder')}
                isLoading={incotermsLoading}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="originCountry">{t('quotation.form.fields.originCountry')}</Label>
              <ComboBox
                value={form.originCountry}
                onChange={(v) => {
                  setForm({ ...form, originCountry: v });
                  clearFieldError('originCountry', v);
                }}
                options={countryOptions}
                placeholder={t('quotation.form.fields.origin.placeholder')}
                isLoading={countriesLoading}
                className="w-full"
              />
              {errors.originCountry && (
                <p className="text-sm text-red-600">{errors.originCountry}</p>
              )}
            </div>
            <div>
              <Label htmlFor="originCity">{t('quotation.form.fields.originCity')}</Label>
              <ComboBox
                value={form.originCity}
                onChange={(v) => {
                  setForm({ ...form, originCity: v });
                  clearFieldError('originCity', v);
                }}
                options={portOptions}
                placeholder={t('quotation.form.fields.originCity')}
                isLoading={portsLoading}
                className="w-full"
              />
              {errors.originCity && <p className="text-sm text-red-600">{errors.originCity}</p>}
            </div>
            <div>
              <Label htmlFor="originAddress">{t('quotation.form.fields.originAddress')}</Label>
              <Input
                id="originAddress"
                value={form.originAddress || ''}
                onChange={(e) => setForm({ ...form, originAddress: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                {t('quotation.form.fields.optionalHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="destinationIncoterm">
                {t('quotation.form.fields.destinationIncoterm')}
              </Label>
              <ComboBox
                value={form.destinationIncoterm}
                onChange={(v) => {
                  setForm({ ...form, destinationIncoterm: v });
                }}
                options={incotermOptions}
                placeholder={t('quotation.form.fields.incoterm.placeholder')}
                isLoading={incotermsLoading}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="destinationCountry">
                {t('quotation.form.fields.destinationCountry')}
              </Label>
              <ComboBox
                value={form.destinationCountry}
                onChange={(v) => {
                  setForm({ ...form, destinationCountry: v });
                  clearFieldError('destinationCountry', v);
                }}
                options={countryOptions}
                placeholder={t('quotation.form.fields.destination.placeholder')}
                isLoading={countriesLoading}
                className="w-full"
              />
              {errors.destinationCountry && (
                <p className="text-sm text-red-600">{errors.destinationCountry}</p>
              )}
            </div>
            <div>
              <Label htmlFor="destinationCity">{t('quotation.form.fields.destinationCity')}</Label>
              <ComboBox
                value={form.destinationCity}
                onChange={(v) => {
                  setForm({ ...form, destinationCity: v });
                  clearFieldError('destinationCity', v);
                }}
                options={portOptions}
                placeholder={t('quotation.form.fields.destinationCity')}
                isLoading={portsLoading}
                className="w-full"
              />
              {errors.destinationCity && (
                <p className="text-sm text-red-600">{errors.destinationCity}</p>
              )}
            </div>
            <div>
              <Label htmlFor="destinationAddress">
                {t('quotation.form.fields.destinationAddress')}
              </Label>
              <Input
                id="destinationAddress"
                value={form.destinationAddress || ''}
                onChange={(e) => setForm({ ...form, destinationAddress: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                {t('quotation.form.fields.optionalHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="borderPort">{t('quotation.form.fields.borderPort')}</Label>
              <ComboBox
                id="borderPort"
                value={form.borderPort}
                onChange={(v) => setForm({ ...form, borderPort: v })}
                options={portOptions}
                isLoading={portsLoading}
                placeholder={t('quotation.form.fields.borderPort')}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Offers Section - Moved above notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quotation.form.tabs.offers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EnhancedOfferTabs
              offers={offers}
              onChange={handleOffersChange}
              transportModeOptions={transportModeOptions}
              transportLoading={typesLoading}
              showDimensionsInPrint={Boolean(form.showDimensionsInPrint)}
            />
          </CardContent>
        </Card>

        {/* Include/Exclude/Remark/Comment - Moved to main info section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quotation.form.section.notes.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <QuotationTextList
                title={t('quotation.form.fields.include')}
                items={includeItems}
                onChange={setIncludeItems}
                category="INCLUDE"
              />
              <QuotationTextList
                title={t('quotation.form.fields.exclude')}
                items={excludeItems}
                onChange={setExcludeItems}
                category="EXCLUDE"
              />
              <QuotationTextList
                title={t('quotation.form.fields.remark')}
                items={remarkItems}
                onChange={setRemarkItems}
                category="REMARK"
              />
              <div>
                <Label htmlFor="comment">{t('quotation.form.fields.comment')}</Label>
                <Textarea
                  id="comment"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDrafts(true)}>
            {t('quotation.form.actions.openDrafts')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const result = await addDraft(
                {
                  form,
                  includeItems,
                  excludeItems,
                  remarkItems,
                  dimensions,
                  carrierRates,
                  extraServices,
                  customerRates,
                  offers,
                },
                undefined,
                activeDraftId || undefined,
              );
              if (result) {
                setActiveDraftId(result.id);
                toast.success(t('quotation.form.toast.draftSaved'));
              } else {
                toast.error(t('quotation.form.toast.draftSaveFailed') || 'Failed to save draft');
              }
            }}
          >
            {t('quotation.form.actions.saveDraft')}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setForm(initialForm);
            setActiveDraftId(null);
            setDimensions([createEmptyDimension()]);
            setCarrierRates([]);
            setExtraServices([]);
            setCustomerRates([]);
            setOffers(ensureOfferSequence([createInitialOffer()]));
            setIncludeItems([]);
            setExcludeItems([]);
            setRemarkItems([]);
            setErrors({});
            toast.message(t('quotation.form.toast.draftCleared'));
          }}
        >
          {t('quotation.form.actions.clearDraft')}
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? t('common.saving') : t('quotation.form.actions.createQuotation')}
        </Button>
      </div>
    </div>
  );
}
