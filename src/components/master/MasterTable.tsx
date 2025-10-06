'use client';

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MasterOption, useDeleteMasterOption } from './hooks';
import { Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

interface MasterTableProps {
  data: MasterOption[] | undefined;
  loading: boolean;
  onEdit: (row: MasterOption) => void;
}

export function MasterTable({ data = [], loading, onEdit }: MasterTableProps) {
  const t = useT();
  const deleteMutation = useDeleteMasterOption(data[0]?.category);

  const columns = useMemo<ColumnDef<MasterOption, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('master.columns.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.original.name}</span>
            {!row.original.isActive && (
              <Badge variant="secondary">{t('master.badge.inactive')}</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'code',
        header: t('master.columns.code'),
        cell: ({ row }) => row.original.code || '-',
      },
      {
        accessorKey: 'source',
        header: t('master.columns.source'),
        cell: ({ row }) => (
          <Badge variant={row.original.source === 'EXTERNAL' ? 'outline' : 'default'}>
            {row.original.source}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('master.columns.actions'),
        cell: ({ row }) => {
          const opt = row.original;
          const isLocked = opt.source === 'EXTERNAL';
          if (isLocked) {
            return (
              <span className="text-muted-foreground text-xs">
                {t('master.actions.externalLocked')}
              </span>
            );
          }
          return (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(opt)}
                title={t('common.edit')}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                title={t('common.delete')}
                onClick={() => {
                  deleteMutation.mutate(opt.id, {
                    onSuccess: () => toast.success(t('master.toast.deleted')),
                    onError: (error) => {
                      const message =
                        error instanceof Error ? error.message : t('master.toast.deleteFailed');
                      toast.error(message);
                    },
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [onEdit, deleteMutation, t],
  );

  return (
    <div className="space-y-2">
      <DataTable columns={columns} data={data || []} />
      {loading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
      {!loading && data?.length === 0 && (
        <div className="text-sm text-gray-500">{t('master.empty')}</div>
      )}
    </div>
  );
}
