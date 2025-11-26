import type { PrintCopy } from './types';

export const mnOption = { code: 'mn', label: 'Монгол' } as const;

export const mnCopy: PrintCopy = {
  languageLabel: 'Хэл',
  printButton: 'PDF хадгалах',
  loading: 'Ачааллаж байна…',
  bannerText: 'ТЭЭВРИЙН ҮНИЙН САНАЛ',
  meta: {
    customerName: 'Харилцагчийн нэр',
    date: 'Огноо',
    validDate: 'Хүчинтэй огноо',
    number: 'Дугаар',
  },
  rateTable: {
    offerTitle: 'Санал',
    offerNumber: 'Саналын дугаар',
    route: 'Замнал',
    transportMode: 'Тээврийн төрөл',
    transitTime: 'Урьдчилсан тээврийн хугацаа',
    rate: 'Үнэ',
    grossWeight: 'Жин',
    dimensions: 'Хэмжээ (CBM)',
  },
  includesTitle: 'Үнийн дүнд багтсан зардлууд',
  excludesTitle: 'Үнийн дүнд багтаагүй зардлууд',
  remarksTitle: 'Тэмдэглэл',
  footerMessage: 'Асууж тодруулах зүйл байвал бидэнтэй эргэлзэлгүй холбогдоорой. Баярлалаа.',
};
