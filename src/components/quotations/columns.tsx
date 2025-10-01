'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Quotation } from '@/types/quotation';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Edit, Send, Printer, FileDown, MoreHorizontal, FileText } from 'lucide-react';

export function useQuotationColumns(): ColumnDef<Quotation>[] {
  const t = useT();

  const cols: ColumnDef<Quotation>[] = [
    {
      id: 'actions',
      enableHiding: false,
      header: '',
      meta: { sticky: 'left', width: 80, className: 'justify-center px-4 py-4' },
      cell: ({ row }) => {
        const quotation = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/quotations/${quotation.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Quotation
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Send className="mr-2 h-4 w-4" />
                Generate Offer
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.incoterm || '-'}</span>,
    },
    {
      accessorKey: 'type',
      header: t('filters.type'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.type || row.original.tmode || '-'}</span>
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
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.createdBy || '-'}</span>,
    },
  ];

  return cols;
}
