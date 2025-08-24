import type { Quotation } from '@/types/quotation';

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const clients = [
  'Erdenet Mining Corporation',
  'Oyu Tolgoi LLC',
  'MAK LLC',
  'Tavan Tolgoi JSC',
  'Gobi Steel LLC',
  'Moncement',
  'MCS Coca-Cola',
  'APU JSC',
  'Gerege Systems',
  'Unitel',
];

const origins = [
  'Ulaanbaatar, Mongolia',
  'Darkhan, Mongolia',
  'Erdenet, Mongolia',
  'Zamyn-Uud Border',
  'Tsogttsetsii, Mongolia',
  'South Gobi, Mongolia',
];

const destinations = [
  'Tianjin Port, China',
  'Shanghai Port, China',
  'Erenhot, China',
  'Beijing, China',
  'Qingdao, China',
  'Busan, Korea',
];

const cargoTypes = [
  'Copper Concentrate',
  'Gold Concentrate',
  'Coal',
  'Steel Products',
  'Steel Rebar',
  'Consumer Goods',
  'Machinery',
  'Chemicals',
];

const incoterms = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'];
const ownerships = ['Client', 'Carrier', 'Leased'];
const carriers = ['China Rail', 'MCC', 'Tuushin Logistics', 'UPS', 'DHL'];
const agents = ['Agent Alpha', 'Agent Beta', 'Agent Gamma', 'Agent Delta'];
const countries = ['Mongolia', 'China', 'Korea', 'Russia'];
const specialists = ['Batsaikhan', 'Tuvshin', 'Naran', 'Bilguun'];
const salesManagers: string[] = ['Erkhem', 'Munkhuu', 'Urangoo', 'Tengis'];
const goodsList = ['Coal', 'Copper', 'Steel', 'Electronics', 'Food'];

let mockIdCounter = 1;
export const mockQuotations: Quotation[] = Array.from({ length: 50 }).map((_, i) => {
  const id = String(mockIdCounter++);
  const baseDate = new Date('2025-01-01');
  const dayOffset = i;
  const created = addDays(baseDate, dayOffset);
  const weight = randomInt(5000, 32000);
  const volume = Number((weight / 550).toFixed(1));
  const estimatedCost = randomInt(3000, 22000);
  const origin = rand(origins);
  const destination = rand(destinations);

  const q: Quotation = {
    id,
    quotationNumber: `QUO-2025-${String(i + 1).padStart(3, '0')}`,
    client: rand(clients),
    origin,
    destination,
    cargoType: rand(cargoTypes),
    weight,
    volume,
    estimatedCost,
    createdAt: created,
    createdBy: 'admin@freight.mn',
    // Extended sample fields
    registrationNo: `REG-${String(i + 1).padStart(4, '0')}`,
    containerOrWagon:
      Math.random() > 0.5 ? `CONT-${randomInt(100000, 999999)}` : `WGN-${randomInt(10000, 99999)}`,
    incoterm: rand(incoterms),
    type: Math.random() > 0.5 ? 'Import' : 'Export',
    ownership: rand(ownerships),
    releaseOrder: Math.random() > 0.3 ? `RO-${randomInt(1000, 9999)}` : undefined,
    shipper: Math.random() > 0.4 ? `${rand(clients)} Shipping` : undefined,
    country: rand(countries),
    cr: Math.random() > 0.6 ? `CR-${randomInt(10, 99)}` : undefined,
    crDays: Math.random() > 0.6 ? randomInt(1, 15) : undefined,
    carrier: rand(carriers),
    agent1: rand(agents),
    agent2: Math.random() > 0.5 ? rand(agents) : undefined,
    agent3: Math.random() > 0.7 ? rand(agents) : undefined,
    responsibleSpecialist: rand(specialists),
    loadedDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset - 3) : undefined,
    transitWh: Math.random() > 0.6 ? 'Zamyn-Uud WH' : undefined,
    arrivedAtTransitWhDate: Math.random() > 0.6 ? addDays(baseDate, dayOffset - 2) : undefined,
    loadedFromTransitWhDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset - 1) : undefined,
    arrivedAtBorderDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset) : undefined,
    departedBorderDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset + 1) : undefined,
    arrivedInUBDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset + 2) : undefined,
    unloadingYard: Math.random() > 0.5 ? 'UB Yard A' : undefined,
    devannedDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset + 3) : undefined,
    emptyReturnedDate: Math.random() > 0.6 ? addDays(baseDate, dayOffset + 5) : undefined,
    wagonNoEmptyReturn: Math.random() > 0.6 ? `WGN-${randomInt(10000, 99999)}` : undefined,
    returnArrivedAtBorderDate: Math.random() > 0.8 ? addDays(baseDate, dayOffset + 6) : undefined,
    returnDepartedBorderDate: Math.random() > 0.8 ? addDays(baseDate, dayOffset + 7) : undefined,
    exportedDate: Math.random() > 0.6 ? addDays(baseDate, dayOffset + 8) : undefined,
    transferredToOthersDate: Math.random() > 0.7 ? addDays(baseDate, dayOffset + 9) : undefined,
    transferNote: Math.random() > 0.7 ? 'Transferred due to capacity' : undefined,
    transferredTo: Math.random() > 0.7 ? 'Partner Co.' : undefined,
    salesManager: rand(salesManagers),
    goods: rand(goodsList),
    salesDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset) : undefined,
    freightCharge: Math.random() > 0.5 ? estimatedCost : undefined,
    paidDate: Math.random() > 0.5 ? addDays(baseDate, dayOffset + 10) : undefined,
    paymentStatus: Math.random() > 0.5 ? 'Paid' : 'Unpaid',
    amountPaid: Math.random() > 0.5 ? randomInt(1000, estimatedCost) : undefined,
    status: rand([
      'CANCELLED',
      'CREATED',
      'QUOTATION',
      'CONFIRMED',
      'ONGOING',
      'ARRIVED',
      'RELEASED',
      'CLOSED',
    ]),
  };
  return q;
});

// Continue sequence for POSTs
mockIdCounter = mockQuotations.length + 1;

function generateQuotationNumberInternal(): string {
  const year = new Date().getFullYear();
  const seq = String(mockIdCounter).padStart(3, '0');
  return `QUO-${year}-${seq}`;
}

export function allocateIdAndNumber(): { id: string; quotationNumber: string } {
  const id = String(mockIdCounter);
  mockIdCounter += 1;
  const quotationNumber = generateQuotationNumberInternal();
  return { id, quotationNumber };
}
