import type { PrintCopy } from './types';

export const mnOption = { code: 'mn', label: 'Монгол' } as const;

export const mnCopy: PrintCopy = {
  languageLabel: 'Хэл',
  printButton: 'PDF хадгалах',
  loading: 'Ачааллаж байна…',
  summary: (quantity, weight, cbm) =>
    `Тээвэрлэлтийн дэлгэрэнгүй: ${quantity} тавиур/багц · ${weight} кг · ${cbm} CBM`,
  pickupLabel: 'Ачилтын хаяг',
  deliveryLabel: 'Хүргэх хаяг',
  meta: {
    customerName: 'Харилцагчийн нэр',
    date: 'Огноо',
    validDate: 'Хүчинтэй огноо',
    number: 'Дугаар',
  },
  rateTable: {
    orderNumber: 'Захиалгын дугаар',
    quotationNumber: 'Үнийн саналын дугаар',
    transportMode: 'Тээврийн төрөл',
    route: 'Чиглэл',
    shipmentCondition: 'Тээвэрлэлтийн нөхцөл',
    transitTime: 'Транзит хугацаа',
    rate: 'Үнэ',
    grossWeight: 'Жин',
    dimensions: 'Хэмжээ (CBM)',
  },
  includesTitle: 'Үнэ багтсан',
  excludesTitle: 'Үнэ багтаагүй',
  remarksTitle: 'Тэмдэглэл',
  footerMessage: 'Асууж тодруулах зүйл байвал бидэнтэй эргэлзэлгүй холбогдоорой. Баярлалаа.',
};
