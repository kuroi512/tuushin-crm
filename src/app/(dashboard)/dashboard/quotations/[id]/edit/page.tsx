'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function EditQuotationPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    client: '',
    cargoType: '',
    origin: '',
    destination: '',
    estimatedCost: 0,
    status: 'QUOTATION',
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${id}`);
        const json = await res.json();
        if (json?.data) setForm(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      alert('Saved');
      router.push('/quotations');
    } catch {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Quotation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
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
            <Input
              id="origin"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="estimatedCost">Estimated Cost</Label>
            <Input
              id="estimatedCost"
              type="number"
              value={form.estimatedCost}
              onChange={(e) => setForm({ ...form, estimatedCost: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
