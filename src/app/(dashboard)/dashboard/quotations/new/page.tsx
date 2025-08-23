'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComboBox } from '@/components/ui/combobox';
import { DraftsModal, addDraft, QuotationDraft } from '@/components/quotations/DraftsModal';
import { toast } from 'sonner';

type Rate = { name: string; currency: string; amount: number };
type Dim = { length: number; width: number; height: number; quantity: number; cbm: number };

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'];
const DIVISIONS = ['import', 'export', 'transit'];
const PAYMENT_TYPES = ['Prepaid', 'Collect'];
const TMODES = ['20ft Truck', '40ft Truck', '20ft Container', '40ft Container', 'Car Carrier'];
const BORDER_PORTS = ['Erlian (Erenhot)', 'Zamyn-Uud', 'Tianjin Port', 'Qingdao Port'];
const CURRENCIES = ['USD', 'CNY', 'MNT'];

export default function NewQuotationPage() {
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
    consignee: '',
    shipper: '',
    payer: '',
    paymentType: PAYMENT_TYPES[0],
    division: DIVISIONS[0],
    incoterm: INCOTERMS[0],
    terminal: '',
    condition: '',
    tmode: TMODES[0],
    // Routing
    destinationCountry: '',
    destinationCity: '',
    destinationAddress: '',
    borderPort: BORDER_PORTS[0],
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
  };
  const [form, setForm] = useState<any>(initialForm);

  const initialDim: Dim = { length: 0, width: 0, height: 0, quantity: 1, cbm: 0 };
  const [dimensions, setDimensions] = useState<Dim[]>([initialDim]);
  const [carrierRates, setCarrierRates] = useState<Rate[]>([]);
  const [extraServices, setExtraServices] = useState<Rate[]>([]);
  const [customerRates, setCustomerRates] = useState<Rate[]>([]);

  const currencyDefault = CURRENCIES[0];
  const CLIENT_OPTIONS = useMemo(
    () => [
      'Erdenet Mining Corporation',
      'Oyu Tolgoi LLC',
      'MAK LLC',
      'Tavan Tolgoi JSC',
      'APU JSC',
      'Unitel',
      'Gerege Systems',
      'MCS Coca-Cola',
    ],
    [],
  );
  const CITY_OPTIONS = useMemo(
    () => [
      'Ulaanbaatar, Mongolia',
      'Darkhan, Mongolia',
      'Erdenet, Mongolia',
      'Zamyn-Uud Border',
      'Tianjin Port, China',
      'Qingdao Port, China',
      'Shanghai Port, China',
    ],
    [],
  );

  const totalCarrier = useMemo(
    () => carrierRates.reduce((s, r) => s + (r.currency === 'USD' ? r.amount : r.amount), 0),
    [carrierRates],
  );
  const totalExtra = useMemo(
    () => extraServices.reduce((s, r) => s + (r.currency === 'USD' ? r.amount : r.amount), 0),
    [extraServices],
  );
  const totalCustomer = useMemo(
    () => customerRates.reduce((s, r) => s + (r.currency === 'USD' ? r.amount : r.amount), 0),
    [customerRates],
  );
  const profit = useMemo(
    () => ({ currency: 'USD', amount: totalCustomer - totalCarrier - totalExtra }),
    [totalCarrier, totalCustomer, totalExtra],
  );

  const recalcCBM = (d: Dim) => {
    // assume cm, convert to m^3
    const cbm = Number(((d.length * d.width * d.height * d.quantity) / 1_000_000).toFixed(3));
    return { ...d, cbm: isFinite(cbm) ? cbm : 0 };
  };

  const addDim = () =>
    setDimensions((arr) => [...arr, { length: 0, width: 0, height: 0, quantity: 1, cbm: 0 }]);
  const removeDim = (i: number) => setDimensions((arr) => arr.filter((_, idx) => idx !== i));
  const updateDim = (i: number, patch: Partial<Dim>) =>
    setDimensions((arr) => arr.map((d, idx) => (idx === i ? recalcCBM({ ...d, ...patch }) : d)));

  const addRate = (kind: 'carrier' | 'extra' | 'customer') => {
    const row: Rate = { name: '', currency: currencyDefault, amount: 0 };
    if (kind === 'carrier') setCarrierRates((r) => [...r, row]);
    if (kind === 'extra') setExtraServices((r) => [...r, row]);
    if (kind === 'customer') setCustomerRates((r) => [...r, row]);
  };
  const removeRate = (kind: 'carrier' | 'extra' | 'customer', i: number) => {
    if (kind === 'carrier') setCarrierRates((r) => r.filter((_, idx) => idx !== i));
    if (kind === 'extra') setExtraServices((r) => r.filter((_, idx) => idx !== i));
    if (kind === 'customer') setCustomerRates((r) => r.filter((_, idx) => idx !== i));
  };
  const updateRate = (kind: 'carrier' | 'extra' | 'customer', i: number, patch: Partial<Rate>) => {
    const map = (r: Rate, idx: number) =>
      idx === i
        ? { ...r, ...patch, amount: patch.amount !== undefined ? Number(patch.amount) : r.amount }
        : r;
    if (kind === 'carrier') setCarrierRates((arr) => arr.map(map));
    if (kind === 'extra') setExtraServices((arr) => arr.map(map));
    if (kind === 'customer') setCustomerRates((arr) => arr.map(map));
  };

  const [saving, setSaving] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

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
        if (draft.dimensions) setDimensions(draft.dimensions);
        if (draft.carrierRates) setCarrierRates(draft.carrierRates);
        if (draft.extraServices) setExtraServices(draft.extraServices);
        if (draft.customerRates) setCustomerRates(draft.customerRates);
      }
    } catch {}
  }, []);

  // Autosave draft
  useEffect(() => {
    const payload = { form, dimensions, carrierRates, extraServices, customerRates };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {}
  }, [form, dimensions, carrierRates, extraServices, customerRates]);
  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Basic fields expected by API
        estimatedCost: totalCarrier + totalExtra, // baseline cost from buy side
        weight: undefined,
        volume: dimensions.reduce((s, d) => s + d.cbm, 0),
        // Extended fields
        dimensions: dimensions,
        carrierRates,
        extraServices,
        customerRates,
        profit,
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Quotation created');
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem('quotation_quick_form_draft_v1');
      localStorage.removeItem('quotation_new_form_draft_v1');
      // Reset form state after success
      setForm(initialForm);
      setDimensions([{ ...initialDim }]);
      setCarrierRates([]);
      setExtraServices([]);
      setCustomerRates([]);
      // Optional: navigate back later
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Quotation</h1>
        <p className="text-gray-600">Capture all key details for the initial quote</p>
        <p className="mt-1 text-sm text-red-600">
          Warning: Drafts are stored in this browser only and may be lost after server changes,
          clearing cache, or restarting the device.
        </p>
      </div>

      <DraftsModal
        open={showDrafts}
        onClose={() => setShowDrafts(false)}
        onLoadQuick={(d: QuotationDraft) => {
          const src = d.data?.form ?? d.data;
          if (src) setForm((prev: any) => ({ ...prev, ...src }));
          // Load tables if present
          if (d.data?.dimensions) setDimensions(d.data.dimensions);
          if (d.data?.carrierRates) setCarrierRates(d.data.carrierRates);
          if (d.data?.extraServices) setExtraServices(d.data.extraServices);
          if (d.data?.customerRates) setCustomerRates(d.data.customerRates);
          setShowDrafts(false);
        }}
        onOpenFull={() => {
          /* already here */
        }}
      />

      {/* Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Client and cargo</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="client">Client</Label>
            <ComboBox
              value={form.client}
              onChange={(v) => setForm({ ...form, client: v })}
              options={CLIENT_OPTIONS}
              placeholder="Start typing..."
            />
          </div>
          <div>
            <Label htmlFor="cargoType">Cargo Type</Label>
            <Input
              id="cargoType"
              value={form.cargoType}
              onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="origin">Origin</Label>
            <ComboBox
              value={form.origin}
              onChange={(v) => setForm({ ...form, origin: v })}
              options={CITY_OPTIONS}
              placeholder="Search city/port..."
            />
          </div>
          <div>
            <Label htmlFor="destination">Destination</Label>
            <ComboBox
              value={form.destination}
              onChange={(v) => setForm({ ...form, destination: v })}
              options={CITY_OPTIONS}
              placeholder="Search city/port..."
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="commodity">Commodity</Label>
            <Input
              id="commodity"
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="salesManager">Sales Manager</Label>
            <Input
              id="salesManager"
              value={form.salesManager}
              onChange={(e) => setForm({ ...form, salesManager: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parties & Commercial */}
      <Card>
        <CardHeader>
          <CardTitle>Parties & Commercial</CardTitle>
          <CardDescription>Shipper/consignee, division, incoterm, payment</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="shipper">Shipper</Label>
            <Input
              id="shipper"
              value={form.shipper}
              onChange={(e) => setForm({ ...form, shipper: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="consignee">Consignee</Label>
            <Input
              id="consignee"
              value={form.consignee}
              onChange={(e) => setForm({ ...form, consignee: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="payer">Payer</Label>
            <Input
              id="payer"
              value={form.payer}
              onChange={(e) => setForm({ ...form, payer: e.target.value })}
            />
          </div>

          <div>
            <Label>Division</Label>
            <Select value={form.division} onValueChange={(v) => setForm({ ...form, division: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Incoterm</Label>
            <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Incoterm" />
              </SelectTrigger>
              <SelectContent>
                {INCOTERMS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Type</Label>
            <Select
              value={form.paymentType}
              onValueChange={(v) => setForm({ ...form, paymentType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="terminal">Terminal</Label>
            <Input
              id="terminal"
              value={form.terminal}
              onChange={(e) => setForm({ ...form, terminal: e.target.value })}
            />
          </div>
          <div>
            <Label>Transport Mode</Label>
            <Select value={form.tmode} onValueChange={(v) => setForm({ ...form, tmode: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                {TMODES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Routing */}
      <Card>
        <CardHeader>
          <CardTitle>Routing</CardTitle>
          <CardDescription>Destination and border/port</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="destinationCountry">Destination Country</Label>
            <Input
              id="destinationCountry"
              value={form.destinationCountry}
              onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="destinationCity">Destination City</Label>
            <Input
              id="destinationCity"
              value={form.destinationCity}
              onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
            />
          </div>
          <div>
            <Label>Border/Port</Label>
            <Select
              value={form.borderPort}
              onValueChange={(v) => setForm({ ...form, borderPort: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Border/Port" />
              </SelectTrigger>
              <SelectContent>
                {BORDER_PORTS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="destinationAddress">Destination Address</Label>
            <Input
              id="destinationAddress"
              value={form.destinationAddress || ''}
              onChange={(e) => setForm({ ...form, destinationAddress: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
          <CardDescription>Quote and milestone dates</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="quotationDate">Quotation Date</Label>
            <Input
              id="quotationDate"
              type="date"
              value={form.quotationDate}
              onChange={(e) => setForm({ ...form, quotationDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="validityDate">Validity Date</Label>
            <Input
              id="validityDate"
              type="date"
              value={form.validityDate}
              onChange={(e) => setForm({ ...form, validityDate: e.target.value })}
            />
          </div>
          <div></div>
          <div>
            <Label htmlFor="estDepartureDate">Est. Departure</Label>
            <Input
              id="estDepartureDate"
              type="date"
              value={form.estDepartureDate}
              onChange={(e) => setForm({ ...form, estDepartureDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="actDepartureDate">Act. Departure</Label>
            <Input
              id="actDepartureDate"
              type="date"
              value={form.actDepartureDate}
              onChange={(e) => setForm({ ...form, actDepartureDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="estArrivalDate">Est. Arrival</Label>
            <Input
              id="estArrivalDate"
              type="date"
              value={form.estArrivalDate}
              onChange={(e) => setForm({ ...form, estArrivalDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="actArrivalDate">Act. Arrival</Label>
            <Input
              id="actArrivalDate"
              type="date"
              value={form.actArrivalDate}
              onChange={(e) => setForm({ ...form, actArrivalDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>Dimensions</CardTitle>
          <CardDescription>Length/Width/Height (cm) × Quantity, auto-CBM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dimensions.map((d, i) => (
            <div key={i} className="grid grid-cols-5 items-end gap-2">
              <div>
                <Label>Length</Label>
                <Input
                  type="number"
                  value={d.length}
                  onChange={(e) => updateDim(i, { length: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Width</Label>
                <Input
                  type="number"
                  value={d.width}
                  onChange={(e) => updateDim(i, { width: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Height</Label>
                <Input
                  type="number"
                  value={d.height}
                  onChange={(e) => updateDim(i, { height: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Qty</Label>
                <Input
                  type="number"
                  value={d.quantity}
                  onChange={(e) => updateDim(i, { quantity: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>CBM</Label>
                <div className="bg-muted/30 flex h-10 items-center rounded-md border px-3">
                  {d.cbm.toFixed(3)}
                </div>
              </div>
              <div className="col-span-5 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => removeDim(i)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Total CBM: {dimensions.reduce((s, d) => s + d.cbm, 0).toFixed(3)}
            </div>
            <Button variant="outline" size="sm" onClick={addDim}>
              Add Dimension
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <CardDescription>Carrier, extra services, customer offer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Carrier Rates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Carrier Rates</div>
              <Button variant="outline" size="sm" onClick={() => addRate('carrier')}>
                Add
              </Button>
            </div>
            {carrierRates.map((r, i) => (
              <div key={`car-${i}`} className="grid grid-cols-5 items-end gap-2">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('carrier', i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('carrier', i, { currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
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
                  <Label>Amount</Label>
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
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              Total Carrier: ${totalCarrier.toLocaleString()}
            </div>
          </div>

          {/* Extra Services */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Extra Services</div>
              <Button variant="outline" size="sm" onClick={() => addRate('extra')}>
                Add
              </Button>
            </div>
            {extraServices.map((r, i) => (
              <div key={`ext-${i}`} className="grid grid-cols-5 items-end gap-2">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('extra', i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('extra', i, { currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
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
                  <Label>Amount</Label>
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
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              Total Extra: ${totalExtra.toLocaleString()}
            </div>
          </div>

          {/* Customer Rates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Customer Offer</div>
              <Button variant="outline" size="sm" onClick={() => addRate('customer')}>
                Add
              </Button>
            </div>
            {customerRates.map((r, i) => (
              <div key={`cus-${i}`} className="grid grid-cols-5 items-end gap-2">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRate('customer', i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={r.currency}
                    onValueChange={(v) => updateRate('customer', i, { currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
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
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={r.amount}
                    onChange={(e) =>
                      updateRate('customer', i, { amount: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => removeRate('customer', i)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-sm">
              Total Customer: ${totalCustomer.toLocaleString()}
            </div>
          </div>

          <div className="rounded-md bg-emerald-50 p-3 font-medium text-emerald-700">
            Estimated Profit: ${profit.amount.toLocaleString()} {profit.currency}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Include/Exclude and remarks</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="include">Include</Label>
            <textarea
              id="include"
              className="min-h-[80px] w-full rounded-md border p-2"
              value={form.include}
              onChange={(e) => setForm({ ...form, include: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="exclude">Exclude</Label>
            <textarea
              id="exclude"
              className="min-h-[80px] w-full rounded-md border p-2"
              value={form.exclude}
              onChange={(e) => setForm({ ...form, exclude: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="comment">Comment</Label>
            <textarea
              id="comment"
              className="min-h-[80px] w-full rounded-md border p-2"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="remark">Remark</Label>
            <textarea
              id="remark"
              className="min-h-[80px] w-full rounded-md border p-2"
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDrafts(true)}>
            Drafts
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              addDraft({ form, dimensions, carrierRates, extraServices, customerRates });
              toast.success('Draft saved');
            }}
          >
            Save as Draft
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(DRAFT_KEY);
            localStorage.removeItem('quotation_quick_form_draft_v1');
            localStorage.removeItem('quotation_new_form_draft_v1');
            setForm(initialForm);
            setDimensions([{ ...initialDim }]);
            setCarrierRates([]);
            setExtraServices([]);
            setCustomerRates([]);
            toast.message('Draft cleared');
          }}
        >
          Clear Draft
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Saving...' : 'Create Quotation'}
        </Button>
      </div>
    </div>
  );
}
