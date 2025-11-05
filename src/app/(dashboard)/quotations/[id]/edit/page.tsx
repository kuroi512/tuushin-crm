'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ComboBox } from '@/components/ui/combobox';
import { useLookup, type LookupOption } from '@/components/lookup/hooks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { EnhancedOfferTabs } from '@/components/quotations/EnhancedOfferTabs';
import type { QuotationOffer, QuotationRuleSelectionState } from '@/types/quotation';
import type { RateItem } from '@/lib/quotations/rates';
import {
  computeProfitFromRates,
  ensureSinglePrimaryRate,
  isRateEditLocked,
  sumRateAmounts,
} from '@/lib/quotations/rates';
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

const generateOfferId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createInitialOffer = (): QuotationOffer => ({
  id: generateOfferId(),
  quotationId: '',
  title: 'Offer 1',
  order: 0,
  offerNumber: undefined,
  transportMode: undefined,
  routeSummary: undefined,
  shipmentCondition: undefined,
  transitTime: undefined,
  rate: undefined,
  rateCurrency: 'USD',
  grossWeight: undefined,
  dimensionsCbm: undefined,
  notes: undefined,
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
const CURRENCIES = ['USD', 'CNY', 'MNT'];

const DIVISION_LABEL_KEYS: Record<(typeof DIVISIONS)[number], string> = {
  import: 'quotation.form.division.import',
  export: 'quotation.form.division.export',
  transit: 'quotation.form.division.transit',
};

const FALLBACK_TMODE_LABEL_KEYS: Record<(typeof FALLBACK_TMODES)[number], string> = {
  '20ft Truck': 'quotation.form.transport.20ftTruck',
  '40ft Truck': 'quotation.form.transport.40ftTruck',
  '20ft Container': 'quotation.form.transport.20ftContainer',
  '40ft Container': 'quotation.form.transport.40ftContainer',
  'Car Carrier': 'quotation.form.transport.carCarrier',
};

const TRANSPORT_MODE_CODE_HINTS = ['transport', 'transport_mode', 'transport-mode', 'tmode'];
const DIMENSION_ENABLED_MODES = new Set(
  ['lcl', 'ltl', 'air', 'zadgai achaa', 'zadgai technik', 'tawtsant wagon', 'wagon'].map((value) =>
    value.toLowerCase(),
  ),
);

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

const isTransportMode = (option: LookupOption | undefined | null) => {
  if (!option || !option.name) return false;
  const name = option.name.toLowerCase();
  if (matchesTransportHint(name)) return true;
  const code = (option.code || '').toLowerCase();
  if (code && matchesTransportHint(code)) return true;
  const metaStrings = collectMetaStrings(option.meta).map((entry) => entry.toLowerCase());
  return metaStrings.some(matchesTransportHint);
};

const requiresDimensions = (transportMode?: string | null) => {
  if (!transportMode) return false;
  return DIMENSION_ENABLED_MODES.has(transportMode.trim().toLowerCase());
};

export default function EditQuotationPage() {
  const t = useT();
  const params = useParams() as { id?: string };
  const router = useRouter();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const initialForm: any = {
    // Basics
    client: '',
    cargoType: '',
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
    // status and cost
    estimatedCost: 0,
    status: 'QUOTATION',
  };
  const [form, setForm] = useState<any>(initialForm);

  const initialDim: Dim = {
    length: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
    quantity: Number.NaN,
    cbm: Number.NaN,
  };
  const [dimensions, setDimensions] = useState<Dim[]>([{ ...initialDim }]);
  const [offers, setOffers] = useState<QuotationOffer[]>(() =>
    ensureOfferSequence([createInitialOffer()]),
  );
  const [carrierRates, setCarrierRates] = useState<Rate[]>([]);
  const [extraServices, setExtraServices] = useState<Rate[]>([]);
  const [customerRates, setCustomerRates] = useState<Rate[]>([]);
  const [ruleSelections, setRuleSelections] =
    useState<QuotationRuleSelectionState>(emptyRuleSelectionState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rateLocked = isRateEditLocked(form?.status);
  const [activeTab, setActiveTab] = useState<'main' | 'offers'>('main');

  // Lookups
  const { data: customers, isLoading: customersLoading } = useLookup('customer');
  const { data: countries, isLoading: countriesLoading } = useLookup('country', {
    include: 'code',
  });
  const { data: ports, isLoading: portsLoading } = useLookup('port');
  const { data: areas, isLoading: areasLoading } = useLookup('area');
  const { data: sales, isLoading: salesLoading } = useLookup('sales');
  const { data: typeLookup, isLoading: typesLoading } = useLookup('type', {
    include: ['code', 'meta'],
  });
  const { data: ruleCatalog, isLoading: rulesLoading } = useRuleCatalog(form.incoterm, form.tmode);

  const customerOptions = useMemo(
    () =>
      (customers?.data || []).map((c) => c.name).filter((name): name is string => Boolean(name)),
    [customers?.data],
  );
  const countryOptions = useMemo(
    () =>
      (countries?.data || [])
        .map((c) => (c.code ? `${c.name} (${c.code})` : c.name))
        .filter((name): name is string => Boolean(name)),
    [countries?.data],
  );
  const areaOptions = useMemo(
    () =>
      (areas?.data || []).map((item) => item.name).filter((name): name is string => Boolean(name)),
    [areas?.data],
  );
  const portOptions = useMemo(
    () => (ports?.data || []).map((p) => p.name).filter((name): name is string => Boolean(name)),
    [ports?.data],
  );
  const salesOptions = useMemo(
    () => (sales?.data || []).map((s) => s.name).filter((name): name is string => Boolean(name)),
    [sales?.data],
  );
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
  const disableTransportSelect = typesLoading && transportModeOptions.length === 0;

  const currencyDefault = CURRENCIES[0];
  const totalCarrier = useMemo(() => sumRateAmounts(carrierRates), [carrierRates]);
  const totalExtra = useMemo(() => sumRateAmounts(extraServices), [extraServices]);
  const primaryCustomerRate = useMemo(
    () => customerRates.find((rate) => rate.isPrimary) || null,
    [customerRates],
  );
  const profit = useMemo(
    () => computeProfitFromRates(primaryCustomerRate, carrierRates, extraServices),
    [primaryCustomerRate, carrierRates, extraServices],
  );
  const showDimensions = requiresDimensions(form?.tmode);
  const effectiveDimensions = useMemo(
    () => (showDimensions ? dimensions : []),
    [showDimensions, dimensions],
  );

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

  useEffect(() => {
    if (!ports?.data?.length) return;
    setForm((prev: any) => {
      if (!prev.borderPort) return prev;
      const match = ports.data.find((p) => p.id === prev.borderPort);
      if (match?.name && match.name !== prev.borderPort) {
        return { ...prev, borderPort: match.name };
      }
      return prev;
    });
  }, [ports?.data]);

  const formatTransportMode = useCallback(
    (value: string) => {
      const key = FALLBACK_TMODE_LABEL_KEYS[value as keyof typeof FALLBACK_TMODE_LABEL_KEYS];
      return key ? t(key) : value;
    },
    [t],
  );

  const coerceDimensionValue = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    return Number.NaN;
  };

  const recalcCBM = useCallback((d: Dim) => {
    const length = Number.isFinite(d.length) ? d.length : undefined;
    const width = Number.isFinite(d.width) ? d.width : undefined;
    const height = Number.isFinite(d.height) ? d.height : undefined;
    const quantity = Number.isFinite(d.quantity) ? d.quantity : undefined;
    if (
      length === undefined ||
      width === undefined ||
      height === undefined ||
      quantity === undefined
    ) {
      return { ...d, cbm: Number.NaN };
    }
    const raw = (length * width * height * quantity) / 1_000_000;
    const cbm = Number.isFinite(raw) ? Number(raw.toFixed(3)) : Number.NaN;
    return { ...d, cbm };
  }, []);

  const normalizeDimensionEntry = useCallback(
    (raw: unknown): Dim => {
      if (!raw || typeof raw !== 'object') return { ...initialDim };
      const source = raw as Record<string, unknown>;
      const base: Dim = {
        length: coerceDimensionValue(source.length),
        width: coerceDimensionValue(source.width),
        height: coerceDimensionValue(source.height),
        quantity: coerceDimensionValue(source.quantity),
        cbm: coerceDimensionValue(source.cbm),
      };
      return Number.isFinite(base.cbm) ? base : recalcCBM(base);
    },
    [initialDim, recalcCBM],
  );

  const normalizeDimensionList = useCallback(
    (input: unknown): Dim[] => {
      if (!Array.isArray(input)) return [{ ...initialDim }];
      const next = input.map((entry) => normalizeDimensionEntry(entry));
      return next.length ? next : [];
    },
    [initialDim, normalizeDimensionEntry],
  );

  const addDim = () => setDimensions((arr) => [...arr, { ...initialDim }]);
  const removeDim = (i: number) => setDimensions((arr) => arr.filter((_, idx) => idx !== i));
  const updateDim = (i: number, patch: Partial<Dim>) =>
    setDimensions((arr) =>
      arr.map((d, idx) => {
        if (idx !== i) return d;
        const base = { ...d, ...patch } as Dim;
        return recalcCBM(base);
      }),
    );

  const addRate = (kind: 'carrier' | 'extra' | 'customer') => {
    if (rateLocked) return;
    const row: Rate = { name: '', currency: currencyDefault, amount: Number.NaN };
    if (kind === 'carrier') setCarrierRates((r) => [...r, row]);
    if (kind === 'extra') setExtraServices((r) => [...r, row]);
    if (kind === 'customer')
      setCustomerRates((r) =>
        ensureSinglePrimaryRate([...r, { ...row, isPrimary: r.length === 0 }]),
      );
  };
  const removeRate = (kind: 'carrier' | 'extra' | 'customer', i: number) => {
    if (rateLocked) return;
    if (kind === 'carrier') setCarrierRates((r) => r.filter((_, idx) => idx !== i));
    if (kind === 'extra') setExtraServices((r) => r.filter((_, idx) => idx !== i));
    if (kind === 'customer')
      setCustomerRates((r) => ensureSinglePrimaryRate(r.filter((_, idx) => idx !== i)));
  };
  const updateRate = (kind: 'carrier' | 'extra' | 'customer', i: number, patch: Partial<Rate>) => {
    if (rateLocked) return;
    const map = (r: Rate, idx: number) => {
      if (idx !== i) return r;
      const next: Rate = { ...r, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
        const value = patch.amount;
        next.amount = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
      }
      return next;
    };
    if (kind === 'carrier') setCarrierRates((arr) => arr.map(map));
    if (kind === 'extra') setExtraServices((arr) => arr.map(map));
    if (kind === 'customer') setCustomerRates((arr) => ensureSinglePrimaryRate(arr.map(map)));
  };

  const markPrimary = (index: number) => {
    if (rateLocked) return;
    setCustomerRates((rates) =>
      ensureSinglePrimaryRate(rates.map((rate, idx) => ({ ...rate, isPrimary: idx === index }))),
    );
  };

  const handleOffersChange = (nextOffers: QuotationOffer[]) => {
    setOffers(ensureOfferSequence(nextOffers));
  };

  const tabButtonClass = (value: 'main' | 'offers') =>
    `border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === value
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  const loadFailedMessage = useMemo(() => t('quotation.form.toast.loadFailed'), [t]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${id}`);
        const json = await res.json();
        if (json?.success && json?.data) {
          const q = json.data;
          const originCountry = q.originCountry || '';
          const originCity = q.originCity || '';
          const destinationCountry = q.destinationCountry || '';
          const destinationCity = q.destinationCity || '';

          setForm((prev: any) => ({
            ...prev,
            ...q,
            originCountry: originCountry || q.origin || '',
            originCity,
            destinationCountry: destinationCountry || q.destination || '',
            destinationCity,
          }));
          setRuleSelections(normalizeRuleSelectionState(q));
          // Populate tables if present
          if (Array.isArray(q.dimensions)) setDimensions(normalizeDimensionList(q.dimensions));
          if (Array.isArray(q.carrierRates)) {
            setCarrierRates((prev) => (prev.length ? prev : q.carrierRates));
          }
          if (Array.isArray(q.extraServices)) {
            setExtraServices((prev) => (prev.length ? prev : q.extraServices));
          }
          if (Array.isArray(q.customerRates)) {
            setCustomerRates((prev) =>
              prev.length ? prev : ensureSinglePrimaryRate(q.customerRates as Rate[]),
            );
          }
          if (Array.isArray(q.offers)) {
            const normalizedOffers = ensureOfferSequence(
              (q.offers as QuotationOffer[]).map((offer, index) => ({
                ...offer,
                id: offer?.id && offer.id.trim().length ? offer.id : generateOfferId(),
                order:
                  typeof offer?.order === 'number' && Number.isFinite(offer.order)
                    ? offer.order
                    : index,
              })),
            );
            setOffers(
              normalizedOffers.length
                ? normalizedOffers
                : ensureOfferSequence([createInitialOffer()]),
            );
          }
        }
      } catch {
        toast.error(loadFailedMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loadFailedMessage, normalizeDimensionList]);

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

  const save = async () => {
    const required: Array<{ key: keyof typeof form; label: string }> = [
      { key: 'client', label: t('quotation.form.fields.client') },
      { key: 'cargoType', label: t('quotation.form.fields.cargoType') },
      { key: 'commodity', label: t('quotation.form.fields.commodity') },
      { key: 'salesManager', label: t('quotation.form.fields.salesManager') },
      { key: 'quotationDate', label: t('quotation.form.fields.quotationDate') },
      { key: 'validityDate', label: t('quotation.form.fields.validityDate') },
      { key: 'division', label: t('quotation.form.fields.division') },
      { key: 'incoterm', label: t('quotation.form.fields.incoterm') },
      { key: 'tmode', label: t('quotation.form.fields.transportMode') },
      { key: 'originCountry', label: t('quotation.form.fields.originCountry') },
      { key: 'originCity', label: t('quotation.form.fields.originCity') },
      { key: 'destinationCountry', label: t('quotation.form.fields.destinationCountry') },
      { key: 'destinationCity', label: t('quotation.form.fields.destinationCity') },
    ];

    const nextErrors: Record<string, string> = {};
    const missingLabels: string[] = [];
    required.forEach(({ key, label }) => {
      const value = form[key];
      if (!value || String(value).trim() === '') {
        nextErrors[key as string] = t('quotation.form.validation.required');
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
      const originDisplay = form.originCity || form.originCountry || '';
      const destinationDisplay = form.destinationCity || form.destinationCountry || '';
      const carrierTotal = totalCarrier;
      const extraTotal = totalExtra;
      const estimatedCost = Math.max(1, carrierTotal + extraTotal);
      const normalizedCustomerRates = ensureSinglePrimaryRate(customerRates);
      const normalizedPrimary = normalizedCustomerRates.find((rate) => rate.isPrimary) || null;
      const payloadProfit = computeProfitFromRates(normalizedPrimary, carrierRates, extraServices);
      const sequencedOffers = ensureOfferSequence(offers);
      const serializedOffers = serializeOffersForPayload(sequencedOffers);
      const volumeTotal = effectiveDimensions.reduce(
        (sum, dim) => sum + (Number.isFinite(dim.cbm) ? dim.cbm : 0),
        0,
      );
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
      const roundedVolume = Number(volumeTotal.toFixed(3));

      const payload = {
        ...form,
        origin: originDisplay,
        destination: destinationDisplay,
        estimatedCost,
        weight: undefined,
        volume: dimensionPayload.length ? roundedVolume : undefined,
        dimensions: dimensionPayload.length ? dimensionPayload : undefined,
        carrierRates,
        extraServices,
        customerRates: normalizedCustomerRates,
        profit: payloadProfit,
        ruleSelections,
        offers: serializedOffers,
      };
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error || t('quotation.form.toast.saveError'));
        return;
      }
      toast.success(t('quotation.form.toast.saveSuccess'));
      setOffers(sequencedOffers);
    } catch {
      toast.error(t('quotation.form.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t('quotation.form.edit.title')}{' '}
          {form?.quotationNumber ? `• ${form.quotationNumber}` : ''}
        </h1>
        <p className="text-gray-600">{t('quotation.form.edit.subtitle')}</p>
      </div>

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
          {/* Basics */}
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
                <Input
                  id="cargoType"
                  value={form.cargoType}
                  onChange={(e) => {
                    setForm({ ...form, cargoType: e.target.value });
                    clearFieldError('cargoType', e.target.value);
                  }}
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

          {/* Routing */}
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
                  isLoading={countriesLoading}
                  placeholder={t('quotation.form.fields.destination.placeholder')}
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
                  isLoading={portsLoading}
                  placeholder={t('quotation.form.fields.origin.placeholder')}
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
                  isLoading={countriesLoading}
                  placeholder={t('quotation.form.fields.destination.placeholder')}
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
                  isLoading={portsLoading}
                  placeholder={t('quotation.form.fields.origin.placeholder')}
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
                <Label>{t('quotation.form.fields.borderPort')}</Label>
                <ComboBox
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

          {/* Notes */}
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

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.open(`/quotations/${id}/print`, '_blank')}
        >
          {t('common.print')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? t('common.saving') : t('quotation.form.actions.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
