import type { PrintCopy } from './types';

export const ruOption = { code: 'ru', label: 'Русский' } as const;

export const ruCopy: PrintCopy = {
  languageLabel: 'Язык',
  printButton: 'Сохранить в PDF',
  loading: 'Загрузка…',
  summary: (quantity, weight, cbm) =>
    `Информация о перевозке: ${quantity} паллет/мест · ${weight} кг · ${cbm} CBM`,
  pickupLabel: 'Адрес погрузки',
  deliveryLabel: 'Адрес доставки',
  meta: {
    customerName: 'Клиент',
    date: 'Дата',
    validDate: 'Срок действия',
    number: 'Номер',
  },
  rateTable: {
    offerTitle: 'Предложение',
    offerNumber: 'Номер предложения',
    transportMode: 'Вид транспорта',
    route: 'Маршрут',
    shipmentCondition: 'Условия поставки',
    transitTime: 'Срок в пути',
    rate: 'Тариф',
    grossWeight: 'Вес брутто',
    dimensions: 'Габариты (CBM)',
  },
  includesTitle: 'В стоимость входит',
  excludesTitle: 'В стоимость не входит',
  remarksTitle: 'Примечания',
  footerMessage: 'Если у вас возникли вопросы, пожалуйста, свяжитесь с нами. Спасибо.',
};
