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
import type { ExternalShipmentCategory } from '@/lib/external-shipments';

const CATEGORY_OPTIONS: { value: ExternalShipmentCategory; label: string }[] = [
  { value: 'IMPORT', label: 'Import' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'EXPORT', label: 'Export' },
];

const DEFAULT_RANGE_DAYS = 7;

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

type SyncResult = {
  logId: string;
  category: ExternalShipmentCategory;
  filterType: number;
  recordCount: number;
  totals: {
    totalAmount: number;
    totalProfitMnt: number;
    totalProfitCur: number;
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

export default function ExternalShipmentsPage() {
  const router = useRouter();
  const [category, setCategory] = useState<ExternalShipmentCategory>('IMPORT');
  const [filterType, setFilterType] = useState('');
  const [beginDate, setBeginDate] = useState(() =>
    formatDateInput(subtractDays(new Date(), DEFAULT_RANGE_DAYS)),
  );
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const selectedCategoryLabel = useMemo(
    () => CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category,
    [category],
  );

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

  const handleSubmit = useCallback(async () => {
    if (syncing) return;
    if (!beginDate || !endDate) {
      toast.error('Begin date and end date are required.');
      return;
    }

    if (new Date(beginDate) > new Date(endDate)) {
      toast.error('Begin date must be before end date.');
      return;
    }

    const payload: Record<string, unknown> = {
      category,
      beginDate,
      endDate,
    };

    if (filterType.trim()) {
      const parsed = Number.parseInt(filterType.trim(), 10);
      if (Number.isNaN(parsed)) {
        toast.error('Filter type must be a number.');
        return;
      }
      payload.filterType = parsed;
    }

    try {
      setSyncing(true);
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

      const result: SyncResult | undefined = json?.data;
      if (result) {
        setSyncResult(result);
        toast.success(
          `Stored ${result.recordCount} ${selectedCategoryLabel.toLowerCase()} shipment(s).`,
        );
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
    }
  }, [beginDate, category, endDate, fetchLogs, filterType, selectedCategoryLabel, syncing]);

  const disabled = syncing || loadingLogs;

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
              <Label htmlFor="sync-filter">Filter type (optional)</Label>
              <Input
                id="sync-filter"
                type="number"
                inputMode="numeric"
                placeholder="Defaults per category"
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">
                Leave blank to use the upstream default for {selectedCategoryLabel.toLowerCase()}.
              </p>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={syncing} className="flex items-center gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {syncing ? 'Syncing…' : 'Sync & Store Shipments'}
          </Button>

          {syncResult && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">Sync summary</p>
              <ul className="mt-2 space-y-1 text-xs sm:text-sm">
                <li>
                  Log reference: <span className="font-mono">{syncResult.logId}</span>
                </li>
                <li>Stored records: {formatNumber(syncResult.recordCount, 0)}</li>
                <li>Total amount: ₮{formatNumber(syncResult.totals.totalAmount)} (upstream)</li>
                <li>Profit (MNT): ₮{formatNumber(syncResult.totals.totalProfitMnt)}</li>
                <li>Profit (foreign): {formatNumber(syncResult.totals.totalProfitCur)}</li>
              </ul>
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
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {toLocaleDateTime(log.startedAt)}
                      </td>
                      <td className="px-4 py-2 align-top font-medium whitespace-nowrap text-gray-800">
                        {log.category}
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {log.filterType ?? 'Default'}
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-gray-700">
                        {windowLabel}
                      </td>
                      <td className="px-4 py-2 text-right align-top font-semibold whitespace-nowrap text-gray-900">
                        {formatNumber(log.recordCount, 0)}
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
    </div>
  );
}
