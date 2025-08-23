"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Quotation } from "@/types/quotation";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Edit, Send, Printer, FileDown, MoreHorizontal, FileText } from "lucide-react";

export function useQuotationColumns(): ColumnDef<Quotation>[] {
  const t = useT();

  const cols: ColumnDef<Quotation>[] = [
    {
      id: "actions",
      enableHiding: false,
      header: '',
      meta: { sticky: 'left', width: 64, className: 'justify-center' },
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
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit Quotation
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
      accessorKey: "quotationNumber",
      header: t('columns.quotationNumber'),
      enableHiding: false,
      meta: { sticky: 'left', width: 160 },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{row.getValue("quotationNumber")}</span>
        </div>
      ),
    },
    { accessorKey: 'registrationNo', header: t('filters.registrationNo'), cell: ({ row }) => row.original.registrationNo ?? row.original.quotationNumber ?? '-' },
    { accessorKey: 'containerOrWagon', header: t('filters.containerOrWagon') },
    { accessorKey: 'incoterm', header: t('filters.incoterm') },
    { accessorKey: 'type', header: t('filters.type') },
    { accessorKey: 'ownership', header: t('filters.ownership') },
    { accessorKey: 'releaseOrder', header: t('filters.releaseOrder') },
    { accessorKey: 'shipper', header: t('filters.shipper') },
    { accessorKey: 'country', header: t('filters.country') },
    { accessorKey: 'cr', header: t('filters.cr') },
    { accessorKey: 'crDays', header: t('filters.crDays') },
    { accessorKey: 'carrier', header: t('filters.carrier') },
    { id: 'from', header: t('filters.from'), accessorFn: (row) => row.origin },
    { id: 'to', header: t('filters.to'), accessorFn: (row) => row.destination },
    { accessorKey: 'agent1', header: t('filters.agent1') },
    { accessorKey: 'agent2', header: t('filters.agent2') },
    { accessorKey: 'agent3', header: t('filters.agent3') },
    { accessorKey: 'responsibleSpecialist', header: t('filters.responsibleSpecialist') },
    { accessorKey: 'loadedDate', header: t('filters.loadedDate') },
    { accessorKey: 'transitWh', header: t('filters.transitWH') },
    { accessorKey: 'arrivedAtTransitWhDate', header: t('filters.arrivedAtTransitWHDate') },
    { accessorKey: 'loadedFromTransitWhDate', header: t('filters.loadedFromTransitWHDate') },
    { accessorKey: 'arrivedAtBorderDate', header: t('filters.arrivedAtBorderDate') },
    { accessorKey: 'departedBorderDate', header: t('filters.departedBorderDate') },
    { accessorKey: 'arrivedInUBDate', header: t('filters.arrivedInUBDate') },
    { accessorKey: 'unloadingYard', header: t('filters.unloadingYard') },
    { accessorKey: 'devannedDate', header: t('filters.devannedDate') },
    { accessorKey: 'emptyReturnedDate', header: t('filters.emptyReturnedDate') },
    { accessorKey: 'wagonNoEmptyReturn', header: t('filters.wagonNoEmptyReturn') },
    { accessorKey: 'returnArrivedAtBorderDate', header: t('filters.returnArrivedAtBorderDate') },
    { accessorKey: 'returnDepartedBorderDate', header: t('filters.returnDepartedBorderDate') },
    { accessorKey: 'exportedDate', header: t('filters.exportedDate') },
    { accessorKey: 'transferredToOthersDate', header: t('filters.transferredToOthersDate') },
    { accessorKey: 'transferNote', header: t('filters.transferNote') },
    { accessorKey: 'transferredTo', header: t('filters.transferredTo') },
    { accessorKey: 'salesManager', header: t('filters.salesManager') },
    { accessorKey: 'goods', header: t('filters.goods') },
    { accessorKey: 'salesDate', header: t('filters.salesDate') },
    { accessorKey: 'freightCharge', header: t('filters.freightCharge'), cell: ({ row }) => {
      const value = row.original.freightCharge ?? row.original.estimatedCost;
      return typeof value === 'number' ? (
        <span className="text-green-600 font-medium">${value.toLocaleString()}</span>
      ) : '-';
    } },
    { accessorKey: 'paidDate', header: t('filters.paidDate') },
    { accessorKey: 'paymentStatus', header: t('filters.paymentStatus') },
    { accessorKey: 'amountPaid', header: t('filters.amountPaid') },
    { accessorKey: 'createdBy', header: t('filters.createdBy') },
    { accessorKey: "client", header: t('columns.client') },
    { accessorKey: "cargoType", header: t('columns.cargoType') },
    { accessorKey: "origin", header: t('columns.route'), cell: ({ row }) => (
      <div className="text-sm">{row.getValue("origin")} → {row.original.destination}</div>
    ) },
    { accessorKey: "weight", header: t('columns.weightVolume'), cell: ({ row }) => (
      <div className="text-sm">
        {typeof row.getValue<number>("weight") === 'number' ? row.getValue<number>("weight").toLocaleString() + ' kg' : '-'}
        <br />
        <span className="text-gray-500">{typeof row.original.volume === 'number' ? row.original.volume : '-'} m³</span>
      </div>
    ) },
    { accessorKey: "estimatedCost", header: t('columns.estimatedCost'), cell: ({ row }) => (
      <div className="font-medium text-green-600">${row.getValue<number>("estimatedCost").toLocaleString()}</div>
    ) },
    { accessorKey: "createdAt", header: t('columns.created'), cell: ({ row }) => (
      <div className="text-sm text-gray-500">{new Date(row.getValue("createdAt")).toLocaleDateString()}</div>
    ) },
  ];

  return cols;
}
