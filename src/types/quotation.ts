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
  specialNotes?: string;
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
  customerRates?: Array<{ name: string; currency: string; amount: number; isPrimary?: boolean }>;
  profit?: { currency: string; amount: number };
  closeReason?: string;
  offers?: QuotationOffer[];
}

export interface QuotationOffer {
  id: string;
  quotationId: string;
  title?: string | null;
  order: number;
  offerNumber?: string | null;

  // Transport & Route details (moved from main form)
  transportMode?: string | null;
  borderPort?: string | null;

  // Commercial terms (moved from main form)
  incoterm?: string | null;
  shipper?: string | null;
  terminal?: string | null;

  // Shipment details
  transitTime?: string | null;

  // Pricing
  rate?: number | null;
  rateCurrency?: string | null;

  // Physical details
  grossWeight?: number | null;
  dimensionsCbm?: number | null;

  // Dimensions (moved from main form, shown based on transport mode)
  dimensions?: Array<{
    length: number;
    width: number;
    height: number;
    quantity: number;
    cbm?: number;
  }> | null;

  // Rates (moved from main form)
  carrierRates?: Array<{ name: string; currency: string; amount: number }> | null;
  extraServices?: Array<{ name: string; currency: string; amount: number }> | null;
  customerRates?: Array<{
    name: string;
    currency: string;
    amount: number;
    isPrimary?: boolean;
  }> | null;

  // Profit calculation
  profit?: { currency: string; amount: number } | null;

  // Notes (moved from main form)
  notes?: string | null;
  include?: string | null;
  exclude?: string | null;
  remark?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export type RuleSnippetType = 'INCLUDE' | 'EXCLUDE' | 'REMARK';

export type RuleSnippetTranslations = Record<string, string>;

export interface QuotationRuleSnippet {
  id: string;
  label: string;
  type: RuleSnippetType;
  incoterm?: string | null;
  transportMode?: string | null;
  content: string;
  contentTranslations?: RuleSnippetTranslations | null;
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
  translations?: RuleSnippetTranslations | null;
}

export type QuotationRuleSelectionState = {
  include: QuotationRuleSelection[];
  exclude: QuotationRuleSelection[];
  remark: QuotationRuleSelection[];
};
