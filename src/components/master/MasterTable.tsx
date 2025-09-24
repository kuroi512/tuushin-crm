'use client';

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MasterOption, useDeleteMasterOption } from './hooks';
import { Lock, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface MasterTableProps {
  data: MasterOption[] | undefined;
  loading: boolean;
  onEdit: (row: MasterOption) => void;
}

export function MasterTable({ data = [], loading, onEdit }: MasterTableProps) {
  const deleteMutation = useDeleteMasterOption(data[0]?.category);

  const columns = useMemo<ColumnDef<MasterOption, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.original.name}</span>
            {!row.original.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
        ),
      },
      {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => row.original.code || '-',
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <Badge variant={row.original.source === 'EXTERNAL' ? 'outline' : 'default'}>
            {row.original.source}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const opt = row.original;
          const isLocked = opt.source === 'EXTERNAL';
          return (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked}
                onClick={() => onEdit(opt)}
                title={isLocked ? 'External option - read only' : 'Edit'}
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLocked || deleteMutation.isPending}
                title={isLocked ? 'External option - cannot delete' : 'Delete'}
                onClick={() => {
                  deleteMutation.mutate(opt.id, {
                    onSuccess: () => toast.success('Deleted'),
                    onError: (e: any) => toast.error(e.message || 'Delete failed'),
                  });
                }}
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [onEdit, deleteMutation.isPending],
  );

  return (
    <div className="space-y-2">
      <DataTable columns={columns} data={data || []} />
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {!loading && data?.length === 0 && <div className="text-sm text-gray-500">No options.</div>}
    </div>
  );
}
