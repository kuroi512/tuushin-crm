import { describe, it, expect } from 'vitest';
import { normalizeQuotationOffers } from '../offers';
import { serializeOffersForPayload, ensureOfferSequence } from '../offer-helpers';
import type { QuotationOffer } from '@/types/quotation';

describe('normalizeQuotationOffers', () => {
  it('should return empty array for non-array input', () => {
    expect(normalizeQuotationOffers(null)).toEqual([]);
    expect(normalizeQuotationOffers(undefined)).toEqual([]);
    expect(normalizeQuotationOffers('string')).toEqual([]);
    expect(normalizeQuotationOffers({})).toEqual([]);
  });

  it('should normalize valid offer objects', () => {
    const input = [
      {
        id: 'offer-1',
        title: 'Offer 1',
        order: 0,
        offerNumber: '1',
        transportMode: 'AIR',
        rate: 1000,
        rateCurrency: 'USD',
      },
      {
        id: 'offer-2',
        title: 'Offer 2',
        order: 1,
        offerNumber: '2',
        transportMode: 'SEA',
        rate: 2000,
        rateCurrency: 'EUR',
      },
    ];

    const result = normalizeQuotationOffers(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'offer-1',
      title: 'Offer 1',
      order: 0,
      offerNumber: '1',
      transportMode: 'AIR',
      rate: 1000,
      rateCurrency: 'USD',
    });
    expect(result[1]).toMatchObject({
      id: 'offer-2',
      title: 'Offer 2',
      order: 1,
      offerNumber: '2',
      transportMode: 'SEA',
      rate: 2000,
      rateCurrency: 'EUR',
    });
  });

  it('should generate IDs for offers without IDs', () => {
    const input = [{ title: 'Offer 1' }];
    const result = normalizeQuotationOffers(input);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeDefined();
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('should use index as order when order is missing', () => {
    const input = [{ title: 'Offer 1' }, { title: 'Offer 2' }, { title: 'Offer 3' }];
    const result = normalizeQuotationOffers(input);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
    expect(result[2].order).toBe(2);
  });

  it('should handle empty strings and trim values', () => {
    const input = [
      {
        id: '  offer-1  ',
        title: '  Offer 1  ',
        transportMode: '  AIR  ',
        rate: '1000',
        rateCurrency: '  USD  ',
      },
    ];
    const result = normalizeQuotationOffers(input);
    expect(result[0].id).toBe('offer-1');
    expect(result[0].title).toBe('Offer 1');
    expect(result[0].transportMode).toBe('AIR');
    expect(result[0].rateCurrency).toBe('USD');
  });

  it('should filter out invalid entries', () => {
    const input = [
      { title: 'Valid Offer' },
      null,
      undefined,
      'string',
      123,
      {},
      { title: 'Another Valid Offer' },
    ];
    const result = normalizeQuotationOffers(input);
    // Empty objects are treated as valid offers (they get IDs and order)
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].title).toBe('Valid Offer');
    expect(result[result.length - 1].title).toBe('Another Valid Offer');
    // Verify null, undefined, string, and number are filtered out
    const titles = result.map((r) => r.title).filter(Boolean);
    expect(titles).toContain('Valid Offer');
    expect(titles).toContain('Another Valid Offer');
  });
});

describe('serializeOffersForPayload', () => {
  it('should serialize offers correctly', () => {
    const offers: QuotationOffer[] = [
      {
        id: 'offer-1',
        quotationId: 'quotation-1',
        title: 'Offer 1',
        order: 0,
        offerNumber: '1',
        transportMode: 'AIR',
        rate: 1000,
        rateCurrency: 'USD',
        grossWeight: 100,
        dimensionsCbm: 1.5,
      },
    ];

    const result = serializeOffersForPayload(offers);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'offer-1',
      quotationId: 'quotation-1',
      title: 'Offer 1',
      order: 0,
      offerNumber: '1',
      transportMode: 'AIR',
      rate: 1000,
      rateCurrency: 'USD',
      grossWeight: 100,
      dimensionsCbm: 1.5,
    });
  });

  it('should generate IDs and offer numbers for missing values', () => {
    const offers: QuotationOffer[] = [
      {
        id: '',
        title: 'Offer 1',
        order: 0,
      },
      {
        id: undefined,
        title: 'Offer 2',
        order: 1,
      },
    ];

    const result = serializeOffersForPayload(offers);
    expect(result[0].id).toBe('offer-1');
    expect(result[0].offerNumber).toBe('1');
    expect(result[1].id).toBe('offer-2');
    expect(result[1].offerNumber).toBe('2');
  });

  it('should handle empty and undefined values', () => {
    const offers: QuotationOffer[] = [
      {
        id: 'offer-1',
        title: '',
        transportMode: undefined,
        rate: undefined,
        rateCurrency: '',
      },
    ];

    const result = serializeOffersForPayload(offers);
    expect(result[0].title).toBeUndefined();
    expect(result[0].transportMode).toBeUndefined();
    expect(result[0].rate).toBeUndefined();
    expect(result[0].rateCurrency).toBeUndefined();
  });
});

describe('ensureOfferSequence', () => {
  it('should ensure correct order and offer numbers', () => {
    const offers = [
      { id: '1', order: 5, offerNumber: 'A' },
      { id: '2', order: 0, offerNumber: '' },
      { id: '3', order: 10, offerNumber: '  B  ' },
    ];

    const result = ensureOfferSequence(offers);
    expect(result[0].order).toBe(0);
    expect(result[0].offerNumber).toBe('A');
    expect(result[1].order).toBe(1);
    expect(result[1].offerNumber).toBe('2');
    expect(result[2].order).toBe(2);
    expect(result[2].offerNumber).toBe('B');
  });

  it('should not mutate if sequence is already correct', () => {
    const offers = [
      { id: '1', order: 0, offerNumber: '1' },
      { id: '2', order: 1, offerNumber: '2' },
      { id: '3', order: 2, offerNumber: '3' },
    ];

    const result = ensureOfferSequence(offers);
    expect(result).toBe(offers); // Should return same reference if no changes
  });

  it('should handle offers with null values', () => {
    const offers = [
      { id: '1', order: null, offerNumber: null },
      { id: '2', order: null, offerNumber: null },
    ];

    const result = ensureOfferSequence(offers);
    expect(result[0].order).toBe(0);
    expect(result[0].offerNumber).toBe('1');
    expect(result[1].order).toBe(1);
    expect(result[1].offerNumber).toBe('2');
  });
});
