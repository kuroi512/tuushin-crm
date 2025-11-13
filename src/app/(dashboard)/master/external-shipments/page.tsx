'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ExternalShipmentCategory } from '@/lib/external-shipments';

const CATEGORY_OPTIONS: { value: ExternalShipmentCategory; label: string }[] = [
  { value: 'IMPORT', label: 'Import' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'EXPORT', label: 'Export' },
];

const DEFAULT_FILTER_TYPES = [1, 2];

const DEFAULT_RANGE_DAYS = 7;

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

type SyncRunResult = {
  logId: string;
  category: ExternalShipmentCategory;
  filterType: number | null;
  filterTypes: number[];
  fetchedCount: number;
  recordCount: number;
  skippedWithoutId: number;
  totals: {
    totalAmount: number;
    totalProfitMnt: number;
    totalProfitCur: number;
  };
};

type SyncResponse =
  | SyncRunResult
  | {
      runs: SyncRunResult[];
      summary: {
        recordCount: number;
        fetchedCount: number;
        totalAmount: number;
        totalProfitMnt: number;
        totalProfitCur: number;
        skippedWithoutId: number;
      };
    };

type SyncLog = {
  id: string;
  category: ExternalShipmentCategory;
  filterType: number | null;
  fromDate: string | null;
  toDate: string | null;
  recordCount: number;
  shipmentCount: number;
  totalAmount: number;
  totalProfitMnt: number;
  totalProfitCur: number;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  message: string | null;
};

function toLocaleDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value ?? 0);
}

function parseFilterTypesInput(value: string) {
  if (!value) return [] as number[];
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((token) => Number.parseInt(token, 10))
        .filter((num) => Number.isFinite(num)) as number[],
    ),
  );
}

function extractFilterTypesFromMessage(message: string | null) {
  if (!message) return [] as number[];
  const match = message.match(/Filters:\s*([0-9,\s]+)/i);
  if (!match) return [] as number[];
  return match[1]
    .split(/[\s,]+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((num) => Number.isFinite(num)) as number[];
}

export default function ExternalShipmentsPage() {
  const router = useRouter();
  const [category, setCategory] = useState<ExternalShipmentCategory>('IMPORT');
  const [filterTypesInput, setFilterTypesInput] = useState('1,2');
  const [beginDate, setBeginDate] = useState(() =>
    formatDateInput(subtractDays(new Date(), DEFAULT_RANGE_DAYS)),
  );
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch('/api/external-shipments/logs?limit=25', {
        headers: { 'Cache-Control': 'no-store' },
      });
      const json = await res.json();
      if (!res.ok) {
        const messageParts = [json?.error, json?.details].filter(Boolean);
        throw new Error(messageParts.join(' — ') || 'Failed to load sync logs');
      }
      setLogs(Array.isArray(json?.data) ? json.data : []);
      if (json?.warning) {
        toast.warning(json.warning);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to load sync logs');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const executeSync = useCallback(
    async (targetCategory: ExternalShipmentCategory | 'ALL') => {
      if (syncing) return;
      if (!beginDate || !endDate) {
        toast.error('Begin date and end date are required.');
        return;
      }

      if (new Date(beginDate) > new Date(endDate)) {
        toast.error('Begin date must be before end date.');
        return;
      }

      const parsedFilterTypes = parseFilterTypesInput(filterTypesInput.trim());
      if (filterTypesInput.trim() && parsedFilterTypes.length === 0) {
        toast.error('Filter types must be comma-separated numbers (e.g. 1,2).');
        return;
      }

      const filtersToSend = parsedFilterTypes.length > 0 ? parsedFilterTypes : DEFAULT_FILTER_TYPES;

      const payload: Record<string, unknown> = {
        category: targetCategory === 'ALL' ? 'ALL' : targetCategory,
        beginDate,
        endDate,
        filterTypes: filtersToSend,
      };

      const categoryLabel =
        targetCategory === 'ALL'
          ? 'all categories'
          : (CATEGORY_OPTIONS.find(
              (option) => option.value === targetCategory,
            )?.label.toLowerCase() ?? targetCategory.toLowerCase());

      try {
        setSyncing(true);
        setShowSyncModal(true);
        setSyncResult(null);
        const res = await fetch('/api/external-shipments/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          const messageParts = [json?.error, json?.details].filter(Boolean);
          throw new Error(messageParts.join(' — ') || 'Failed to sync external shipments');
        }

        const result: SyncResponse | undefined = json?.data;
        if (result) {
          setSyncResult(result);
          if ('runs' in result) {
            toast.success(
              `Synced ${formatNumber(result.summary.recordCount, 0)} shipment(s) across all categories (filters ${filtersToSend.join(', ')}).`,
            );
          } else {
            toast.success(
              `Stored ${formatNumber(result.recordCount, 0)} ${categoryLabel} shipment(s) (filters ${filtersToSend.join(', ')}).`,
            );
          }
        } else {
          toast.success('Sync completed successfully.');
        }
        if (json?.warning) {
          toast.warning(json.warning);
        }
        fetchLogs();
      } catch (error) {
        console.error('External sync error', error);
        toast.error(error instanceof Error ? error.message : 'Sync failed');
      } finally {
        setSyncing(false);
        setShowSyncModal(false);
      }
    },
    [beginDate, endDate, fetchLogs, filterTypesInput, syncing],
  );

  const handleSubmit = useCallback(() => executeSync(category), [category, executeSync]);
  const handleSyncAll = useCallback(() => executeSync('ALL'), [executeSync]);

  const disabled = syncing || loadingLogs;

  const syncRuns = useMemo<SyncRunResult[]>(() => {
    if (!syncResult) return [];
    if ('runs' in syncResult) return syncResult.runs;
    return [syncResult];
  }, [syncResult]);

  const syncSummary = useMemo(() => {
    if (!syncResult) return null;
    if ('runs' in syncResult) return syncResult.summary;
    return {
      recordCount: syncResult.recordCount,
      fetchedCount: syncResult.fetchedCount,
      totalAmount: syncResult.totals.totalAmount,
      totalProfitMnt: syncResult.totals.totalProfitMnt,
      totalProfitCur: syncResult.totals.totalProfitCur,
      skippedWithoutId: syncResult.skippedWithoutId,
    };
  }, [syncResult]);

  const combinedFilterTypes = useMemo(() => {
    if (!syncRuns.length) return [] as number[];
    return Array.from(new Set(syncRuns.flatMap((run) => run.filterTypes ?? []))).sort(
      (a, b) => a - b,
    );
  }, [syncRuns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">External Shipments</h1>
          <p className="text-sm text-gray-600">
            Pull shipments from the upstream Tuushin CRM and store them locally for reporting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh page
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/master/sales-kpi')}>
            Manage sales KPIs
          </Button>
          <Button variant="outline" onClick={fetchLogs} disabled={loadingLogs}>
            {loadingLogs ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {loadingLogs ? 'Loading logs…' : 'Reload logs'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="sync-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value: ExternalShipmentCategory) => setCategory(value)}
                disabled={disabled}
              >
                <SelectTrigger id="sync-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-begin">Begin date</Label>
              <Input
                id="sync-begin"
                type="date"
                value={beginDate}
                onChange={(event) => setBeginDate(event.target.value)}
                disabled={disabled}
                max={endDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-end">End date</Label>
              <Input
                id="sync-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={disabled}
                min={beginDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-filter">Filter types</Label>
              <Input
                id="sync-filter"
                type="text"
                placeholder="1,2"
                value={filterTypesInput}
                onChange={(event) => setFilterTypesInput(event.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">
                Comma-separated filter identifiers. Leave blank to sync with 1 and 2 for each
                category.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleSubmit} disabled={syncing} className="flex items-center gap-2">
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {syncing ? 'Syncing…' : 'Sync selected category'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {syncing ? 'Working…' : 'Sync all categories'}
            </Button>
          </div>

          {syncResult && syncSummary && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">Sync summary</p>
              <ul className="mt-2 space-y-1 text-xs sm:text-sm">
                <li>
                  Stored records: {formatNumber(syncSummary.recordCount, 0)} (fetched{' '}
                  {formatNumber(syncSummary.fetchedCount, 0)})
                </li>
                <li>Total amount: ₮{formatNumber(syncSummary.totalAmount)} (upstream)</li>
                <li>Profit (MNT): ₮{formatNumber(syncSummary.totalProfitMnt)}</li>
                <li>Profit (foreign): {formatNumber(syncSummary.totalProfitCur)}</li>
                {combinedFilterTypes.length > 0 && (
                  <li>Filter types used: {combinedFilterTypes.join(', ')}</li>
                )}
                {syncSummary.skippedWithoutId > 0 && (
                  <li>
                    Skipped without identifier: {formatNumber(syncSummary.skippedWithoutId, 0)}
                  </li>
                )}
              </ul>
              <div className="mt-3 space-y-2">
                {syncRuns.map((run) => (
                  <div
                    key={run.logId}
                    className="rounded border border-blue-300 bg-white/70 p-2 text-xs text-blue-900 sm:text-sm"
                  >
                    <p className="font-semibold">
                      {run.category} · filters {run.filterTypes.join(', ')}
                    </p>
                    <p className="font-mono text-xs break-all text-blue-700">Log: {run.logId}</p>
                    <p>
                      Stored {formatNumber(run.recordCount, 0)} / Fetched{' '}
                      {formatNumber(run.fetchedCount, 0)}
                    </p>
                    {run.skippedWithoutId > 0 && (
                      <p>Skipped without identifier: {formatNumber(run.skippedWithoutId, 0)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sync runs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Started
                </th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Category
                </th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Filter
                </th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Window
                </th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap text-gray-600">
                  Fetched
                </th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap text-gray-600">
                  Stored
                </th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap text-gray-600">
                  Total amount
                </th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap text-gray-600">
                  Profit ₮
                </th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap text-gray-600">
                  Profit FX
                </th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap text-gray-600">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loadingLogs ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    No sync history yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const windowLabel =
                    log.fromDate && log.toDate ? `${log.fromDate} → ${log.toDate}` : '—';
                  const filtersFromMessage = extractFilterTypesFromMessage(log.message);
                  const filterLabel =
                    log.filterType !== null
                      ? String(log.filterType)
                      : filtersFromMessage.length > 1
                        ? `Multiple (${filtersFromMessage.join(', ')})`
                        : filtersFromMessage.length === 1
                          ? String(filtersFromMessage[0])
                          : 'Default';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {toLocaleDateTime(log.startedAt)}
                      </td>
                      <td className="px-4 py-2 align-top font-medium whitespace-nowrap text-gray-800">
                        {log.category}
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {filterLabel}
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {windowLabel}
                      </td>
                      <td className="px-4 py-2 text-right align-top whitespace-nowrap text-gray-700">
                        {formatNumber(log.recordCount, 0)}
                      </td>
                      <td className="px-4 py-2 text-right align-top font-semibold whitespace-nowrap text-gray-900">
                        {formatNumber(log.shipmentCount, 0)}
                      </td>
                      <td className="px-4 py-2 text-right align-top whitespace-nowrap text-gray-700">
                        ₮{formatNumber(log.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-right align-top whitespace-nowrap text-gray-700">
                        ₮{formatNumber(log.totalProfitMnt)}
                      </td>
                      <td className="px-4 py-2 text-right align-top whitespace-nowrap text-gray-700">
                        {formatNumber(log.totalProfitCur)}
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {log.status}
                      </td>
                      <td className="px-4 py-2 align-top text-gray-600">
                        {log.message ? (
                          <span className="font-mono text-xs">{log.message}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={showSyncModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sync in progress</DialogTitle>
            <DialogDescription>
              Do not navigate away or perform other actions while the external shipments sync is
              running. This may take several minutes depending on the date range.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 pt-2 text-sm text-gray-700">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>Fetching and storing shipments…</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
