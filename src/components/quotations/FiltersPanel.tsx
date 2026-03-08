'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export type QuotationFilters = {
  quotationNumber: string;
  client: string;
  shipper: string;
  commodity: string;
  incoterm: string;
  type: string;
  from: string;
  to: string;
  country: string;
  salesManager: string;
  dateFrom: string;
  dateTo: string;
  minCost: string;
  maxCost: string;
  createdBy: string;
};

type FiltersPanelProps = {
  values: QuotationFilters;
  onChange: (patch: Partial<QuotationFilters>) => void;
  onReset: () => void;
};

export function FiltersPanel({ values, onChange, onReset }: FiltersPanelProps) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('quotations.filters')}</CardTitle>
          <Button variant="outline" size="sm" onClick={onReset}>
            {t('common.reset')}
          </Button>
        </div>
        <CardDescription>{t('quotations.filters.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="f-quotation-no">{t('filters.quotationNumber')}</Label>
            <Input
              id="f-quotation-no"
              value={values.quotationNumber}
              onChange={(e) => onChange({ quotationNumber: e.target.value })}
              placeholder={t('filters.quotationNumber.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-client">{t('filters.client')}</Label>
            <Input
              id="f-client"
              value={values.client}
              onChange={(e) => onChange({ client: e.target.value })}
              placeholder={t('filters.client.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-shipper">{t('filters.shipper')}</Label>
            <Input
              id="f-shipper"
              value={values.shipper}
              onChange={(e) => onChange({ shipper: e.target.value })}
              placeholder={t('filters.shipper.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-commodity">{t('filters.commodity')}</Label>
            <Input
              id="f-commodity"
              value={values.commodity}
              onChange={(e) => onChange({ commodity: e.target.value })}
              placeholder={t('filters.commodity.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-incoterm">{t('filters.incoterm')}</Label>
            <Input
              id="f-incoterm"
              value={values.incoterm}
              onChange={(e) => onChange({ incoterm: e.target.value })}
              placeholder={t('filters.incoterm.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-type">{t('filters.type')}</Label>
            <Input
              id="f-type"
              value={values.type}
              onChange={(e) => onChange({ type: e.target.value })}
              placeholder={t('filters.type.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-from">{t('filters.from')}</Label>
            <Input
              id="f-from"
              value={values.from}
              onChange={(e) => onChange({ from: e.target.value })}
              placeholder={t('filters.from.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-to">{t('filters.to')}</Label>
            <Input
              id="f-to"
              value={values.to}
              onChange={(e) => onChange({ to: e.target.value })}
              placeholder={t('filters.to.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-country">{t('filters.country')}</Label>
            <Input
              id="f-country"
              value={values.country}
              onChange={(e) => onChange({ country: e.target.value })}
              placeholder={t('filters.country.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-sales-manager">{t('filters.salesManager')}</Label>
            <Input
              id="f-sales-manager"
              value={values.salesManager}
              onChange={(e) => onChange({ salesManager: e.target.value })}
              placeholder={t('filters.salesManager.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-date-from">{t('filters.dateFrom')}</Label>
            <DatePicker
              id="f-date-from"
              value={values.dateFrom}
              onChange={(value) => onChange({ dateFrom: value })}
              placeholder={t('filters.dateFrom.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-date-to">{t('filters.dateTo')}</Label>
            <DatePicker
              id="f-date-to"
              value={values.dateTo}
              onChange={(value) => onChange({ dateTo: value })}
              placeholder={t('filters.dateTo.placeholder')}
              minDate={values.dateFrom || undefined}
            />
          </div>
          <div>
            <Label htmlFor="f-cost-min">{t('filters.minCost')}</Label>
            <Input
              id="f-cost-min"
              type="number"
              value={values.minCost}
              onChange={(e) => onChange({ minCost: e.target.value })}
              placeholder={t('filters.minCost.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-cost-max">{t('filters.maxCost')}</Label>
            <Input
              id="f-cost-max"
              type="number"
              value={values.maxCost}
              onChange={(e) => onChange({ maxCost: e.target.value })}
              placeholder={t('filters.maxCost.placeholder')}
            />
          </div>
          <div>
            <Label htmlFor="f-created-by">{t('filters.createdBy')}</Label>
            <Input
              id="f-created-by"
              value={values.createdBy}
              onChange={(e) => onChange({ createdBy: e.target.value })}
              placeholder={t('filters.createdBy.placeholder')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
