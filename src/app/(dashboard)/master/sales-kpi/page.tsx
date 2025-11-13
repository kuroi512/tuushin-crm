'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

import { hasPermission, normalizeRole } from '@/lib/permissions';
import { buildSalesMatchKey, formatMonthKey, normalizeSalesName } from '@/lib/sales-kpi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMasterOptions } from '@/components/master/hooks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function getDefaultMonth() {
  const now = new Date();
  const normalized = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return formatMonthKey(normalized);
}

type MeasurementRecord = {
  id: string;
  month: string;
  salesName: string;
  plannedRevenue: number;
  plannedProfit: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MeasurementResponse = {
  success: boolean;
  data: {
    month: string;
    measurements: MeasurementRecord[];
    totals: {
      plannedRevenue: number;
      plannedProfit: number;
    };
  };
  error?: string;
};

type SaveResponse = {
  success: boolean;
  data?: MeasurementRecord;
  error?: string;
  details?: unknown;
};

type HistoryResponse = {
  success: boolean;
  data: {
    salesName: string;
    matchKey: string;
    measurements: MeasurementRecord[];
  };
  error?: string;
};

type SalesRow = {
  displayName: string;
  salesName: string;
  matchKey: string;
  isActive: boolean;
  source: 'master' | 'measurement';
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function SalesKpiMasterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccess = hasPermission(role, 'accessMasterData');

  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [totals, setTotals] = useState({ plannedRevenue: 0, plannedProfit: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manageState, setManageState] = useState<{
    displayName: string;
    salesName: string;
    matchKey: string;
  } | null>(null);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementRecord | null>(null);
  const [formState, setFormState] = useState({ plannedRevenue: '', plannedProfit: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<MeasurementRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: salesMaster, isLoading: salesLoading } = useMasterOptions('SALES');

  const SALES_PAGE_SIZE = 20;
  const [salesPage, setSalesPage] = useState(1);

  const measurementMap = useMemo(() => {
    const map = new Map<string, MeasurementRecord>();
    for (const record of measurements) {
      const normalized = normalizeSalesName(record.salesName);
      map.set(buildSalesMatchKey(normalized), record);
    }
    return map;
  }, [measurements]);

  const salesRows = useMemo<SalesRow[]>(() => {
    const map = new Map<string, SalesRow>();

    for (const option of salesMaster?.data ?? []) {
      const rawName = option?.name?.trim();
      if (!rawName) continue;
      const normalized = normalizeSalesName(rawName);
      const matchKey = buildSalesMatchKey(normalized);
      if (!map.has(matchKey)) {
        map.set(matchKey, {
          displayName: rawName,
          salesName: normalized,
          matchKey,
          isActive: Boolean(option?.isActive),
          source: 'master',
        });
      }
    }

    for (const record of measurements) {
      const normalized = normalizeSalesName(record.salesName);
      const matchKey = buildSalesMatchKey(normalized);
      if (!map.has(matchKey)) {
        map.set(matchKey, {
          displayName: record.salesName,
          salesName: normalized,
          matchKey,
          isActive: true,
          source: 'measurement',
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    );
  }, [salesMaster?.data, measurements]);

  const totalSalesPages = Math.max(1, Math.ceil(salesRows.length / SALES_PAGE_SIZE));

  const displayedSalesRows = useMemo(() => {
    const start = (salesPage - 1) * SALES_PAGE_SIZE;
    return salesRows.slice(start, start + SALES_PAGE_SIZE);
  }, [salesRows, salesPage]);

  const fetchMeasurements = useCallback(async (month: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/master/sales-kpi?month=${encodeURIComponent(month)}`, {
        cache: 'no-store',
      });
      const body: MeasurementResponse = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Unable to load KPI measurements.');
      }
      setMeasurements(body.data.measurements);
      setTotals(body.data.totals);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load KPI measurements.');
      setMeasurements([]);
      setTotals({ plannedRevenue: 0, plannedProfit: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccess) {
      router.replace('/dashboard');
      return;
    }
    fetchMeasurements(selectedMonth);
  }, [status, canAccess, router, fetchMeasurements, selectedMonth]);

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    setSalesPage(1);
  };

  const openManageModal = (row: SalesRow) => {
    setManageState({
      displayName: row.displayName,
      salesName: row.salesName,
      matchKey: row.matchKey,
    });
  };

  const closeManageModal = () => {
    setManageState(null);
    setCurrentMeasurement(null);
    setFormState({ plannedRevenue: '', plannedProfit: '', notes: '' });
    setFormError(null);
    setHistoryRecords([]);
    setHistoryError(null);
    setHistoryLoading(false);
    setDeletingId(null);
  };

  const loadHistory = useCallback(async (salesName: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(
        `/api/master/sales-kpi?salesName=${encodeURIComponent(salesName)}`,
        {
          cache: 'no-store',
        },
      );
      const body: HistoryResponse = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Unable to load KPI history.');
      }
      setHistoryRecords(body.data.measurements);
    } catch (err: any) {
      setHistoryError(err?.message ?? 'Unable to load KPI history.');
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!manageState) return;
    const record = measurementMap.get(manageState.matchKey) ?? null;
    setCurrentMeasurement(record);
    setFormState({
      plannedRevenue: record ? String(record.plannedRevenue) : '',
      plannedProfit: record ? String(record.plannedProfit) : '',
      notes: record?.notes ?? '',
    });
    setFormError(null);
  }, [manageState, measurementMap]);

  useEffect(() => {
    if (!manageState) return;
    loadHistory(manageState.salesName);
  }, [manageState, loadHistory]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manageState) return;
    if (!selectedMonth) {
      setFormError('Select a month first.');
      return;
    }

    const revenueValue = Number.parseFloat(formState.plannedRevenue || '0');
    const profitValue = Number.parseFloat(formState.plannedProfit || '0');

    if (Number.isNaN(revenueValue) || revenueValue < 0) {
      setFormError('Planned revenue must be zero or a positive number.');
      return;
    }
    if (Number.isNaN(profitValue) || profitValue < 0) {
      setFormError('Planned profit must be zero or a positive number.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        month: selectedMonth,
        salesName: manageState.salesName,
        plannedRevenue: revenueValue,
        plannedProfit: profitValue,
        notes: formState.notes?.trim() || undefined,
      };

      let response: Response;
      if (currentMeasurement) {
        response = await fetch(`/api/master/sales-kpi/${currentMeasurement.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/master/sales-kpi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const body: SaveResponse = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Unable to save KPI measurement.');
      }

      await fetchMeasurements(selectedMonth);
      await loadHistory(manageState.salesName);
    } catch (err: any) {
      setFormError(err?.message ?? 'Unable to save KPI measurement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (record: MeasurementRecord) => {
    if (!manageState) return;
    if (!window.confirm(`Delete KPI measurement for ${record.month}?`)) return;

    setDeletingId(record.id);
    try {
      const response = await fetch(`/api/master/sales-kpi/${record.id}`, {
        method: 'DELETE',
      });
      const body: SaveResponse = await response.json().catch(() => ({ success: response.ok }));
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Unable to delete KPI measurement.');
      }

      if (record.month === selectedMonth) {
        await fetchMeasurements(selectedMonth);
      }
      await loadHistory(manageState.salesName);
    } catch (err: any) {
      setFormError(err?.message ?? 'Unable to delete KPI measurement.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCurrent = () => {
    if (!currentMeasurement) return;
    handleDeleteHistory(currentMeasurement);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales KPI Measurements</h1>
        <p className="text-gray-600">
          Review every sales owner in a single view. Use the action button per row to capture this
          month’s KPI and check their historical targets.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <label htmlFor="month-input" className="text-sm font-medium text-gray-700">
                Month
              </label>
              <Input
                id="month-input"
                type="month"
                value={selectedMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
                max={getDefaultMonth()}
                className="w-40"
              />
            </div>
            <div className="text-sm text-gray-500">
              {isLoading
                ? 'Refreshing measurements…'
                : 'Select a month to review or update KPI targets.'}
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Planned revenue</CardTitle>
            <CardDescription>Aggregate revenue target for {selectedMonth}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-blue-600">
              ₮{formatCurrency(totals.plannedRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Planned profit</CardTitle>
            <CardDescription>Aggregate profit target for {selectedMonth}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">
              ₮{formatCurrency(totals.plannedProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Measurements</CardTitle>
          <CardDescription>
            All sales owners appear below. Use “Manage KPI” to record or adjust the target for{' '}
            {selectedMonth}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sales owner</TableHead>
                <TableHead className="text-right">Planned revenue</TableHead>
                <TableHead className="text-right">Planned profit</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || salesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Refreshing…
                    </div>
                  </TableCell>
                </TableRow>
              ) : salesRows.length ? (
                displayedSalesRows.map((row) => {
                  const record = measurementMap.get(row.matchKey) ?? null;
                  return (
                    <TableRow key={row.matchKey}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-gray-900">{row.displayName}</p>
                          {row.source === 'measurement' ? (
                            <p className="text-xs text-gray-500">Added from existing KPI data</p>
                          ) : null}
                          {!row.isActive ? (
                            <p className="text-xs text-amber-600">Inactive in Master → Sales</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {record ? (
                          `₮${formatCurrency(record.plannedRevenue)}`
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {record ? (
                          `₮${formatCurrency(record.plannedProfit)}`
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openManageModal(row)}
                          variant={record ? 'secondary' : 'default'}
                        >
                          {record ? 'Manage KPI' : 'Add KPI'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-gray-500">
                    No sales owners found. Add sales in Master Data → Sales first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between p-4">
            <p className="text-xs text-gray-500">
              Showing {Math.min((salesPage - 1) * SALES_PAGE_SIZE + 1, salesRows.length)}–
              {Math.min(salesPage * SALES_PAGE_SIZE, salesRows.length)} of {salesRows.length} sales
              owners
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={salesPage <= 1}
                onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <p className="text-xs text-gray-500">
                Page {salesPage} / {totalSalesPages}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={salesPage >= totalSalesPages}
                onClick={() => setSalesPage((p) => Math.min(totalSalesPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(manageState)}
        onOpenChange={(open) => (!open ? closeManageModal() : null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage KPI — {manageState?.displayName ?? ''}</DialogTitle>
            <DialogDescription>
              Record the KPI for {selectedMonth}. History for this sales owner appears on the right.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
              <div>
                <Label className="text-xs text-gray-500 uppercase">Sales owner</Label>
                <p className="text-base font-semibold text-gray-900">
                  {manageState?.displayName ?? '—'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-month">Month</Label>
                <Input
                  id="modal-month"
                  type="month"
                  value={selectedMonth}
                  readOnly
                  className="w-40"
                />
                <p className="text-xs text-gray-500">Switch months from the main page.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modal-planned-revenue">Planned revenue (₮)</Label>
                  <Input
                    id="modal-planned-revenue"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formState.plannedRevenue}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, plannedRevenue: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-planned-profit">Planned profit (₮)</Label>
                  <Input
                    id="modal-planned-profit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formState.plannedProfit}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, plannedProfit: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-notes">Notes (optional)</Label>
                <Textarea
                  id="modal-notes"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={3}
                />
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {currentMeasurement ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={handleDeleteCurrent}
                    disabled={isSaving || deletingId === currentMeasurement.id}
                  >
                    {deletingId === currentMeasurement.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Removing…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Delete {selectedMonth} KPI
                      </span>
                    )}
                  </Button>
                ) : null}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeManageModal}
                    disabled={isSaving}
                  >
                    Close
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </span>
                    ) : currentMeasurement ? (
                      'Save changes'
                    ) : (
                      'Create measurement'
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">KPI history</h3>
                <p className="text-xs text-gray-500">
                  Past KPI targets for this sales owner. The selected month is highlighted.
                </p>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Revenue (₮)</TableHead>
                      <TableHead className="text-right">Profit (₮)</TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : historyRecords.length ? (
                      historyRecords.map((record) => (
                        <TableRow
                          key={record.id}
                          className={record.month === selectedMonth ? 'bg-blue-50' : undefined}
                        >
                          <TableCell>{record.month}</TableCell>
                          <TableCell className="text-right">
                            ₮{formatCurrency(record.plannedRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            ₮{formatCurrency(record.plannedProfit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete KPI for ${record.month}`}
                              onClick={() => handleDeleteHistory(record)}
                              disabled={deletingId === record.id || isSaving}
                            >
                              {deletingId === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-600" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
                          No KPI records found for this sales owner yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
