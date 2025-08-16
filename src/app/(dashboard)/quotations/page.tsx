'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  FileText, 
  Eye, 
  Edit, 
  Send,
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

interface Quotation {
  id: string;
  quotationNumber: string;
  client: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight: number;
  volume: number;
  estimatedCost: number;
  createdAt: string;
  createdBy: string;
}

export default function QuotationsPage() {
  const [quotations] = useState<Quotation[]>([
    {
      id: '1',
      quotationNumber: 'QUO-2025-001',
      client: 'Erdenet Mining Corporation',
      origin: 'Ulaanbaatar, Mongolia',
      destination: 'Tianjin Port, China',
      cargoType: 'Copper Concentrate',
      weight: 25000,
      volume: 45.5,
      estimatedCost: 12500,
      createdAt: '2025-01-01',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '2',
      quotationNumber: 'QUO-2025-002',
      client: 'Oyu Tolgoi LLC',
      origin: 'South Gobi, Mongolia',
      destination: 'Shanghai Port, China',
      cargoType: 'Gold Concentrate',
      weight: 15000,
      volume: 32.8,
      estimatedCost: 18750,
      createdAt: '2025-01-02',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '3',
      quotationNumber: 'QUO-2025-003',
      client: 'MAK LLC',
      origin: 'Darkhan, Mongolia',
      destination: 'Zamyn-Uud Border',
      cargoType: 'Steel Products',
      weight: 8500,
      volume: 28.2,
      estimatedCost: 4200,
      createdAt: '2025-01-03',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '4',
      quotationNumber: 'QUO-2025-004',
      client: 'Tavan Tolgoi JSC',
      origin: 'Tsogttsetsii, Mongolia',
      destination: 'Beijing, China',
      cargoType: 'Coal',
      weight: 30000,
      volume: 55.2,
      estimatedCost: 15800,
      createdAt: '2025-01-04',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '5',
      quotationNumber: 'QUO-2025-005',
      client: 'Gobi Steel LLC',
      origin: 'Darkhan, Mongolia',
      destination: 'Erenhot, China',
      cargoType: 'Steel Rebar',
      weight: 12000,
      volume: 38.4,
      estimatedCost: 6800,
      createdAt: '2025-01-05',
      createdBy: 'admin@freight.mn'
    }
  ]);

  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);

  const columns: ColumnDef<Quotation>[] = [
    {
      accessorKey: "quotationNumber",
      header: "Quotation #",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{row.getValue("quotationNumber")}</span>
        </div>
      ),
    },
    {
      accessorKey: "client",
      header: "Client",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("client")}</div>
      ),
    },
    {
      accessorKey: "cargoType",
      header: "Cargo Type",
    },
    {
      accessorKey: "origin",
      header: "Route",
      cell: ({ row }) => (
        <div className="text-sm">
          {row.getValue("origin")} → {row.original.destination}
        </div>
      ),
    },
    {
      accessorKey: "weight",
      header: "Weight/Volume", 
      cell: ({ row }) => (
        <div className="text-sm">
          {row.getValue<number>("weight").toLocaleString()} kg<br />
          <span className="text-gray-500">{row.original.volume} m³</span>
        </div>
      ),
    },
    {
      accessorKey: "estimatedCost",
      header: "Estimated Cost",
      cell: ({ row }) => (
        <div className="font-medium text-green-600">
          ${row.getValue<number>("estimatedCost").toLocaleString()}
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
        const quotation = row.original;
        
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
                Edit Quotation
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Send className="mr-2 h-4 w-4" />
                Convert to Shipment
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
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-600">Manage freight quotations and pricing</p>
        </div>
        <Button 
          onClick={() => setShowNewQuotationForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Quotations</CardTitle>
          <CardDescription>
            A list of all quotations with sorting and pagination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={quotations}
            searchKey="client"
            searchPlaceholder="Search by client, quotation number, or cargo type..."
            enableRowReordering={false}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            enablePagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* New Quotation Modal */}
      {showNewQuotationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Quotation</CardTitle>
              <CardDescription>Enter quotation details for freight services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Input id="client" placeholder="Client company name" />
                </div>
                <div>
                  <Label htmlFor="cargoType">Cargo Type</Label>
                  <Input id="cargoType" placeholder="e.g., Copper Concentrate" />
                </div>
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input id="origin" placeholder="Origin location" />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input id="destination" placeholder="Destination location" />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" placeholder="25000" />
                </div>
                <div>
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input id="volume" type="number" step="0.1" placeholder="45.5" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewQuotationForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setShowNewQuotationForm(false)}>
                  Create Quotation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
