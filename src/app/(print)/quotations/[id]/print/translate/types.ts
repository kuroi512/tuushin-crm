export type PrintLanguage = 'en' | 'mn' | 'ru';

export type PrintCopy = {
  languageLabel: string;
  printButton: string;
  loading: string;
  summary: (quantity: number, weight: number, cbm: number) => string;
  pickupLabel: string;
  deliveryLabel: string;
  meta: {
    customerName: string;
    date: string;
    validDate: string;
    number: string;
  };
  rateTable: {
    orderNumber: string;
    quotationNumber: string;
    transportMode: string;
    route: string;
    shipmentCondition: string;
    transitTime: string;
    rate: string;
    grossWeight: string;
    dimensions: string;
  };
  includesTitle: string;
  excludesTitle: string;
  remarksTitle: string;
  footerMessage: string;
};
