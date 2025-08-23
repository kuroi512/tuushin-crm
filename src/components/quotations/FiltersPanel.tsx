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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="f-registration">{t('filters.registrationNo')}</Label>
            <Input id="f-registration" />
          </div>
          <div>
            <Label htmlFor="f-container">{t('filters.containerOrWagon')}</Label>
            <Input id="f-container" />
          </div>
          <div>
            <Label htmlFor="f-incoterm">{t('filters.incoterm')}</Label>
            <Input id="f-incoterm" />
          </div>
          <div>
            <Label htmlFor="f-type">{t('filters.type')}</Label>
            <Input id="f-type" />
          </div>
          <div>
            <Label htmlFor="f-ownership">{t('filters.ownership')}</Label>
            <Input id="f-ownership" />
          </div>
          <div>
            <Label htmlFor="f-release">{t('filters.releaseOrder')}</Label>
            <Input id="f-release" />
          </div>
          <div>
            <Label htmlFor="f-shipper">{t('filters.shipper')}</Label>
            <Input id="f-shipper" />
          </div>
          <div>
            <Label htmlFor="f-country">{t('filters.country')}</Label>
            <Input id="f-country" />
          </div>
          <div>
            <Label htmlFor="f-client">{t('filters.client')}</Label>
            <Input id="f-client" />
          </div>
          <div>
            <Label htmlFor="f-cr">{t('filters.cr')}</Label>
            <Input id="f-cr" />
          </div>
          <div>
            <Label htmlFor="f-crdays">{t('filters.crDays')}</Label>
            <Input id="f-crdays" />
          </div>
          <div>
            <Label htmlFor="f-carrier">{t('filters.carrier')}</Label>
            <Input id="f-carrier" />
          </div>
          <div>
            <Label htmlFor="f-from">{t('filters.from')}</Label>
            <Input id="f-from" />
          </div>
          <div>
            <Label htmlFor="f-to">{t('filters.to')}</Label>
            <Input id="f-to" />
          </div>
          <div>
            <Label htmlFor="f-agent1">{t('filters.agent1')}</Label>
            <Input id="f-agent1" />
          </div>
          <div>
            <Label htmlFor="f-agent2">{t('filters.agent2')}</Label>
            <Input id="f-agent2" />
          </div>
          <div>
            <Label htmlFor="f-agent3">{t('filters.agent3')}</Label>
            <Input id="f-agent3" />
          </div>
          <div>
            <Label htmlFor="f-resp">{t('filters.responsibleSpecialist')}</Label>
            <Input id="f-resp" />
          </div>
          <div>
            <Label htmlFor="f-loaded">{t('filters.loadedDate')}</Label>
            <Input id="f-loaded" type="date" />
          </div>
          <div>
            <Label htmlFor="f-transit">{t('filters.transitWH')}</Label>
            <Input id="f-transit" />
          </div>
          <div>
            <Label htmlFor="f-arr-transit">{t('filters.arrivedAtTransitWHDate')}</Label>
            <Input id="f-arr-transit" type="date" />
          </div>
          <div>
            <Label htmlFor="f-load-transit">{t('filters.loadedFromTransitWHDate')}</Label>
            <Input id="f-load-transit" type="date" />
          </div>
          <div>
            <Label htmlFor="f-arr-border">{t('filters.arrivedAtBorderDate')}</Label>
            <Input id="f-arr-border" type="date" />
          </div>
          <div>
            <Label htmlFor="f-dep-border">{t('filters.departedBorderDate')}</Label>
            <Input id="f-dep-border" type="date" />
          </div>
          <div>
            <Label htmlFor="f-arr-ub">{t('filters.arrivedInUBDate')}</Label>
            <Input id="f-arr-ub" type="date" />
          </div>
          <div>
            <Label htmlFor="f-yard">{t('filters.unloadingYard')}</Label>
            <Input id="f-yard" />
          </div>
          <div>
            <Label htmlFor="f-devanned">{t('filters.devannedDate')}</Label>
            <Input id="f-devanned" type="date" />
          </div>
          <div>
            <Label htmlFor="f-empty-return">{t('filters.emptyReturnedDate')}</Label>
            <Input id="f-empty-return" type="date" />
          </div>
          <div>
            <Label htmlFor="f-wagon">{t('filters.wagonNoEmptyReturn')}</Label>
            <Input id="f-wagon" />
          </div>
          <div>
            <Label htmlFor="f-ret-arr-border">{t('filters.returnArrivedAtBorderDate')}</Label>
            <Input id="f-ret-arr-border" type="date" />
          </div>
          <div>
            <Label htmlFor="f-ret-dep-border">{t('filters.returnDepartedBorderDate')}</Label>
            <Input id="f-ret-dep-border" type="date" />
          </div>
          <div>
            <Label htmlFor="f-exported">{t('filters.exportedDate')}</Label>
            <Input id="f-exported" type="date" />
          </div>
          <div>
            <Label htmlFor="f-transferred-date">{t('filters.transferredToOthersDate')}</Label>
            <Input id="f-transferred-date" type="date" />
          </div>
          <div>
            <Label htmlFor="f-transfer-note">{t('filters.transferNote')}</Label>
            <Input id="f-transfer-note" />
          </div>
          <div>
            <Label htmlFor="f-transferred-to">{t('filters.transferredTo')}</Label>
            <Input id="f-transferred-to" />
          </div>
          <div>
            <Label htmlFor="f-sales-manager">{t('filters.salesManager')}</Label>
            <Input id="f-sales-manager" />
          </div>
          <div>
            <Label htmlFor="f-goods">{t('filters.goods')}</Label>
            <Input id="f-goods" />
          </div>
          <div>
            <Label htmlFor="f-sales-date">{t('filters.salesDate')}</Label>
            <Input id="f-sales-date" type="date" />
          </div>
          <div>
            <Label htmlFor="f-freight-charge">{t('filters.freightCharge')}</Label>
            <Input id="f-freight-charge" />
          </div>
          <div>
            <Label htmlFor="f-paid-date">{t('filters.paidDate')}</Label>
            <Input id="f-paid-date" type="date" />
          </div>
          <div>
            <Label htmlFor="f-payment-status">{t('filters.paymentStatus')}</Label>
            <Input id="f-payment-status" />
          </div>
          <div>
            <Label htmlFor="f-amount-paid">{t('filters.amountPaid')}</Label>
            <Input id="f-amount-paid" />
          </div>
          <div>
            <Label htmlFor="f-created-by">{t('filters.createdBy')}</Label>
            <Input id="f-created-by" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
