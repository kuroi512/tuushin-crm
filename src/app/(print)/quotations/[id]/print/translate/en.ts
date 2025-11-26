import type { PrintCopy } from './types';

export const enOption = { code: 'en', label: 'English' } as const;

export const enCopy: PrintCopy = {
  languageLabel: 'Language',
  printButton: 'Save as PDF',
  loading: 'Loading…',
  bannerText: 'THE FREIGHT RATE OFFER',
  meta: {
    customerName: 'Customer name',
    date: 'Date',
    validDate: 'Valid date',
    number: 'Number',
  },
  rateTable: {
    offerTitle: 'Offer',
    offerNumber: 'Offer number',
    route: 'Route',
    transportMode: 'Transport mode',
    transitTime: 'Estimated transit time',
    rate: 'Rate',
    grossWeight: 'Gross weight',
    dimensions: 'Dimensions (CBM)',
  },
  includesTitle: 'Included in price',
  excludesTitle: 'Not included in price',
  remarksTitle: 'Remarks',
  footerMessage:
    'If you have any questions or concerns, please contact us without hesitation. Thank you.',
};
