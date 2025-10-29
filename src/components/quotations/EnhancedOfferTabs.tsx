'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComboBox } from '@/components/ui/combobox';
import { X, Plus, Edit2 } from 'lucide-react';
import type { QuotationOffer } from '@/types/quotation';
import type { RateItem } from '@/lib/quotations/rates';
import {
  computeProfitFromRates,
  ensureSinglePrimaryRate,
  sumRateAmounts,
} from '@/lib/quotations/rates';
import { useT } from '@/lib/i18n';

// Simple UUID generator for browser
const generateId = () => 'offer_' + Math.random().toString(36).substr(2, 9);

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'] as const;
const CURRENCIES = ['USD', 'CNY', 'MNT', 'EUR'] as const;
const DIMENSION_ENABLED_MODES = new Set(
  ['lcl', 'ltl', 'air', 'zadgai achaa', 'zadgai technik', 'tawtsant wagon', 'wagon'].map((value) =>
    value.toLowerCase(),
  ),
);

type Dim = { length: number; width: number; height: number; quantity: number; cbm: number };

const requiresDimensions = (transportMode?: string | null) => {
  if (!transportMode) return false;
  return DIMENSION_ENABLED_MODES.has(transportMode.trim().toLowerCase());
};

export interface EnhancedOfferTabsProps {
  offers: QuotationOffer[];
  onChange: (offers: QuotationOffer[]) => void;
  className?: string;

  // Lookup options
  transportModeOptions?: string[];
  portOptions?: string[];
  shipperOptions?: string[];
  shipperLoading?: boolean;
  portsLoading?: boolean;
  transportLoading?: boolean;
}

export function EnhancedOfferTabs({
  offers,
  onChange,
  className,
  transportModeOptions = [],
  portOptions = [],
  shipperOptions = [],
  shipperLoading = false,
  portsLoading = false,
  transportLoading = false,
}: EnhancedOfferTabsProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState(0);

  const addOffer = () => {
    const newOffer: QuotationOffer = {
      id: generateId(),
      quotationId: '',
      title: `Offer ${offers.length + 1}`,
      order: offers.length,
      offerNumber: undefined,

      // Transport & Route details
      transportMode: undefined,
      routeSummary: undefined,
      borderPort: undefined,

      // Commercial terms
      incoterm: 'EXW',
      shipper: undefined,
      terminal: undefined,

      // Shipment details
      shipmentCondition: undefined,
      transitTime: undefined,
      rate: undefined,
      rateCurrency: 'USD',
      grossWeight: undefined,
      dimensionsCbm: undefined,

      // Extended data
      dimensions: [],
      carrierRates: [],
      extraServices: [],
      customerRates: [],
      profit: undefined,

      // Notes
      notes: undefined,
      include: undefined,
      exclude: undefined,
      remark: undefined,
    };

    const updatedOffers = [...offers, newOffer];
    onChange(updatedOffers);
    setActiveTab(updatedOffers.length - 1);
  };

  const removeOffer = (index: number) => {
    if (offers.length <= 1) return; // Keep at least one offer

    const updatedOffers = offers.filter((_, i) => i !== index);
    onChange(updatedOffers);

    // Adjust active tab if necessary
    if (activeTab >= updatedOffers.length) {
      setActiveTab(Math.max(0, updatedOffers.length - 1));
    } else if (activeTab > index) {
      setActiveTab(activeTab - 1);
    }
  };

  const updateOffer = (index: number, updates: Partial<QuotationOffer>) => {
    const updatedOffers = offers.map((offer, i) =>
      i === index ? { ...offer, ...updates } : offer,
    );
    onChange(updatedOffers);
  };

  const currentOffer = offers[activeTab] || offers[0];

  // Dimensions management for current offer
  const currentDimensions = useMemo(() => {
    return currentOffer?.dimensions || [];
  }, [currentOffer?.dimensions]);

  const showDimensions = requiresDimensions(currentOffer?.transportMode);

  const recalcCBM = useCallback((d: Dim) => {
    const cbm = Number(((d.length * d.width * d.height * d.quantity) / 1_000_000).toFixed(3));
    return { ...d, cbm: isFinite(cbm) ? cbm : 0 };
  }, []);

  const addDim = () => {
    const newDim: Dim = { length: 0, width: 0, height: 0, quantity: 1, cbm: 0 };
    const updatedDimensions = [...currentDimensions, newDim];
    updateOffer(activeTab, { dimensions: updatedDimensions });
  };

  const removeDim = (dimIndex: number) => {
    const updatedDimensions = currentDimensions.filter((_, i) => i !== dimIndex);
    updateOffer(activeTab, { dimensions: updatedDimensions });
  };

  const updateDim = (dimIndex: number, patch: Partial<Dim>) => {
    const updatedDimensions = currentDimensions.map((d, i) =>
      i === dimIndex ? recalcCBM({ ...d, ...patch, cbm: d.cbm || 0 }) : d,
    );
    updateOffer(activeTab, { dimensions: updatedDimensions });
  };

  // Rates management for current offer
  const currentCarrierRates = currentOffer?.carrierRates || [];
  const currentExtraServices = currentOffer?.extraServices || [];
  const currentCustomerRates = currentOffer?.customerRates || [];

  const addRate = (kind: 'carrier' | 'extra' | 'customer') => {
    const row: RateItem = { name: '', currency: 'USD', amount: 0 };

    if (kind === 'carrier') {
      updateOffer(activeTab, { carrierRates: [...currentCarrierRates, row] });
    } else if (kind === 'extra') {
      updateOffer(activeTab, { extraServices: [...currentExtraServices, row] });
    } else if (kind === 'customer') {
      const newRates = ensureSinglePrimaryRate([
        ...currentCustomerRates,
        { ...row, isPrimary: currentCustomerRates.length === 0 },
      ]);
      updateOffer(activeTab, { customerRates: newRates });
    }
  };

  const removeRate = (kind: 'carrier' | 'extra' | 'customer', rateIndex: number) => {
    if (kind === 'carrier') {
      updateOffer(activeTab, {
        carrierRates: currentCarrierRates.filter((_, i) => i !== rateIndex),
      });
    } else if (kind === 'extra') {
      updateOffer(activeTab, {
        extraServices: currentExtraServices.filter((_, i) => i !== rateIndex),
      });
    } else if (kind === 'customer') {
      const newRates = ensureSinglePrimaryRate(
        currentCustomerRates.filter((_, i) => i !== rateIndex),
      );
      updateOffer(activeTab, { customerRates: newRates });
    }
  };

  const updateRate = (
    kind: 'carrier' | 'extra' | 'customer',
    rateIndex: number,
    patch: Partial<RateItem>,
  ) => {
    const mapRate = (r: RateItem, idx: number) =>
      idx === rateIndex
        ? { ...r, ...patch, amount: patch.amount !== undefined ? Number(patch.amount) : r.amount }
        : r;

    if (kind === 'carrier') {
      updateOffer(activeTab, { carrierRates: currentCarrierRates.map(mapRate) });
    } else if (kind === 'extra') {
      updateOffer(activeTab, { extraServices: currentExtraServices.map(mapRate) });
    } else if (kind === 'customer') {
      const newRates = ensureSinglePrimaryRate(currentCustomerRates.map(mapRate));
      updateOffer(activeTab, { customerRates: newRates });
    }
  };

  const markPrimary = (rateIndex: number) => {
    const newRates = ensureSinglePrimaryRate(
      currentCustomerRates.map((rate, idx) => ({ ...rate, isPrimary: idx === rateIndex })),
    );
    updateOffer(activeTab, { customerRates: newRates });
  };

  // Calculate totals and profit for current offer
  const totalCarrier = useMemo(() => sumRateAmounts(currentCarrierRates), [currentCarrierRates]);
  const totalExtra = useMemo(() => sumRateAmounts(currentExtraServices), [currentExtraServices]);
  const primaryCustomerRate = useMemo(
    () => currentCustomerRates.find((rate) => rate.isPrimary) || null,
    [currentCustomerRates],
  );
  const profit = useMemo(
    () => computeProfitFromRates(primaryCustomerRate, currentCarrierRates, currentExtraServices),
    [primaryCustomerRate, currentCarrierRates, currentExtraServices],
  );

  // Persist profit into the active offer when values change
  useEffect(() => {
    if (!currentOffer) return;
    const existing = currentOffer.profit;
    const nextAmount = Number(profit.amount ?? 0);
    const existingAmount = Number(existing?.amount ?? NaN);
    const amountMatches = !Number.isNaN(existingAmount) && existingAmount === nextAmount;
    const currencyMatches = (existing?.currency || '') === (profit.currency || '');
    if (!existing || !amountMatches || !currencyMatches) {
      const updatedOffers = offers.map((offer, idx) =>
        idx === activeTab ? { ...offer, profit } : offer,
      );
      onChange(updatedOffers);
    }
  }, [activeTab, currentOffer, profit, offers, onChange]);

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className="mb-4 flex items-center gap-2 border-b">
        {offers.map((offer, index) => (
          <div key={offer.id} className="flex items-center">
            <button
              onClick={() => setActiveTab(index)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'border-b-2 border-blue-700 bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {offer.title || `${t('quotation.offers.tab.default')} ${index + 1}`}
            </button>
            {offers.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOffer(index)}
                className="ml-1 h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOffer} className="ml-2">
          <Plus className="mr-1 h-4 w-4" />
          {t('quotation.offers.actions.addOffer')}
        </Button>
      </div>

      {/* Tab Content */}
      {currentOffer && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                {t('quotation.offers.sections.basic')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`offer-title-${activeTab}`}>
                    {t('quotation.form.fields.offerTitle')}
                  </Label>
                  <Input
                    id={`offer-title-${activeTab}`}
                    value={currentOffer.title || ''}
                    onChange={(e) => updateOffer(activeTab, { title: e.target.value })}
                    placeholder={t('quotation.form.fields.offerTitle.placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`offer-number-${activeTab}`}>
                    {t('quotation.form.fields.offerNumber')}
                  </Label>
                  <Input
                    id={`offer-number-${activeTab}`}
                    value={currentOffer.offerNumber || ''}
                    onChange={(e) => updateOffer(activeTab, { offerNumber: e.target.value })}
                    placeholder={t('quotation.form.fields.offerNumber.placeholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commercial Terms */}
          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.offers.sections.commercial')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`incoterm-${activeTab}`}>
                    {t('quotation.form.fields.incoterm')}
                  </Label>
                  <Select
                    value={currentOffer.incoterm || 'EXW'}
                    onValueChange={(value) => updateOffer(activeTab, { incoterm: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('quotation.form.fields.incoterm.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`shipper-${activeTab}`}>
                    {t('quotation.form.fields.shipper')}
                  </Label>
                  <ComboBox
                    value={currentOffer.shipper || ''}
                    onChange={(value) => updateOffer(activeTab, { shipper: value })}
                    options={shipperOptions}
                    placeholder={t('quotation.form.fields.shipper.placeholder')}
                    isLoading={shipperLoading}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`terminal-${activeTab}`}>
                    {t('quotation.form.fields.terminal')}
                  </Label>
                  <ComboBox
                    value={currentOffer.terminal || ''}
                    onChange={(value) => updateOffer(activeTab, { terminal: value })}
                    options={portOptions}
                    placeholder={t('quotation.form.fields.terminal.placeholder')}
                    isLoading={portsLoading}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transport & Route */}
          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.offers.sections.transport')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`transport-mode-${activeTab}`}>
                    {t('quotation.form.fields.transportMode')}
                  </Label>
                  <Select
                    value={currentOffer.transportMode || ''}
                    onValueChange={(value) => updateOffer(activeTab, { transportMode: value })}
                    disabled={transportLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('quotation.form.fields.transportMode.selectPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {transportModeOptions.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`border-port-${activeTab}`}>
                    {t('quotation.form.fields.borderPort')}
                  </Label>
                  <ComboBox
                    value={currentOffer.borderPort || ''}
                    onChange={(value) => updateOffer(activeTab, { borderPort: value })}
                    options={portOptions}
                    placeholder={t('quotation.form.fields.borderPort.placeholder')}
                    isLoading={portsLoading}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`route-summary-${activeTab}`}>
                    {t('quotation.form.fields.routeSummary')}
                  </Label>
                  <Input
                    id={`route-summary-${activeTab}`}
                    value={currentOffer.routeSummary || ''}
                    onChange={(e) => updateOffer(activeTab, { routeSummary: e.target.value })}
                    placeholder={t('quotation.form.fields.routeSummary.placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`shipment-condition-${activeTab}`}>
                    {t('quotation.form.fields.shipmentCondition')}
                  </Label>
                  <Input
                    id={`shipment-condition-${activeTab}`}
                    value={currentOffer.shipmentCondition || ''}
                    onChange={(e) => updateOffer(activeTab, { shipmentCondition: e.target.value })}
                    placeholder={t('quotation.form.fields.shipmentCondition.placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`transit-time-${activeTab}`}>
                    {t('quotation.form.fields.transitTime')}
                  </Label>
                  <Input
                    id={`transit-time-${activeTab}`}
                    value={currentOffer.transitTime || ''}
                    onChange={(e) => updateOffer(activeTab, { transitTime: e.target.value })}
                    placeholder={t('quotation.form.fields.transitTime.placeholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimensions (if needed) */}
          {showDimensions && (
            <Card>
              <CardHeader>
                <CardTitle>{t('quotation.offers.sections.dimensions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentDimensions.map((d, i) => (
                  <div key={i} className="grid grid-cols-5 items-end gap-2">
                    <div>
                      <Label>{`${t('quotation.form.fields.length')} (cm)`}</Label>
                      <Input
                        type="number"
                        value={d.length}
                        onChange={(e) => updateDim(i, { length: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>{`${t('quotation.form.fields.width')} (cm)`}</Label>
                      <Input
                        type="number"
                        value={d.width}
                        onChange={(e) => updateDim(i, { width: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>{`${t('quotation.form.fields.height')} (cm)`}</Label>
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
                        {(d.cbm || 0).toFixed(3)}
                      </div>
                    </div>
                    <div className="col-span-5 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => removeDim(i)}>
                        {t('common.remove')}
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    {t('quotation.form.summary.totalCbm')}{' '}
                    {currentDimensions.reduce((s, d) => s + (d.cbm || 0), 0).toFixed(3)}
                  </div>
                  <Button variant="outline" size="sm" onClick={addDim}>
                    {t('quotation.form.actions.addDimension')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rates */}
          <Card>
            <CardHeader>
              <CardTitle>{t('quotation.offers.sections.rates')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Carrier Rates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{t('quotation.form.section.rates.carrier')}</div>
                  <Button variant="outline" size="sm" onClick={() => addRate('carrier')}>
                    {t('common.add')}
                  </Button>
                </div>
                {currentCarrierRates.map((r, i) => (
                  <div key={`car-${i}`} className="grid grid-cols-5 items-end gap-2">
                    <div className="col-span-2">
                      <Label>{t('quotation.form.fields.name')}</Label>
                      <Input
                        value={r.name}
                        onChange={(e) => updateRate('carrier', i, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t('quotation.form.fields.currency')}</Label>
                      <Select
                        value={r.currency}
                        onValueChange={(v) => updateRate('carrier', i, { currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('quotation.form.fields.currency.placeholder')}
                          />
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
                        onChange={(e) =>
                          updateRate('carrier', i, { amount: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => removeRate('carrier', i)}>
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
                  <Button variant="outline" size="sm" onClick={() => addRate('extra')}>
                    {t('common.add')}
                  </Button>
                </div>
                {currentExtraServices.map((r, i) => (
                  <div key={`ext-${i}`} className="grid grid-cols-5 items-end gap-2">
                    <div className="col-span-2">
                      <Label>{t('quotation.form.fields.name')}</Label>
                      <Input
                        value={r.name}
                        onChange={(e) => updateRate('extra', i, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t('quotation.form.fields.currency')}</Label>
                      <Select
                        value={r.currency}
                        onValueChange={(v) => updateRate('extra', i, { currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('quotation.form.fields.currency.placeholder')}
                          />
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
                        onChange={(e) =>
                          updateRate('extra', i, { amount: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => removeRate('extra', i)}>
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
                  <Button variant="outline" size="sm" onClick={() => addRate('customer')}>
                    {t('common.add')}
                  </Button>
                </div>
                {currentCustomerRates.map((r, i) => (
                  <div key={`cus-${i}`} className="grid grid-cols-6 items-end gap-2">
                    <div className="col-span-2">
                      <Label>{t('quotation.form.fields.name')}</Label>
                      <Input
                        value={r.name}
                        onChange={(e) => updateRate('customer', i, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t('quotation.form.fields.currency')}</Label>
                      <Select
                        value={r.currency}
                        onValueChange={(v) => updateRate('customer', i, { currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('quotation.form.fields.currency.placeholder')}
                          />
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
                        onChange={(e) =>
                          updateRate('customer', i, { amount: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant={r.isPrimary ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => markPrimary(i)}
                      >
                        {r.isPrimary
                          ? t('quotation.form.actions.primarySelected')
                          : t('quotation.form.actions.markPrimary')}
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => removeRate('customer', i)}>
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
        </div>
      )}
    </div>
  );
}
