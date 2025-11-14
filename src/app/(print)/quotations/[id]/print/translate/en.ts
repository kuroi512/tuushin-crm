import type { PrintCopy } from './types';

export const enOption = { code: 'en', label: 'English' } as const;

export const enCopy: PrintCopy = {
  languageLabel: 'Language',
  printButton: 'Save as PDF',
  loading: 'Loading…',
  summary: (quantity, weight, cbm) =>
    `Shipment details: ${quantity} pallet/package · ${weight} KG · ${cbm} CBM`,
  pickupLabel: 'Pick up address',
  deliveryLabel: 'Delivery address',
  meta: {
    customerName: 'Customer name',
    date: 'Date',
    validDate: 'Valid date',
    number: 'Number',
  },
  rateTable: {
    offerTitle: 'Offer',
    offerNumber: 'Offer number',
    transportMode: 'Transport mode',
    borderPort: 'Border / Port',
    transitTime: 'Transit time',
    rate: 'Rate',
    grossWeight: 'Gross weight',
    dimensions: 'Dimensions (CBM)',
  },
  includesTitle: 'The price includes',
  excludesTitle: 'The price excludes',
  remarksTitle: 'Remarks',
  footerMessage:
    'If you have any questions or concerns, please contact us without hesitation. Thank you.',
};
