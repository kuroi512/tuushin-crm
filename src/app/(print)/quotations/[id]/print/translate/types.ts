export type PrintLanguage = 'en' | 'mn' | 'ru';

export type PrintCopy = {
  languageLabel: string;
  printButton: string;
  loading: string;
  bannerText: string;
  meta: {
    customerName: string;
    date: string;
    validDate: string;
    number: string;
  };
  rateTable: {
    offerTitle: string;
    offerNumber: string;
    route: string;
    transportMode: string;
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
