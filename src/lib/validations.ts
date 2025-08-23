import { z } from 'zod';

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

export const customerCreateSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  countryId: z.string().optional(),
  cityId: z.string().optional(),
  customerType: z.enum(['INDIVIDUAL', 'COMPANY']),
  languagePreference: z.enum(['EN', 'MN', 'RU']),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  customer_type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(15),
});

// ============================================================================
// QUOTATION SCHEMAS
// ============================================================================

export const quotationCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  cargoType: z.enum([
    'LCL',
    'FTL',
    'FCL',
    'AIR',
    'TRUCK',
    'RORO',
    'TANK',
    'TRAIN',
    'OPEN_TOP',
    'BULK',
    'REEFER',
  ]),
  cargoDescription: z.string().optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(['KG', 'TONS']).default('KG'),
  volume: z.number().positive().optional(),
  volumeUnit: z.enum(['M3', 'FT3']).default('M3'),
  packageCount: z.number().positive().optional(),
  packageType: z.string().optional(),
  originPortId: z.string().optional(),
  destinationPortId: z.string().optional(),
  pickupAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  incoterm: z.string().optional(),
  currencyId: z.string().min(1, 'Currency is required'),
  totalAmount: z.number().positive('Amount must be positive'),
  language: z.enum(['EN', 'MN', 'RU']).default('EN'),
  validUntil: z.string().optional(),
});

export const quotationUpdateSchema = quotationCreateSchema.partial();

export const quotationQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED']).optional(),
  cargo_type: z
    .enum([
      'LCL',
      'FTL',
      'FCL',
      'AIR',
      'TRUCK',
      'RORO',
      'TANK',
      'TRAIN',
      'OPEN_TOP',
      'BULK',
      'REEFER',
    ])
    .optional(),
  customer_id: z.string().optional(),
  assigned_to: z.string().optional(),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(15),
});

// ============================================================================
// COMMUNICATION SCHEMAS
// ============================================================================

export const communicationCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  communicationType: z.enum(['EMAIL', 'PHONE', 'MEETING', 'CHAT', 'NOTE']),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ============================================================================
// SHIPMENT SCHEMAS
// ============================================================================

export const shipmentCreateSchema = z.object({
  quotationId: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  assignedTo: z.string().optional(),
  currentLocation: z.string().optional(),
  estimatedDeparture: z.string().optional(),
  estimatedArrival: z.string().optional(),
  blNumber: z.string().optional(),
  containerNumbers: z.array(z.string()).optional(),
  vesselVoyage: z.string().optional(),
});

export const shipmentUpdateSchema = shipmentCreateSchema.partial();

export const shipmentQuerySchema = z.object({
  search: z.string().optional(),
  status: z
    .enum([
      'CREATED',
      'QUOTATION',
      'CONFIRMED',
      'ONGOING',
      'ARRIVED',
      'RELEASED',
      'CLOSED',
      'CANCELLED',
    ])
    .optional(),
  customer_id: z.string().optional(),
  assigned_to: z.string().optional(),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(15),
});

export const trackingEventSchema = z.object({
  shipmentId: z.string().min(1, 'Shipment ID is required'),
  status: z.enum([
    'CREATED',
    'QUOTATION',
    'CONFIRMED',
    'ONGOING',
    'ARRIVED',
    'RELEASED',
    'CLOSED',
    'CANCELLED',
  ]),
  location: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  eventTimestamp: z.string(),
  isMilestone: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']).default('USER'),
});

export const userUpdateSchema = userCreateSchema.partial();

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(15),
});

export const idSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
