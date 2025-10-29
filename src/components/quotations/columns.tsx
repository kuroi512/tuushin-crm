'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Quotation } from '@/types/quotation';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Edit, Printer, MoreHorizontal, FileText, XCircle, CheckCircle2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export function useQuotationColumns(): ColumnDef<Quotation>[] {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    type: 'duplicate' | 'status';
  } | null>(null);
  const [closeDialog, setCloseDialog] = useState<{
    quotation: Quotation;
    status: 'CANCELLED' | 'CLOSED';
    reason: string;
    submitting: boolean;
    error?: string;
  } | null>(null);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
    [queryClient],
  );

  const goToEdit = useCallback(
    (quotationId: string) => {
      router.push(`/quotations/${quotationId}/edit`);
    },
    [router],
  );

  const handleDuplicate = useCallback(
    async (quotation: Quotation) => {
      const required = ['client', 'cargoType', 'origin', 'destination'] as const;
      const missing = required.filter((key) => !quotation[key]);
      if (missing.length) {
        toast.error('Quotation is missing required fields to duplicate.');
        return;
      }

      const estimatedCost =
        typeof quotation.estimatedCost === 'number' && quotation.estimatedCost > 0
          ? quotation.estimatedCost
          : null;
      if (!estimatedCost) {
        toast.error('Add an estimated cost before duplicating this quotation.');
        return;
      }

      setPendingAction({ id: quotation.id, type: 'duplicate' });
      try {
        const extra: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(quotation)) {
          if (
            [
              'id',
              'quotationNumber',
              'createdAt',
              'createdBy',
              'status',
              'client',
              'origin',
              'destination',
              'cargoType',
              'estimatedCost',
              'weight',
              'volume',
            ].includes(key)
          ) {
            continue;
          }
          extra[key] = value;
        }

        const payload: Record<string, unknown> = {
          client: quotation.client,
          cargoType: quotation.cargoType,
          origin: quotation.origin,
          destination: quotation.destination,
          estimatedCost,
          ...extra,
        };

        if (typeof quotation.weight === 'number' && Number.isFinite(quotation.weight)) {
          payload.weight = quotation.weight;
        }
        if (typeof quotation.volume === 'number' && Number.isFinite(quotation.volume)) {
          payload.volume = quotation.volume;
        }

        const res = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.data) {
          throw new Error(json?.error || 'Failed to duplicate quotation.');
        }

        await invalidate();
        const newQuotation = json.data as Quotation;
        toast.success(
          `${quotation.quotationNumber ?? 'Quotation'} duplicated as ${newQuotation.quotationNumber}.`,
        );
        if (newQuotation?.id) {
          goToEdit(newQuotation.id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to duplicate quotation.');
      } finally {
        setPendingAction(null);
      }
    },
    [goToEdit, invalidate],
  );

  const updateStatus = useCallback(
    async (quotation: Quotation, status: 'CANCELLED' | 'CLOSED', closeReason?: string) => {
      setPendingAction({ id: quotation.id, type: 'status' });
      let ok = false;
      try {
        const payload: Record<string, string> = { status };
        if (typeof closeReason === 'string' && closeReason.trim().length) {
          payload.closeReason = closeReason.trim();
        }
        const res = await fetch(`/api/quotations/${quotation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to update quotation status.');
        }
        await invalidate();
        const label =
          status === 'CANCELLED'
            ? `${quotation.quotationNumber ?? 'Quotation'} marked as cancelled.`
            : `${quotation.quotationNumber ?? 'Quotation'} marked as finished.`;
        toast.success(label);
        ok = true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update quotation status.');
      } finally {
        setPendingAction(null);
      }
      return ok;
    },
    [invalidate],
  );

  const promptCloseReason = useCallback((quotation: Quotation, status: 'CANCELLED' | 'CLOSED') => {
    setCloseDialog({
      quotation,
      status,
      reason: typeof quotation.closeReason === 'string' ? quotation.closeReason : '',
      submitting: false,
      error: undefined,
    });
  }, []);

  const handleStatusSubmit = useCallback(async () => {
    if (!closeDialog) return;
    const current = closeDialog;
    const trimmed = current.reason.trim();
    if (!trimmed.length) {
      setCloseDialog((prev) =>
        prev
          ? {
              ...prev,
              error: t('quotation.actions.closeReasonRequired'),
            }
          : prev,
      );
      return;
    }

    setCloseDialog((prev) =>
      prev
        ? {
            ...prev,
            submitting: true,
            error: undefined,
          }
        : prev,
    );

    const success = await updateStatus(current.quotation, current.status, trimmed);
    if (success) {
      setCloseDialog(null);
    } else {
      setCloseDialog((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
            }
          : prev,
      );
    }
  }, [closeDialog, t, updateStatus]);

  const handleDialogToggle = useCallback((open: boolean) => {
    if (open) return;
    setCloseDialog((prev) => {
      if (prev?.submitting) {
        return prev;
      }
      return null;
    });
  }, []);

  const handlePrint = useCallback((quotation: Quotation) => {
    if (typeof window === 'undefined') return;
    window.open(`/quotations/${quotation.id}/print`, '_blank', 'noopener');
  }, []);

  const columns = useMemo<ColumnDef<Quotation>[]>(
    () => [
      {
        id: 'actions',
        enableHiding: false,
        header: '',
        meta: { sticky: 'left', width: 80, className: 'justify-center px-4 py-4' },
        cell: ({ row }) => {
          const quotation = row.original;
          const status = (quotation.status ?? '').toString().toUpperCase();
          const isCancelled = status === 'CANCELLED';
          const isClosed = status === 'CLOSED';
          const isBusy = pendingAction?.id === quotation.id;
          const dialogData =
            closeDialog && closeDialog.quotation.id === quotation.id ? closeDialog : null;
          const dialogTitle = dialogData
            ? dialogData.status === 'CANCELLED'
              ? t('quotation.actions.closeInquiry')
              : t('quotation.actions.finishQuotation')
            : '';
          const confirmLabel = dialogData
            ? dialogData.status === 'CANCELLED'
              ? t('quotation.actions.confirmClose')
              : t('quotation.actions.confirmFinish')
            : '';

          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => goToEdit(quotation.id)}
                    disabled={isBusy}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => handleDuplicate(quotation)}
                    disabled={isBusy}
                    className="cursor-pointer"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t('common.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => promptCloseReason(quotation, 'CANCELLED')}
                    disabled={isBusy || isCancelled}
                    className="cursor-pointer"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('quotation.actions.closeInquiry')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => promptCloseReason(quotation, 'CLOSED')}
                    disabled={isBusy || isCancelled || isClosed}
                    className="cursor-pointer"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('quotation.actions.finishQuotation')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => handlePrint(quotation)}
                    disabled={isBusy}
                    className="cursor-pointer"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    {t('common.print')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`/quotations/${quotation.id}/print`)}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View print page
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={Boolean(dialogData)} onOpenChange={handleDialogToggle}>
                {dialogData ? (
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{dialogTitle}</DialogTitle>
                      <DialogDescription>
                        {t('quotation.actions.closeReasonDescription')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                      <Label htmlFor={`close-reason-${quotation.id}`}>
                        {t('quotation.actions.closeReasonLabel')}
                      </Label>
                      <Textarea
                        id={`close-reason-${quotation.id}`}
                        placeholder={t('quotation.actions.closeReasonPlaceholder')}
                        value={dialogData.reason}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCloseDialog((prev) => {
                            if (!prev || prev.quotation.id !== quotation.id) {
                              return prev;
                            }
                            const trimmed = value.trim();
                            return {
                              ...prev,
                              reason: value,
                              error: trimmed.length ? undefined : prev.error,
                            };
                          });
                        }}
                        disabled={dialogData.submitting}
                        rows={4}
                      />
                      {dialogData.error ? (
                        <p className="text-destructive text-sm">{dialogData.error}</p>
                      ) : null}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (dialogData.submitting) return;
                          setCloseDialog(null);
                        }}
                        disabled={dialogData.submitting}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleStatusSubmit} disabled={dialogData.submitting}>
                        {confirmLabel || t('common.save')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                ) : null}
              </Dialog>
            </>
          );
        },
      },
      {
        accessorKey: 'quotationNumber',
        header: t('columns.quotationNumber'),
        enableHiding: false,
        meta: { sticky: 'left', width: 180, className: 'px-6 py-4' },
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span className="font-medium">{row.getValue('quotationNumber')}</span>
          </div>
        ),
      },
      {
        accessorKey: 'client',
        header: t('columns.client'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.client || row.original.consignee || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'shipper',
        header: t('filters.shipper'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.shipper || row.original.consignee || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'cargoType',
        header: t('columns.cargoType'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.cargoType || row.original.commodity || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'incoterm',
        header: t('filters.incoterm'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.incoterm || '-'}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('filters.type'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.type || row.original.tmode || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'route',
        header: t('columns.route'),
        cell: ({ row }) => {
          const origin = row.original.originCity || row.original.origin || '-';
          const destination = row.original.finalCity || row.original.destination || '-';
          return (
            <div className="text-sm whitespace-nowrap">
              {origin} → {destination}
            </div>
          );
        },
      },
      {
        accessorKey: 'country',
        header: t('filters.country'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.country ||
              row.original.finalCountry ||
              row.original.destinationCountry ||
              '-'}
          </span>
        ),
      },
      {
        accessorKey: 'weight',
        header: t('columns.weightVolume'),
        cell: ({ row }) => (
          <div className="text-sm whitespace-nowrap">
            <div>
              {typeof row.getValue<number>('weight') === 'number'
                ? row.getValue<number>('weight').toLocaleString() + ' kg'
                : '-'}
            </div>
            <div className="text-gray-500">
              {typeof row.original.volume === 'number' ? row.original.volume.toFixed(2) : '-'} m³
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'estimatedCost',
        header: t('columns.estimatedCost'),
        cell: ({ row }) => {
          const value = row.getValue<number>('estimatedCost');
          return (
            <div className="font-medium whitespace-nowrap text-green-600">
              {typeof value === 'number' ? `$${value.toLocaleString()}` : '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'salesManager',
        header: t('filters.salesManager'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.salesManager || '-'}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columns.created'),
        cell: ({ row }) => (
          <div className="text-sm whitespace-nowrap text-gray-500">
            {new Date(row.getValue('createdAt')).toLocaleDateString()}
          </div>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('filters.createdBy'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.createdBy || '-'}</span>
        ),
      },
    ],
    [
      closeDialog,
      goToEdit,
      handleDuplicate,
      handleDialogToggle,
      handlePrint,
      handleStatusSubmit,
      pendingAction,
      promptCloseReason,
      t,
    ],
  );

  return columns;
}
