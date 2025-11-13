import { z } from 'zod';

const monthSchema = z
  .string()
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Month must follow YYYY-MM format');

export function formatMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parseMonthInput(value?: string | null) {
  if (!value) {
    const now = new Date();
    const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return { month: formatMonthKey(current), monthDate: current };
  }

  const parsed = monthSchema.safeParse(value.trim());
  if (!parsed.success) {
    throw new Error('Invalid month format. Expected YYYY-MM.');
  }

  const [year, month] = parsed.data.split('-');
  const monthDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));

  return { month: parsed.data, monthDate };
}

export function getMonthDateRange(monthDate: Date) {
  const start = new Date(monthDate);
  const end = new Date(monthDate);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildSalesMatchKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeSalesName(value: string) {
  return normalizeWhitespace(value);
}
