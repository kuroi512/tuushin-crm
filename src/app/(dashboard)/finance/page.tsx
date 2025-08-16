'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  DollarSign, 
  Receipt,
  CreditCard,
  TrendingDown,
  Eye,
  Edit,
  Download,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FinanceItem {
  id: string;
  type: 'INVOICE' | 'PAYABLE' | 'EXPENSE';
  number: string;
  shipmentNumber?: string;
  client?: string;
  supplier?: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  category: string;
  createdAt: string;
  createdBy: string;
}

export default function FinancePage() {
  const [financeItems] = useState<FinanceItem[]>([
    {
      id: '1',
      type: 'INVOICE',
      number: 'INV-2025-001',
      shipmentNumber: 'SHP-2025-001',
      client: 'Oyu Tolgoi LLC',
      description: 'Freight services for gold concentrate shipment',
      amount: 18750,
      currency: 'USD',
      dueDate: '2025-01-20',
      category: 'Freight Revenue',
      createdAt: '2025-01-08',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '2',
      type: 'INVOICE',
      number: 'INV-2025-002',
      shipmentNumber: 'SHP-2025-002',
      client: 'Erdenet Mining Corporation',
      description: 'Freight services for copper concentrate shipment',
      amount: 12500,
      currency: 'USD',
      dueDate: '2025-02-05',
      category: 'Freight Revenue',
      createdAt: '2025-01-10',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '3',
      type: 'PAYABLE',
      number: 'PAY-2025-001',
      supplier: 'Mongolia Railway Express',
      description: 'Railway transport charges - January 2025',
      amount: 5200,
      currency: 'USD',
      dueDate: '2025-01-15',
      category: 'Transport Costs',
      createdAt: '2025-01-02',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '4',
      type: 'PAYABLE',
      number: 'PAY-2025-002',
      supplier: 'Zamyn-Uud Customs Service',
      description: 'Customs brokerage fees - Q1 2025',
      amount: 1200,
      currency: 'USD',
      dueDate: '2025-01-31',
      category: 'Customs & Brokerage',
      createdAt: '2025-01-05',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '5',
      type: 'EXPENSE',
      number: 'EXP-2025-001',
      description: 'Fuel costs for truck fleet - January',
      amount: 2800,
      currency: 'USD',
      dueDate: '2025-01-10',
      category: 'Operational Costs',
      createdAt: '2025-01-05',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '6',
      type: 'INVOICE',
      number: 'INV-2024-089',
      shipmentNumber: 'SHP-2024-089',
      client: 'MAK LLC',
      description: 'Import logistics and customs clearance',
      amount: 4200,
      currency: 'USD',
      dueDate: '2025-01-05',
      category: 'Import Services',
      createdAt: '2024-12-20',
      createdBy: 'admin@freight.mn'
    }
  ]);

  const [showNewFinanceForm, setShowNewFinanceForm] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return <Receipt className="h-4 w-4 text-green-600" />;
      case 'PAYABLE':
        return <CreditCard className="h-4 w-4 text-red-600" />;
      case 'EXPENSE':
        return <TrendingDown className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const columns: ColumnDef<FinanceItem>[] = [
    {
      accessorKey: "number",
      header: "Number",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(row.original.type)}
          <span className="font-medium">{row.getValue("number")}</span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.getValue("type")}</span>
      ),
    },
    {
      accessorKey: "client",
      header: "Client/Supplier",
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.client || row.original.supplier}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">{row.getValue("description")}</div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <div className={`font-bold ${
          row.original.type === 'INVOICE' ? 'text-green-600' : 'text-red-600'
        }`}>
          {row.original.type === 'INVOICE' ? '+' : '-'}${row.getValue<number>("amount").toLocaleString()} {row.original.currency}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: ({ row }) => (
        <div className="text-sm">
          {new Date(row.getValue("dueDate")).toLocaleDateString()}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <div className="text-sm text-gray-500">
          {new Date(row.getValue("createdAt")).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-600">Manage invoices, payables, and financial records</p>
        </div>
        <Button 
          onClick={() => setShowNewFinanceForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Finance Record
        </Button>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Financial Records</CardTitle>
          <CardDescription>
            A list of all financial records with sorting and pagination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={financeItems}
            searchKey="description"
            searchPlaceholder="Search by number, client, supplier, or description..."
            enableRowReordering={false}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            enablePagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* New Finance Record Modal */}
      {showNewFinanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Finance Record</CardTitle>
              <CardDescription>Enter financial record details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md">
                    <option value="INVOICE">Invoice</option>
                    <option value="PAYABLE">Payable</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="number">Number</Label>
                  <Input id="number" placeholder="INV-2025-001" />
                </div>
                <div>
                  <Label htmlFor="client">Client/Supplier</Label>
                  <Input id="client" placeholder="Company name" />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" placeholder="1000" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" placeholder="Description of the transaction" />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" placeholder="e.g., Freight Revenue" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewFinanceForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setShowNewFinanceForm(false)}>
                  Create Record
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
