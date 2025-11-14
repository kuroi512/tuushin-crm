'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComboBox } from '@/components/ui/combobox';
import { useLookup, type LookupOption } from '@/components/lookup/hooks';
import { DraftsModal, addDraft, QuotationDraft } from '@/components/quotations/DraftsModal';
import { useT } from '@/lib/i18n';
import { RuleSelectionField } from '@/components/quotations/RuleSelectionField';
import {
  applyCatalogDefaults,
  buildRuleText,
  emptyRuleSelectionState,
  equalRuleStates,
  normalizeRuleSelectionState,
  useRuleCatalog,
} from '@/components/quotations/useRuleCatalog';
import type { QuotationRuleSelectionState, QuotationOffer } from '@/types/quotation';
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
  const DRAFT_KEY = 'quotation_draft_v1';
  const initialForm: any = {
    // Basics
    client: '',
    cargoType: '',
    origin: '',
    destination: '',
    commodity: '',
    salesManager: '',
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
    destinationCountry: '',
    destinationCity: '',
    destinationAddress: '',
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
  const [ruleSelections, setRuleSelections] =
    useState<QuotationRuleSelectionState>(emptyRuleSelectionState());
  const [activeTab, setActiveTab] = useState<'main' | 'offers'>('main');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lookups
  const { data: customers, isLoading: customersLoading } = useLookup('customer');
  const { data: ports, isLoading: portsLoading } = useLookup('port');
  const { data: countries, isLoading: countriesLoading } = useLookup('country', {
    include: 'code',
  });
  const { data: sales, isLoading: salesLoading } = useLookup('sales');
  const { data: typeLookup, isLoading: typesLoading } = useLookup('type', {
    include: ['code', 'meta'],
  });
  const { data: ruleCatalog, isLoading: rulesLoading } = useRuleCatalog(form.incoterm, form.tmode);

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
  const salesOptions = useMemo(
    () =>
      (sales?.data || []).map((item) => item.name).filter((name): name is string => Boolean(name)),
    [sales?.data],
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

  const tabButtonClass = (value: 'main' | 'offers') =>
    `border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === value
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  // Load draft on mount
  useEffect(() => {
    try {
      let raw = localStorage.getItem(DRAFT_KEY);
      // Legacy support
      if (!raw) {
        const legacyQuick = localStorage.getItem('quotation_quick_form_draft_v1');
        const legacyFull = localStorage.getItem('quotation_new_form_draft_v1');
        raw = legacyFull || legacyQuick;
        if (raw) {
          localStorage.setItem(DRAFT_KEY, raw);
          if (legacyQuick) localStorage.removeItem('quotation_quick_form_draft_v1');
          if (legacyFull) localStorage.removeItem('quotation_new_form_draft_v1');
        }
      }
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.form) setForm((f: any) => ({ ...f, ...draft.form }));
        else if (typeof draft === 'object') setForm((f: any) => ({ ...f, ...(draft as any) }));
        if (draft.dimensions) setDimensions(normalizeDimensionList(draft.dimensions));
        if (draft.carrierRates) setCarrierRates(draft.carrierRates);
        if (draft.extraServices) setExtraServices(draft.extraServices);
        if (Array.isArray(draft.customerRates))
          setCustomerRates(ensureSinglePrimaryRate(draft.customerRates as Rate[]));
        if (Array.isArray(draft.offers)) {
          const nextOffers = (draft.offers as unknown[])
            .map((entry) => normalizeLegacyOfferDraft(entry))
            .filter(Boolean);
          const sequenced = nextOffers.length
            ? ensureOfferSequence(nextOffers)
            : ensureOfferSequence([createInitialOffer()]);
          setOffers(sequenced);
        }
        setRuleSelections(normalizeRuleSelectionState(draft.form ?? draft));
      }
    } catch {}
  }, []);

  // Autosave draft
  useEffect(() => {
    const payload = {
      form: { ...form, ruleSelections },
      ruleSelections,
      dimensions,
      carrierRates,
      extraServices,
      customerRates,
      offers,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {}
  }, [form, ruleSelections, dimensions, carrierRates, extraServices, customerRates, offers]);

  useEffect(() => {
    if (!ruleCatalog?.data) return;
    setRuleSelections((prev) => {
      const next = applyCatalogDefaults(prev, ruleCatalog.data);
      return equalRuleStates(prev, next) ? prev : next;
    });
  }, [ruleCatalog?.data]);

  useEffect(() => {
    setForm((prev: any) => ({
      ...prev,
      include: buildRuleText(ruleSelections.include),
      exclude: buildRuleText(ruleSelections.exclude),
      remark: buildRuleText(ruleSelections.remark),
    }));
  }, [ruleSelections]);

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
      { key: 'cargoType', label: t('quotation.form.fields.cargoType') },
      { key: 'commodity', label: t('quotation.form.fields.commodity') },
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
      setActiveTab('main');
      return;
    }

    setSaving(true);
    try {
      const normalizedCustomerRates = ensureSinglePrimaryRate(customerRates);
      const normalizedPrimary = normalizedCustomerRates.find((rate) => rate.isPrimary) || null;
      const payloadProfit = computeProfitFromRates(normalizedPrimary, carrierRates, extraServices);
      const originDisplay = form.originCity || form.originCountry || form.origin;
      const destinationDisplay =
        form.destinationCity || form.destinationCountry || form.destination;
      const estimatedCost = Math.max(1, totalCarrier + totalExtra);
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
        origin: originDisplay,
        destination: destinationDisplay,
        estimatedCost,
        weight: undefined,
        volume: dimensionPayload.length ? roundedVolume : undefined,
        dimensions: dimensionPayload,
        carrierRates,
        extraServices,
        customerRates: normalizedCustomerRates,
        profit: payloadProfit,
        ruleSelections,
        offers: serializeOffersForPayload(ensureOfferSequence(offers)),
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || t('quotation.form.toast.saveError'));
        return;
      }
      toast.success(t('quotation.form.toast.createSuccess'));
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem('quotation_quick_form_draft_v1');
      localStorage.removeItem('quotation_new_form_draft_v1');
      // Reset form state after success
      setForm(initialForm);
      setDimensions([createEmptyDimension()]);
      setCarrierRates([]);
      setExtraServices([]);
      setCustomerRates([]);
      setOffers(ensureOfferSequence([createInitialOffer()]));
      setRuleSelections(emptyRuleSelectionState());
      setErrors({});
    } catch {
      toast.error(t('quotation.form.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('quotation.form.new.title')}</h1>
      </div>

      <DraftsModal
        open={showDrafts}
        onClose={() => setShowDrafts(false)}
        onLoadQuick={(d: QuotationDraft) => {
          const src = d.data?.form ?? d.data;
          if (src) setForm((prev: any) => ({ ...prev, ...src }));
          setRuleSelections(normalizeRuleSelectionState(src ?? d.data));
          // Load tables if present
          if (d.data?.dimensions) setDimensions(normalizeDimensionList(d.data.dimensions));
          if (d.data?.carrierRates) setCarrierRates(d.data.carrierRates);
          if (d.data?.extraServices) setExtraServices(d.data.extraServices);
          if (Array.isArray(d.data?.customerRates))
            setCustomerRates(ensureSinglePrimaryRate(d.data.customerRates as Rate[]));
          if (Array.isArray(d.data?.offers)) {
            const loadedOffers = (d.data.offers as unknown[])
              .map((entry) => normalizeLegacyOfferDraft(entry))
              .filter(Boolean);
            const sequenced = loadedOffers.length
              ? ensureOfferSequence(loadedOffers)
              : ensureOfferSequence([createInitialOffer()]);
            setOffers(sequenced);
          }
          setShowDrafts(false);
        }}
        onOpenFull={() => {
          /* already on full form */
        }}
      />

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('main')}
          className={tabButtonClass('main')}
        >
          {t('quotation.form.tabs.main')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('offers')}
          className={tabButtonClass('offers')}
        >
          {t('quotation.form.tabs.offers')}
        </button>
      </div>

      {activeTab === 'main' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.form.section.basics.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="client">{t('quotation.form.fields.client')}</Label>
                <ComboBox
                  value={form.client}
                  onChange={(v) => {
                    setForm({ ...form, client: v });
                    clearFieldError('client', v);
                  }}
                  options={customerOptions}
                  isLoading={customersLoading}
                  placeholder={t('quotation.form.fields.client.placeholder')}
                  className="w-full"
                />
                {errors.client && <p className="text-sm text-red-600">{errors.client}</p>}
              </div>
              <div>
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
              </div>
              <div>
                <Label htmlFor="commodity">{t('quotation.form.fields.commodity')}</Label>
                <Input
                  id="commodity"
                  value={form.commodity}
                  onChange={(e) => {
                    setForm({ ...form, commodity: e.target.value });
                    clearFieldError('commodity', e.target.value);
                  }}
                />
                {errors.commodity && <p className="text-sm text-red-600">{errors.commodity}</p>}
              </div>
              <div>
                <Label htmlFor="salesManager">{t('quotation.form.fields.salesManager')}</Label>
                <ComboBox
                  value={form.salesManager}
                  onChange={(v) => {
                    setForm({ ...form, salesManager: v });
                    clearFieldError('salesManager', v);
                  }}
                  options={salesOptions}
                  isLoading={salesLoading}
                  placeholder={t('quotation.form.fields.salesManager.placeholder')}
                  className="w-full"
                />
                {errors.salesManager && (
                  <p className="text-sm text-red-600">{errors.salesManager}</p>
                )}
              </div>
              <div>
                <Label>{t('quotation.form.fields.division')}</Label>
                <Select
                  value={form.division}
                  onValueChange={(v) => {
                    setForm({ ...form, division: v });
                    clearFieldError('division', v);
                  }}
                >
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="shipper">{t('quotation.form.fields.shipper')}</Label>
                <ComboBox
                  id="shipper"
                  value={form.shipper}
                  onChange={(v) => {
                    setForm({ ...form, shipper: v });
                    clearFieldError('shipper', v);
                  }}
                  options={customerOptions}
                  isLoading={customersLoading}
                  placeholder={t('quotation.form.fields.shipper')}
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="terminal">{t('quotation.form.fields.terminal')}</Label>
                <ComboBox
                  id="terminal"
                  value={form.terminal}
                  onChange={(v) => {
                    setForm({ ...form, terminal: v });
                    clearFieldError('terminal', v);
                  }}
                  options={portOptions}
                  isLoading={portsLoading}
                  placeholder={t('quotation.form.fields.terminal')}
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="quotationDate">{t('quotation.form.fields.quotationDate')}</Label>
                <Input
                  id="quotationDate"
                  type="date"
                  value={form.quotationDate || ''}
                  onChange={(e) => {
                    setForm({ ...form, quotationDate: e.target.value });
                    clearFieldError('quotationDate', e.target.value);
                  }}
                />
                {errors.quotationDate && (
                  <p className="text-sm text-red-600">{errors.quotationDate}</p>
                )}
              </div>
              <div>
                <Label htmlFor="validityDate">{t('quotation.form.fields.validityDate')}</Label>
                <Input
                  id="validityDate"
                  type="date"
                  value={form.validityDate || ''}
                  onChange={(e) => {
                    setForm({ ...form, validityDate: e.target.value });
                    clearFieldError('validityDate', e.target.value);
                  }}
                />
                {errors.validityDate && (
                  <p className="text-sm text-red-600">{errors.validityDate}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.form.section.routing.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <Label htmlFor="destinationCity">
                  {t('quotation.form.fields.destinationCity')}
                </Label>
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

          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.form.fields.comment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="comment"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
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
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.form.section.notes.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 md:grid-cols-2">
                <RuleSelectionField
                  fieldKey="include"
                  label={t('quotation.form.fields.include')}
                  description={t('quotation.rules.includeDescription')}
                  selections={ruleSelections.include}
                  onChange={(next) => setRuleSelections((prev) => ({ ...prev, include: next }))}
                  snippets={ruleCatalog?.data?.snippets.INCLUDE ?? []}
                  recommendedIds={ruleCatalog?.data?.defaults.INCLUDE?.snippetIds}
                  loading={rulesLoading}
                />
                <RuleSelectionField
                  fieldKey="exclude"
                  label={t('quotation.form.fields.exclude')}
                  description={t('quotation.rules.excludeDescription')}
                  selections={ruleSelections.exclude}
                  onChange={(next) => setRuleSelections((prev) => ({ ...prev, exclude: next }))}
                  snippets={ruleCatalog?.data?.snippets.EXCLUDE ?? []}
                  recommendedIds={ruleCatalog?.data?.defaults.EXCLUDE?.snippetIds}
                  loading={rulesLoading}
                />
                <RuleSelectionField
                  fieldKey="remark"
                  label={t('quotation.form.fields.remark')}
                  description={t('quotation.rules.remarkDescription')}
                  selections={ruleSelections.remark}
                  onChange={(next) => setRuleSelections((prev) => ({ ...prev, remark: next }))}
                  snippets={ruleCatalog?.data?.snippets.REMARK ?? []}
                  recommendedIds={ruleCatalog?.data?.defaults.REMARK?.snippetIds}
                  loading={rulesLoading}
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
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDrafts(true)}>
            {t('quotation.form.actions.openDrafts')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              addDraft({
                form: { ...form, ruleSelections },
                ruleSelections,
                dimensions,
                carrierRates,
                extraServices,
                customerRates,
                offers,
              });
              toast.success(t('quotation.form.toast.draftSaved'));
            }}
          >
            {t('quotation.form.actions.saveDraft')}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(DRAFT_KEY);
            localStorage.removeItem('quotation_quick_form_draft_v1');
            localStorage.removeItem('quotation_new_form_draft_v1');
            setForm(initialForm);
            setDimensions([createEmptyDimension()]);
            setCarrierRates([]);
            setExtraServices([]);
            setCustomerRates([]);
            setOffers(ensureOfferSequence([createInitialOffer()]));
            setRuleSelections(emptyRuleSelectionState());
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
