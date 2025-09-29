'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

type Rate = { name: string; currency: string; amount: number };
type Dim = { length: number; width: number; height: number; quantity: number; cbm: number };

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'];
const DIVISIONS = ['import', 'export', 'transit'];
const PAYMENT_TYPES = ['Prepaid', 'Collect'];
const TMODES = ['20ft Truck', '40ft Truck', '20ft Container', '40ft Container', 'Car Carrier'];
const CURRENCIES = ['USD', 'CNY', 'MNT'];

export default function EditQuotationPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Lookups
  const { data: countries } = useLookup('country', { include: 'code' });
  const { data: ports } = useLookup('port');
  const { data: sales } = useLookup('sales');

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

  const currencyDefault = CURRENCIES[0];
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

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${id}`);
        const json = await res.json();
        if (json?.success && json?.data) {
          const q = json.data;
          // Populate form fields
          setForm((prev: any) => ({ ...prev, ...q }));
          // Populate tables if present
          if (Array.isArray(q.dimensions) && q.dimensions.length) setDimensions(q.dimensions);
          if (Array.isArray(q.carrierRates)) setCarrierRates(q.carrierRates);
          if (Array.isArray(q.extraServices)) setExtraServices(q.extraServices);
          if (Array.isArray(q.customerRates)) setCustomerRates(q.customerRates);
        }
      } catch (e) {
        toast.error('Failed to load quotation');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Keep top-level mirrored fields consistent and compute deriveds
        estimatedCost: totalCarrier + totalExtra,
        weight: undefined,
        volume: dimensions.reduce((s, d) => s + d.cbm, 0),
        dimensions,
        carrierRates,
        extraServices,
        customerRates,
        profit,
      };
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Failed to save');
        return;
      }
      toast.success('Quotation updated');
      router.push('/quotations');
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Edit Quotation {form?.quotationNumber ? `• ${form.quotationNumber}` : ''}
        </h1>
        <p className="text-gray-600">Update all details of the quotation</p>
      </div>

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
            <Label htmlFor="origin">Origin (Port)</Label>
            <ComboBox
              value={form.origin}
              onChange={(v) => setForm({ ...form, origin: v })}
              options={(ports?.data || []).map((p) => p.name)}
              placeholder="Search port..."
            />
          </div>
          <div>
            <Label htmlFor="destination">Destination (Country)</Label>
            <ComboBox
              value={form.destination}
              onChange={(v) => setForm({ ...form, destination: v })}
              options={(countries?.data || []).map((c) =>
                c.code ? `${c.name} (${c.code})` : c.name,
              )}
              placeholder="Search country..."
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
            <ComboBox
              value={form.salesManager}
              onChange={(v) => setForm({ ...form, salesManager: v })}
              options={(sales?.data || []).map((s) => s.name)}
              placeholder="Search sales..."
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
                <SelectValue placeholder="Payment type" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {(ports?.data || []).slice(0, 200).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || '(Unnamed)'}
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
