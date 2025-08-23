import { NextResponse } from 'next/server';
import { z } from 'zod';

// In-memory storage for MVP/dev (replace with Prisma once DATABASE_URL is set)
type Quotation = {
  id: string;
  quotationNumber: string;
  client: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight?: number;
  volume?: number;
  estimatedCost: number;
  createdAt: string;
  createdBy: string;
  // Extended optional fields
  registrationNo?: string;
  containerOrWagon?: string;
  incoterm?: string;
  type?: string;
  ownership?: string;
  releaseOrder?: string;
  shipper?: string;
  country?: string;
  cr?: string;
  crDays?: number;
  carrier?: string;
  agent1?: string;
  agent2?: string;
  agent3?: string;
  responsibleSpecialist?: string;
  loadedDate?: string;
  transitWh?: string;
  arrivedAtTransitWhDate?: string;
  loadedFromTransitWhDate?: string;
  arrivedAtBorderDate?: string;
  departedBorderDate?: string;
  arrivedInUBDate?: string;
  unloadingYard?: string;
  devannedDate?: string;
  emptyReturnedDate?: string;
  wagonNoEmptyReturn?: string;
  returnArrivedAtBorderDate?: string;
  returnDepartedBorderDate?: string;
  exportedDate?: string;
  transferredToOthersDate?: string;
  transferNote?: string;
  transferredTo?: string;
  salesManager?: string;
  goods?: string;
  salesDate?: string;
  freightCharge?: number;
  paidDate?: string;
  paymentStatus?: string;
  amountPaid?: number;
  status?: 'CANCELLED' | 'CREATED' | 'QUOTATION' | 'CONFIRMED' | 'ONGOING' | 'ARRIVED' | 'RELEASED' | 'CLOSED';
};

const quotationCreateLiteSchema = z.object({
  client: z.string().min(1, 'Client is required'),
  cargoType: z.string().min(1, 'Cargo type is required'),
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
});

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
const mockQuotations: Quotation[] = Array.from({ length: 50 }).map((_, i) => {
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
    containerOrWagon: Math.random() > 0.5 ? `CONT-${randomInt(100000, 999999)}` : `WGN-${randomInt(10000, 99999)}`,
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
  status: rand(['CANCELLED','CREATED','QUOTATION','CONFIRMED','ONGOING','ARRIVED','RELEASED','CLOSED'])
  };
  return q;
});
// Continue sequence for POSTs
mockIdCounter = mockQuotations.length + 1;

function generateQuotationNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(mockIdCounter).padStart(3, '0');
  return `QUO-${year}-${seq}`;
}

export async function GET(_request: Request) {
  return NextResponse.json({ success: true, data: mockQuotations });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = quotationCreateLiteSchema.safeParse({
      client: body.client,
      cargoType: body.cargoType,
      origin: body.origin,
      destination: body.destination,
      weight: body.weight ? Number(body.weight) : undefined,
      volume: body.volume ? Number(body.volume) : undefined,
      estimatedCost: Number(body.estimatedCost),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const now = new Date();
    const newQuotation: Quotation = {
      id: String(mockIdCounter++),
      quotationNumber: generateQuotationNumber(),
      client: parsed.data.client,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoType: parsed.data.cargoType,
      weight: parsed.data.weight,
      volume: parsed.data.volume,
      estimatedCost: parsed.data.estimatedCost,
      createdAt: now.toISOString().slice(0, 10),
      createdBy: 'admin@freight.mn',
  status: 'CREATED',
    };

    mockQuotations.unshift(newQuotation);

    return NextResponse.json({ success: true, message: 'Quotation created', data: newQuotation });
  } catch (error) {
    console.error('Quotation create error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
