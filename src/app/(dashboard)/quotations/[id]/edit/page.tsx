'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ComboBox } from '@/components/ui/combobox';
import { useLookup } from '@/components/lookup/hooks';
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
import type { QuotationRuleSelectionState } from '@/types/quotation';
import type { RateItem } from '@/lib/quotations/rates';
import {
  computeProfitFromRates,
  ensureSinglePrimaryRate,
  isRateEditLocked,
  sumRateAmounts,
} from '@/lib/quotations/rates';

type Rate = RateItem;
type Dim = { length: number; width: number; height: number; quantity: number; cbm: number };

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'] as const;
const DIVISIONS = ['import', 'export', 'transit'] as const;
const PAYMENT_TYPES = ['Prepaid', 'Collect'] as const;
const TMODES = [
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

const PAYMENT_LABEL_KEYS: Record<(typeof PAYMENT_TYPES)[number], string> = {
  Prepaid: 'quotation.form.payment.prepaid',
  Collect: 'quotation.form.payment.collect',
};

const TMODE_LABEL_KEYS: Record<(typeof TMODES)[number], string> = {
  '20ft Truck': 'quotation.form.transport.20ftTruck',
  '40ft Truck': 'quotation.form.transport.40ftTruck',
  '20ft Container': 'quotation.form.transport.20ftContainer',
  '40ft Container': 'quotation.form.transport.40ftContainer',
  'Car Carrier': 'quotation.form.transport.carCarrier',
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
    paymentType: PAYMENT_TYPES[0],
    division: DIVISIONS[0],
    incoterm: INCOTERMS[0],
    terminal: '',
    condition: '',
    tmode: TMODES[0],
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

  const initialDim: Dim = { length: 0, width: 0, height: 0, quantity: 1, cbm: 0 };
  const [dimensions, setDimensions] = useState<Dim[]>([initialDim]);
  const [carrierRates, setCarrierRates] = useState<Rate[]>([]);
  const [extraServices, setExtraServices] = useState<Rate[]>([]);
  const [customerRates, setCustomerRates] = useState<Rate[]>([]);
  const [ruleSelections, setRuleSelections] =
    useState<QuotationRuleSelectionState>(emptyRuleSelectionState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rateLocked = isRateEditLocked(form?.status);

  // Lookups
  const { data: customers, isLoading: customersLoading } = useLookup('customer');
  const { data: countries, isLoading: countriesLoading } = useLookup('country', {
    include: 'code',
  });
  const { data: ports, isLoading: portsLoading } = useLookup('port');
  const { data: sales, isLoading: salesLoading } = useLookup('sales');
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
  const portOptions = useMemo(
    () => (ports?.data || []).map((p) => p.name).filter((name): name is string => Boolean(name)),
    [ports?.data],
  );
  const salesOptions = useMemo(
    () => (sales?.data || []).map((s) => s.name).filter((name): name is string => Boolean(name)),
    [sales?.data],
  );

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
  const showDimensions = !(form?.tmode || '').toLowerCase().includes('container');
  const effectiveDimensions = useMemo(
    () => (showDimensions ? dimensions : []),
    [showDimensions, dimensions],
  );

  const recalcCBM = (d: Dim) => {
    const cbm = Number(((d.length * d.width * d.height * d.quantity) / 1_000_000).toFixed(3));
    return { ...d, cbm: isFinite(cbm) ? cbm : 0 };
  };

  const addDim = () =>
    setDimensions((arr) => [...arr, { length: 0, width: 0, height: 0, quantity: 1, cbm: 0 }]);
  const removeDim = (i: number) => setDimensions((arr) => arr.filter((_, idx) => idx !== i));
  const updateDim = (i: number, patch: Partial<Dim>) =>
    setDimensions((arr) => arr.map((d, idx) => (idx === i ? recalcCBM({ ...d, ...patch }) : d)));

  const addRate = (kind: 'carrier' | 'extra' | 'customer') => {
    if (rateLocked) return;
    const row: Rate = { name: '', currency: currencyDefault, amount: 0 };
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
    const map = (r: Rate, idx: number) =>
      idx === i
        ? { ...r, ...patch, amount: patch.amount !== undefined ? Number(patch.amount) : r.amount }
        : r;
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
          if (Array.isArray(q.dimensions) && q.dimensions.length) setDimensions(q.dimensions);
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
        }
      } catch {
        toast.error(t('quotation.form.toast.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

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
      { key: 'division', label: t('quotation.form.fields.division') },
      { key: 'incoterm', label: t('quotation.form.fields.incoterm') },
      { key: 'terminal', label: t('quotation.form.fields.terminal') },
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

      const payload = {
        ...form,
        origin: originDisplay,
        destination: destinationDisplay,
        estimatedCost,
        weight: undefined,
        volume: effectiveDimensions.reduce((s, d) => s + d.cbm, 0),
        dimensions: effectiveDimensions,
        carrierRates,
        extraServices,
        customerRates: normalizedCustomerRates,
        profit: payloadProfit,
        ruleSelections,
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
      router.push('/quotations');
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
            {errors.salesManager && <p className="text-sm text-red-600">{errors.salesManager}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Parties & Commercial */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quotation.form.section.parties.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="shipper">{t('quotation.form.fields.shipper')}</Label>
            <ComboBox
              value={form.shipper}
              onChange={(v) => {
                setForm({ ...form, shipper: v });
                clearFieldError('shipper', v);
              }}
              options={customerOptions}
              isLoading={customersLoading}
              placeholder={t('quotation.form.fields.client.placeholder')}
              className="w-full"
            />
          </div>

          <div>
            <Label>{t('quotation.form.fields.division')}</Label>
            <Select
              value={form.division}
              onValueChange={(value: string) => {
                setForm({ ...form, division: value });
                clearFieldError('division', value);
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
            <Label>{t('quotation.form.fields.incoterm')}</Label>
            <Select
              value={form.incoterm}
              onValueChange={(value: string) => {
                setForm({ ...form, incoterm: value });
                clearFieldError('incoterm', value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('quotation.form.fields.incoterm')} />
              </SelectTrigger>
              <SelectContent>
                {INCOTERMS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.incoterm && <p className="text-sm text-red-600">{errors.incoterm}</p>}
          </div>
          <div>
            <Label>{t('quotation.form.fields.paymentType')}</Label>
            <Select
              value={form.paymentType}
              onValueChange={(v) => setForm({ ...form, paymentType: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('quotation.form.fields.paymentType')} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(PAYMENT_LABEL_KEYS[opt])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="terminal">{t('quotation.form.fields.terminal')}</Label>
            <Input
              id="terminal"
              value={form.terminal}
              onChange={(e) => {
                setForm({ ...form, terminal: e.target.value });
                clearFieldError('terminal', e.target.value);
              }}
            />
            {errors.terminal && <p className="text-sm text-red-600">{errors.terminal}</p>}
          </div>
          <div>
            <Label>{t('quotation.form.fields.transportMode')}</Label>
            <Select
              value={form.tmode}
              onValueChange={(value: string) => {
                setForm({ ...form, tmode: value });
                clearFieldError('tmode', value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('quotation.form.fields.transportMode.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {TMODES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(TMODE_LABEL_KEYS[opt])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tmode && <p className="text-sm text-red-600">{errors.tmode}</p>}
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
            {errors.originCountry && <p className="text-sm text-red-600">{errors.originCountry}</p>}
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
            <Label htmlFor="destinationCity">{t('quotation.form.fields.destinationCity')}</Label>
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
            <Select
              value={form.borderPort}
              onValueChange={(v) => setForm({ ...form, borderPort: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('quotation.form.fields.borderPort')} />
              </SelectTrigger>
              <SelectContent>
                {(ports?.data || []).slice(0, 200).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || t('quotation.form.fields.unnamed')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      {/* <Card>
        <CardHeader>
          <CardTitle>{t('quotation.form.section.dates.title')}</CardTitle>
          <CardDescription>{t('quotation.form.section.dates.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="quotationDate">{t('quotation.form.fields.quotationDate')}</Label>
            <Input
              id="quotationDate"
              type="date"
              value={form.quotationDate}
              onChange={(e) => setForm({ ...form, quotationDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="validityDate">{t('quotation.form.fields.validityDate')}</Label>
            <Input
              id="validityDate"
              type="date"
              value={form.validityDate}
              onChange={(e) => setForm({ ...form, validityDate: e.target.value })}
            />
          </div>
          <div></div>
          <div>
            <Label htmlFor="estDepartureDate">{t('quotation.form.fields.estDeparture')}</Label>
            <Input
              id="estDepartureDate"
              type="date"
              value={form.estDepartureDate}
              onChange={(e) => setForm({ ...form, estDepartureDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="actDepartureDate">{t('quotation.form.fields.actDeparture')}</Label>
            <Input
              id="actDepartureDate"
              type="date"
              value={form.actDepartureDate}
              onChange={(e) => setForm({ ...form, actDepartureDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="estArrivalDate">{t('quotation.form.fields.estArrival')}</Label>
            <Input
              id="estArrivalDate"
              type="date"
              value={form.estArrivalDate}
              onChange={(e) => setForm({ ...form, estArrivalDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="actArrivalDate">{t('quotation.form.fields.actArrival')}</Label>
            <Input
              id="actArrivalDate"
              type="date"
              value={form.actArrivalDate}
              onChange={(e) => setForm({ ...form, actArrivalDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card> */}

      {/* Dimensions */}
      {showDimensions && (
        <Card>
          <CardHeader>
            <CardTitle>{t('quotation.form.section.dimensions.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dimensions.map((d, i) => (
              <div key={i} className="grid grid-cols-5 items-end gap-2">
                <div>
                  <Label>{t('quotation.form.fields.length')}</Label>
                  <Input
                    type="number"
                    value={d.length}
                    onChange={(e) => updateDim(i, { length: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.width')}</Label>
                  <Input
                    type="number"
                    value={d.width}
                    onChange={(e) => updateDim(i, { width: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.height')}</Label>
                  <Input
                    type="number"
                    value={d.height}
                    onChange={(e) => updateDim(i, { height: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.quantity')}</Label>
                  <Input
                    type="number"
                    value={d.quantity}
                    onChange={(e) => updateDim(i, { quantity: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.cbm')}</Label>
                  <div className="bg-muted/30 flex h-10 items-center rounded-md border px-3">
                    {d.cbm.toFixed(3)}
                  </div>
                </div>
                <div className="col-span-5 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => removeDim(i)}>
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                {t('quotation.form.summary.totalCbm')}{' '}
                {dimensions.reduce((s, d) => s + d.cbm, 0).toFixed(3)}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDim}>
                {t('quotation.form.actions.addDimension')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rates */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quotation.form.section.rates.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rateLocked && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('quotation.form.summary.ratesLocked')}
            </div>
          )}
          {/* Carrier Rates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t('quotation.form.section.rates.carrier')}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRate('carrier')}
                disabled={rateLocked}
              >
                {t('common.add')}
              </Button>
            </div>
            {carrierRates.map((r, i) => (
              <div key={`car-${i}`} className="grid grid-cols-5 items-end gap-2">
                <div className="col-span-2">
                  <Label>{t('quotation.form.fields.name')}</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('carrier', i, { name: e.target.value })}
                    disabled={rateLocked}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.currency')}</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('carrier', i, { currency: v })}
                    disabled={rateLocked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('quotation.form.fields.currency.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quotation.form.fields.amount')}</Label>
                  <Input
                    type="number"
                    value={r.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateRate('carrier', i, { amount: Number(e.target.value) || 0 })
                    }
                    disabled={rateLocked}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRate('carrier', i)}
                    disabled={rateLocked}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              {t('quotation.form.summary.totalCarrier')} ${totalCarrier.toLocaleString()}
            </div>
          </div>

          {/* Extra Services */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t('quotation.form.section.rates.extra')}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRate('extra')}
                disabled={rateLocked}
              >
                {t('common.add')}
              </Button>
            </div>
            {extraServices.map((r, i) => (
              <div key={`ext-${i}`} className="grid grid-cols-5 items-end gap-2">
                <div className="col-span-2">
                  <Label>{t('quotation.form.fields.name')}</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('extra', i, { name: e.target.value })}
                    disabled={rateLocked}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.currency')}</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('extra', i, { currency: v })}
                    disabled={rateLocked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('quotation.form.fields.currency.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quotation.form.fields.amount')}</Label>
                  <Input
                    type="number"
                    value={r.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateRate('extra', i, { amount: Number(e.target.value) || 0 })
                    }
                    disabled={rateLocked}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRate('extra', i)}
                    disabled={rateLocked}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              {t('quotation.form.summary.totalExtra')} ${totalExtra.toLocaleString()}
            </div>
          </div>

          {/* Customer Rates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t('quotation.form.section.rates.customer')}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRate('customer')}
                disabled={rateLocked}
              >
                {t('common.add')}
              </Button>
            </div>
            {customerRates.map((r, i) => (
              <div key={`cus-${i}`} className="grid grid-cols-6 items-end gap-2">
                <div className="col-span-2">
                  <Label>{t('quotation.form.fields.name')}</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('customer', i, { name: e.target.value })}
                    disabled={rateLocked}
                  />
                </div>
                <div>
                  <Label>{t('quotation.form.fields.currency')}</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('customer', i, { currency: v })}
                    disabled={rateLocked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('quotation.form.fields.currency.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quotation.form.fields.amount')}</Label>
                  <Input
                    type="number"
                    value={r.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateRate('customer', i, { amount: Number(e.target.value) || 0 })
                    }
                    disabled={rateLocked}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant={r.isPrimary ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => markPrimary(i)}
                    disabled={rateLocked}
                  >
                    {r.isPrimary
                      ? t('quotation.form.actions.primarySelected')
                      : t('quotation.form.actions.markPrimary')}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRate('customer', i)}
                    disabled={rateLocked}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              {primaryCustomerRate ? (
                <span>
                  {t('quotation.form.summary.activeCustomerOffer')}{' '}
                  <span className="font-medium">
                    {primaryCustomerRate.name || t('quotation.form.fields.unnamed')}
                  </span>{' '}
                  · {primaryCustomerRate.currency} {primaryCustomerRate.amount.toLocaleString()}
                </span>
              ) : (
                t('quotation.form.summary.primaryOfferNotSet')
              )}
            </div>
          </div>

          <div className="rounded-md bg-emerald-50 p-3 font-medium text-emerald-700">
            {t('quotation.form.summary.estimatedProfit')} ${profit.amount.toLocaleString()}{' '}
            {profit.currency}
          </div>
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
            <div className="md:col-span-2">
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
