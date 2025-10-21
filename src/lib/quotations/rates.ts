export type RateItem = {
  name: string;
  currency: string;
  amount: number;
  isPrimary?: boolean;
};

const DEFAULT_CURRENCY = 'USD';
const LOCKED_RATE_STATUSES = new Set(['CONFIRMED', 'ONGOING', 'ARRIVED', 'RELEASED', 'CLOSED']);

export const ensureSinglePrimaryRate = (rates: RateItem[]): RateItem[] => {
  if (!rates.length) return [];
  const primaryIndex = rates.findIndex((rate) => rate.isPrimary);
  const targetIndex = primaryIndex >= 0 ? primaryIndex : 0;
  return rates.map((rate, idx) => ({
    ...rate,
    isPrimary: idx === targetIndex,
  }));
};

export const sumRateAmounts = (rates: RateItem[]): number =>
  rates.reduce((sum, rate) => {
    const value = typeof rate.amount === 'number' ? rate.amount : Number(rate.amount) || 0;
    return sum + value;
  }, 0);

export const computeProfitFromRates = (
  primary: RateItem | undefined | null,
  carrierRates: RateItem[],
  extraServices: RateItem[],
) => {
  const carrierTotal = sumRateAmounts(carrierRates);
  const extraTotal = sumRateAmounts(extraServices);
  if (!primary) {
    return { currency: DEFAULT_CURRENCY, amount: 0 };
  }
  const primaryValue =
    typeof primary.amount === 'number' ? primary.amount : Number(primary.amount) || 0;
  const amount = primaryValue - carrierTotal - extraTotal;
  return {
    currency:
      primary.currency ||
      carrierRates[0]?.currency ||
      extraServices[0]?.currency ||
      DEFAULT_CURRENCY,
    amount,
  };
};

export const sanitizeRateList = (input: unknown): RateItem[] => {
  if (!Array.isArray(input)) return [];
  return input.map((entry) => {
    const record =
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : undefined;
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    const currency =
      typeof record?.currency === 'string' && record.currency.trim()
        ? record.currency.trim()
        : DEFAULT_CURRENCY;
    const rawAmount = record?.amount;
    const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount) || 0;
    const isPrimary = Boolean(record?.isPrimary);
    return { name, currency, amount, isPrimary };
  });
};

export const sanitizeCustomerRates = (input: unknown) => {
  const rates = ensureSinglePrimaryRate(sanitizeRateList(input));
  const primary = rates.find((rate) => rate.isPrimary);
  return { rates, primary };
};

export const isRateEditLocked = (status?: string | null) =>
  typeof status === 'string' ? LOCKED_RATE_STATUSES.has(status) : false;

export const ratesEqual = (a: RateItem[], b: RateItem[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((rate, idx) => {
    const other = b[idx];
    if (!other) return false;
    return (
      rate.name === other.name &&
      rate.currency === other.currency &&
      Number(rate.amount) === Number(other.amount) &&
      Boolean(rate.isPrimary) === Boolean(other.isPrimary)
    );
  });
};
