export interface Quotation {
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
  // Optional workflow status for dashboard summaries
  status?:
    | 'CANCELLED'
    | 'CREATED'
    | 'QUOTATION'
    | 'CONFIRMED'
    | 'ONGOING'
    | 'ARRIVED'
    | 'RELEASED'
    | 'CLOSED';
  // Extended optional fields to match filters/columns
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
  // Business fields for inquiry/quotation details
  consignee?: string;
  payer?: string;
  commodity?: string;
  terminal?: string;
  paymentType?: string; // e.g., Prepaid, Collect
  division?: 'import' | 'export' | 'transit';
  condition?: string; // contract/offer condition text
  tmode?: string; // transport mode, e.g., 20ft truck, container, car-carrier
  // use existing incoterm? field above
  dimensions?: Array<{
    length: number; // cm or mm depending on unit policy
    width: number;
    height: number;
    quantity: number;
    cbm?: number; // computed if not provided
  }>;
  destinationCountry?: string;
  destinationCity?: string;
  destinationAddress?: string;
  borderPort?: string; // e.g., Erlian/Erenhot
  salesManagerId?: string;

  // New comprehensive form fields
  originCountry?: string;
  originCity?: string;
  originAddress?: string;
  finalCountry?: string;
  finalCity?: string;
  finalAddress?: string;
  via?: string;
  included?: string;
  excluded?: string;
  additionalInfo?: string;
  tariffManager?: string;
  include?: string;
  exclude?: string;
  comment?: string;
  remark?: string;
  quotationDate?: string; // ISO date
  validityDate?: string; // ISO date
  operationNotes?: string;
  ruleSelections?: QuotationRuleSelectionState;

  // Milestone dates
  estDepartureDate?: string;
  actDepartureDate?: string;
  estArrivalDate?: string;
  actArrivalDate?: string;

  // Rates and profit
  carrierRates?: Array<{ name: string; currency: string; amount: number }>;
  extraServices?: Array<{ name: string; currency: string; amount: number }>;
  customerRates?: Array<{ name: string; currency: string; amount: number }>;
  profit?: { currency: string; amount: number };
}

export type RuleSnippetType = 'INCLUDE' | 'EXCLUDE' | 'REMARK';

export interface QuotationRuleSnippet {
  id: string;
  label: string;
  type: RuleSnippetType;
  incoterm?: string | null;
  transportMode?: string | null;
  content: string;
  isDefault: boolean;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuotationRuleSelection {
  snippetId: string | null;
  label: string;
  type: RuleSnippetType;
  content: string;
  source?: 'default' | 'custom' | 'manual';
  incoterm?: string | null;
  transportMode?: string | null;
}

export type QuotationRuleSelectionState = {
  include: QuotationRuleSelection[];
  exclude: QuotationRuleSelection[];
  remark: QuotationRuleSelection[];
};
