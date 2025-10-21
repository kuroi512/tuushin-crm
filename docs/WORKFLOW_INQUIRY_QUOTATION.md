# Inquiry → Quotation Workflow (Draft)

This document outlines the initial data model and flow for creating inquiries and quotations in Tuushin CRM.

## Entities

- Inquiry
  - Core party info: consignee, shipper
  - Shipment info: commodity, terminal, division (import|export|transit), incoterm, tmode
  - Dimensions: list of { length, width, height, quantity, cbm }
  - Routing: destinationCountry, destinationCity, destinationAddress, borderPort
  - Commercial: paymentType, condition, include/exclude, comment, remark
  - Dates: quotationDate, validityDate
  - Rates: carrierRates[], extraServices[], customerRates[]; profit

- Quotation
  - Extends shipment and commercial details; adds workflow status
  - Milestone dates: estimated/actual departure/arrival

## Statuses (Quotation)

- CANCELLED, CREATED, QUOTATION, CONFIRMED, ONGOING, ARRIVED, RELEASED, CLOSED

## Basic Flow

1. Create Inquiry with essential details.
2. Optionally compute CBM from dimensions (sum length*width*height\*quantity with proper unit scale).
3. Add rate lines: carrierRates, extraServices, customerRates.
4. Derive profit = sum(customerRates) - sum(carrierRates) - sum(extraServices).
5. Convert Inquiry to Quotation (future step) or directly create Quotation.
6. Track milestones (estimated vs. actual dates) on the Quotation.

## Next Steps

- Add Inquiry list/detail pages.
- Add Quotation create/edit pages with validation and i18n labels.
- Persist to DB (Prisma) when ready; replace in-memory mocks.
- Add server-side CBM and profit calculators.
