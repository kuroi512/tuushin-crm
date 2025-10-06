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
            <Label htmlFor="f-quotation-no">{t('filters.quotationNumber')}</Label>
            <Input id="f-quotation-no" placeholder={t('filters.quotationNumber.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-client">{t('filters.client')}</Label>
            <Input id="f-client" placeholder={t('filters.client.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-shipper">{t('filters.shipper')}</Label>
            <Input id="f-shipper" placeholder={t('filters.shipper.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-commodity">{t('filters.commodity')}</Label>
            <Input id="f-commodity" placeholder={t('filters.commodity.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-incoterm">{t('filters.incoterm')}</Label>
            <Input id="f-incoterm" placeholder={t('filters.incoterm.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-type">{t('filters.type')}</Label>
            <Input id="f-type" placeholder={t('filters.type.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-from">{t('filters.from')}</Label>
            <Input id="f-from" placeholder={t('filters.from.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-to">{t('filters.to')}</Label>
            <Input id="f-to" placeholder={t('filters.to.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-country">{t('filters.country')}</Label>
            <Input id="f-country" placeholder={t('filters.country.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-sales-manager">{t('filters.salesManager')}</Label>
            <Input id="f-sales-manager" placeholder={t('filters.salesManager.placeholder')} />
          </div>
          <div>
            <Label htmlFor="f-date-from">{t('filters.dateFrom')}</Label>
            <Input id="f-date-from" type="date" />
          </div>
          <div>
            <Label htmlFor="f-date-to">{t('filters.dateTo')}</Label>
            <Input id="f-date-to" type="date" />
          </div>
          <div>
            <Label htmlFor="f-cost-min">{t('filters.minCost')}</Label>
            <Input id="f-cost-min" type="number" placeholder="0" />
          </div>
          <div>
            <Label htmlFor="f-cost-max">{t('filters.maxCost')}</Label>
            <Input id="f-cost-max" type="number" placeholder="999999" />
          </div>
          <div>
            <Label htmlFor="f-created-by">{t('filters.createdBy')}</Label>
            <Input id="f-created-by" placeholder={t('filters.createdBy.placeholder')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
