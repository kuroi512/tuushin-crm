import type { PrintCopy } from './types';

export const ruOption = { code: 'ru', label: 'Русский' } as const;

export const ruCopy: PrintCopy = {
  languageLabel: 'Язык',
  printButton: 'Сохранить в PDF',
  loading: 'Загрузка…',
  bannerText: 'ПРЕДЛОЖЕНИЕ ПО ТАРИФУ НА ПЕРЕВОЗКУ',
  meta: {
    customerName: 'Клиент',
    date: 'Дата',
    validDate: 'Срок действия',
    number: 'Номер',
  },
  rateTable: {
    offerTitle: 'Предложение',
    offerNumber: 'Номер предложения',
    route: 'Маршрут',
    transportMode: 'Вид транспорта',
    transitTime: 'Предполагаемое время доставки',
    rate: 'Тариф',
    grossWeight: 'Вес брутто',
    dimensions: 'Габариты (CBM)',
  },
  includesTitle: 'Включено в стоимость',
  excludesTitle: 'Не включено в стоимость',
  remarksTitle: 'Примечания',
  footerMessage: 'Если у вас возникли вопросы, пожалуйста, свяжитесь с нами. Спасибо.',
};
