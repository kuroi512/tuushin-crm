'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n';

export function FiltersPanel() {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quotations.filters')}</CardTitle>
        <CardDescription>{t('quotations.filters.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="f-quotation-no">Quotation Number</Label>
            <Input id="f-quotation-no" placeholder="Search by number..." />
          </div>
          <div>
            <Label htmlFor="f-client">{t('filters.client')}</Label>
            <Input id="f-client" placeholder="Search client..." />
          </div>
          <div>
            <Label htmlFor="f-shipper">{t('filters.shipper')}</Label>
            <Input id="f-shipper" placeholder="Search shipper..." />
          </div>
          <div>
            <Label htmlFor="f-commodity">Commodity</Label>
            <Input id="f-commodity" placeholder="Search commodity..." />
          </div>
          <div>
            <Label htmlFor="f-incoterm">{t('filters.incoterm')}</Label>
            <Input id="f-incoterm" placeholder="e.g., FOB, CIF..." />
          </div>
          <div>
            <Label htmlFor="f-type">{t('filters.type')}</Label>
            <Input id="f-type" placeholder="Transport type..." />
          </div>
          <div>
            <Label htmlFor="f-from">{t('filters.from')}</Label>
            <Input id="f-from" placeholder="Origin city..." />
          </div>
          <div>
            <Label htmlFor="f-to">{t('filters.to')}</Label>
            <Input id="f-to" placeholder="Destination city..." />
          </div>
          <div>
            <Label htmlFor="f-country">{t('filters.country')}</Label>
            <Input id="f-country" placeholder="Country..." />
          </div>
          <div>
            <Label htmlFor="f-sales-manager">{t('filters.salesManager')}</Label>
            <Input id="f-sales-manager" placeholder="Sales manager..." />
          </div>
          <div>
            <Label htmlFor="f-date-from">Date From</Label>
            <Input id="f-date-from" type="date" />
          </div>
          <div>
            <Label htmlFor="f-date-to">Date To</Label>
            <Input id="f-date-to" type="date" />
          </div>
          <div>
            <Label htmlFor="f-cost-min">Min Cost ($)</Label>
            <Input id="f-cost-min" type="number" placeholder="0" />
          </div>
          <div>
            <Label htmlFor="f-cost-max">Max Cost ($)</Label>
            <Input id="f-cost-max" type="number" placeholder="999999" />
          </div>
          <div>
            <Label htmlFor="f-created-by">{t('filters.createdBy')}</Label>
            <Input id="f-created-by" placeholder="Created by..." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
