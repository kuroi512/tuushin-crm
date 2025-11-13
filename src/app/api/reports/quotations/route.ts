import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  isApprovedStatus,
  isOfferSentStatus,
  normalizeAppQuotationStatus,
} from '@/lib/quotations/status';

const DEFAULT_RANGE_DAYS = 60;

const DEFAULT_LEADERBOARD_PAGE_SIZE = 5;
const MAX_LEADERBOARD_PAGE_SIZE = 25;

const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  leaderboardPage: z.coerce.number().int().min(1).optional(),
  leaderboardPageSize: z.coerce.number().int().min(1).max(MAX_LEADERBOARD_PAGE_SIZE).optional(),
});

function parseRange(startInput?: string, endInput?: string) {
  const now = new Date();
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - DEFAULT_RANGE_DAYS);

  const start = startInput ? new Date(startInput) : defaultStart;
  const end = endInput ? new Date(endInput) : defaultEnd;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { start: defaultStart, end: defaultEnd };
  }

  if (start.getTime() > end.getTime()) {
    return { start: end, end: start };
  }

  return { start, end };
}

function addProfit(breakdown: Record<string, number>, profit: any) {
  if (!profit) return;
  const amount = Number(profit.amount ?? profit.value ?? profit.total ?? 0);
  if (!Number.isFinite(amount)) return;
  const currencyRaw = typeof profit.currency === 'string' ? profit.currency : profit.code;
  const currency = currencyRaw ? currencyRaw.toUpperCase() : 'MNT';
  breakdown[currency] = (breakdown[currency] ?? 0) + amount;
}

function sumProfit(breakdown: Record<string, number>, preferred?: string | null) {
  if (!preferred) {
    const keys = Object.keys(breakdown);
    if (!keys.length) return { currency: null, amount: 0 };
    const primary = keys.includes('MNT') ? 'MNT' : keys[0];
    return { currency: primary, amount: breakdown[primary] ?? 0 };
  }
  return { currency: preferred, amount: breakdown[preferred] ?? 0 };
}

function formatMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessReports')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const range = parseRange(parsed.data.start, parsed.data.end);
    const requestedLeaderboardPage = parsed.data.leaderboardPage ?? 1;
    const requestedLeaderboardPageSize =
      parsed.data.leaderboardPageSize ?? DEFAULT_LEADERBOARD_PAGE_SIZE;

    const leaderboardPageSize = Math.min(
      Math.max(requestedLeaderboardPageSize, 1),
      MAX_LEADERBOARD_PAGE_SIZE,
    );
    const leaderboardPage = Math.max(requestedLeaderboardPage, 1);

    const where: any = {
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    };

    if (!hasPermission(role, 'viewAllQuotations')) {
      const scoped: any[] = [];
      if (session.user.email) scoped.push({ createdBy: session.user.email });
      if (session.user.id) {
        scoped.push({ payload: { path: ['salesManagerId'], equals: session.user.id } });
      }
      if (scoped.length) {
        where.OR = scoped;
      }
    }

    const quotations = await prisma.appQuotation.findMany({
      where,
      select: {
        id: true,
        client: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        payload: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const summary = {
      totalQuotations: quotations.length,
      offersSent: 0,
      approved: 0,
      profitBreakdown: {} as Record<string, number>,
    };

    const salesMap = new Map<
      string,
      {
        name: string;
        quotations: number;
        offersSent: number;
        approved: number;
        profitBreakdown: Record<string, number>;
      }
    >();

    const clientMap = new Map<
      string,
      {
        client: string;
        quotations: number;
        approvals: number;
        profitBreakdown: Record<string, number>;
      }
    >();

    const timelineMap = new Map<
      string,
      {
        key: string;
        label: string;
        quotations: number;
        offersSent: number;
        approved: number;
        profitBreakdown: Record<string, number>;
      }
    >();

    for (const quotation of quotations) {
      const status = normalizeAppQuotationStatus(quotation.status);
      const offerSent = isOfferSentStatus(status);
      const approved = isApprovedStatus(status);
      const payload = (quotation.payload ?? {}) as Record<string, any>;
      const profit = payload.profit ?? payload.totalProfit;

      if (offerSent) {
        summary.offersSent += 1;
      }
      if (approved) {
        summary.approved += 1;
      }
      if (profit) {
        addProfit(summary.profitBreakdown, profit);
      }

      const monthKey = formatMonthKey(quotation.createdAt);
      const monthLabel = formatMonthLabel(quotation.createdAt);
      const timelineBucket = timelineMap.get(monthKey) ?? {
        key: monthKey,
        label: monthLabel,
        quotations: 0,
        offersSent: 0,
        approved: 0,
        profitBreakdown: {},
      };
      timelineBucket.quotations += 1;
      if (offerSent) timelineBucket.offersSent += 1;
      if (approved) timelineBucket.approved += 1;
      if (profit) addProfit(timelineBucket.profitBreakdown, profit);
      timelineMap.set(monthKey, timelineBucket);

      const salespersonRaw =
        payload.salesManager ||
        payload.salesManagerName ||
        payload.sales_manager ||
        payload.salesManagerEmail ||
        quotation.createdBy ||
        'Unassigned';
      const salesperson = String(salespersonRaw).trim() || 'Unassigned';
      const salesBucket = salesMap.get(salesperson) ?? {
        name: salesperson,
        quotations: 0,
        offersSent: 0,
        approved: 0,
        profitBreakdown: {},
      };
      salesBucket.quotations += 1;
      if (offerSent) salesBucket.offersSent += 1;
      if (approved) salesBucket.approved += 1;
      if (profit) addProfit(salesBucket.profitBreakdown, profit);
      salesMap.set(salesperson, salesBucket);

      const clientName = (quotation.client || payload.client || '').trim();
      if (clientName) {
        const clientBucket = clientMap.get(clientName) ?? {
          client: clientName,
          quotations: 0,
          approvals: 0,
          profitBreakdown: {},
        };
        clientBucket.quotations += 1;
        if (approved) clientBucket.approvals += 1;
        if (profit) addProfit(clientBucket.profitBreakdown, profit);
        clientMap.set(clientName, clientBucket);
      }
    }

    const leaderboardEntries = Array.from(salesMap.values())
      .map((item) => ({
        ...item,
        approvalRate: item.offersSent ? item.approved / item.offersSent : 0,
      }))
      .sort((a, b) => b.approved - a.approved || b.quotations - a.quotations);

    const leaderboardTotal = leaderboardEntries.length;
    const totalPages = leaderboardTotal
      ? Math.max(1, Math.ceil(leaderboardTotal / leaderboardPageSize))
      : 1;
    const normalizedPage = Math.min(leaderboardPage, totalPages);
    const offset = leaderboardTotal ? (normalizedPage - 1) * leaderboardPageSize : 0;
    const paginatedLeaderboard = leaderboardEntries.slice(offset, offset + leaderboardPageSize);

    const topClients = Array.from(clientMap.values())
      .filter((item) => item.approvals > 0)
      .sort((a, b) => b.approvals - a.approvals || b.quotations - a.quotations)
      .slice(0, 5);

    const timeline = Array.from(timelineMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const { currency: primaryCurrency, amount: totalProfit } = sumProfit(
      summary.profitBreakdown,
      'MNT',
    );

    const response = {
      summary: {
        totalQuotations: summary.totalQuotations,
        offersSent: summary.offersSent,
        approved: summary.approved,
        approvalRate: summary.totalQuotations ? summary.approved / summary.totalQuotations : 0,
        profitBreakdown: summary.profitBreakdown,
        totalProfit,
        currency: primaryCurrency,
      },
      leaderboard: paginatedLeaderboard,
      topClients,
      timeline,
      range: {
        start: range.start.toISOString().slice(0, 10),
        end: range.end.toISOString().slice(0, 10),
      },
      totals: {
        salesPeople: salesMap.size,
        clients: clientMap.size,
        approvedClients: Array.from(clientMap.values()).filter((item) => item.approvals > 0).length,
      },
      pagination: {
        leaderboard: {
          page: leaderboardTotal ? normalizedPage : 1,
          pageSize: leaderboardPageSize,
          total: leaderboardTotal,
        },
      },
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load quotation reports.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
