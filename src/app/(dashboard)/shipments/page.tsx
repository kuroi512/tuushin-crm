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
  Ship, 
  Truck,
  Plane,
  Package,
  Eye,
  Edit,
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

interface Shipment {
  id: string;
  shipmentNumber: string;
  quotationNumber: string;
  client: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight: number;
  volume: number;
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SEA' | 'MULTIMODAL';
  estimatedDelivery: string;
  createdAt: string;
  createdBy: string;
}

export default function ShipmentsPage() {
  const [shipments] = useState<Shipment[]>([
    {
      id: '1',
      shipmentNumber: 'SHP-2025-001',
      quotationNumber: 'QUO-2025-002',
      client: 'Oyu Tolgoi LLC',
      origin: 'South Gobi, Mongolia',
      destination: 'Shanghai Port, China',
      cargoType: 'Gold Concentrate',
      weight: 15000,
      volume: 32.8,
      transportMode: 'MULTIMODAL',
      estimatedDelivery: '2025-01-15',
      createdAt: '2025-01-05',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '2',
      shipmentNumber: 'SHP-2025-002',
      quotationNumber: 'QUO-2025-001',
      client: 'Erdenet Mining Corporation',
      origin: 'Ulaanbaatar, Mongolia',
      destination: 'Tianjin Port, China',
      cargoType: 'Copper Concentrate',
      weight: 25000,
      volume: 45.5,
      transportMode: 'ROAD',
      estimatedDelivery: '2025-01-20',
      createdAt: '2025-01-06',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '3',
      shipmentNumber: 'SHP-2025-003',
      quotationNumber: 'QUO-2025-004',
      client: 'Tavan Tolgoi JSC',
      origin: 'Tsogttsetsii, Mongolia',
      destination: 'Beijing, China',
      cargoType: 'Coal',
      weight: 30000,
      volume: 55.2,
      transportMode: 'RAIL',
      estimatedDelivery: '2025-01-18',
      createdAt: '2025-01-07',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '4',
      shipmentNumber: 'SHP-2025-004',
      quotationNumber: 'QUO-2025-003',
      client: 'MAK LLC',
      origin: 'Darkhan, Mongolia',
      destination: 'Zamyn-Uud Border',
      cargoType: 'Steel Products',
      weight: 8500,
      volume: 28.2,
      transportMode: 'ROAD',
      estimatedDelivery: '2025-01-12',
      createdAt: '2025-01-08',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '5',
      shipmentNumber: 'SHP-2025-005',
      quotationNumber: 'QUO-2025-005',
      client: 'Gobi Steel LLC',
      origin: 'Darkhan, Mongolia',
      destination: 'Erenhot, China',
      cargoType: 'Steel Rebar',
      weight: 12000,
      volume: 38.4,
      transportMode: 'ROAD',
      estimatedDelivery: '2025-01-14',
      createdAt: '2025-01-09',
      createdBy: 'admin@freight.mn'
    }
  ]);

  const [showNewShipmentForm, setShowNewShipmentForm] = useState(false);

  const getTransportIcon = (mode: string) => {
    switch (mode) {
      case 'ROAD':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'RAIL':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'AIR':
        return <Plane className="h-4 w-4 text-purple-600" />;
      case 'SEA':
        return <Ship className="h-4 w-4 text-cyan-600" />;
      case 'MULTIMODAL':
        return <Ship className="h-4 w-4 text-orange-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  const columns: ColumnDef<Shipment>[] = [
    {
      accessorKey: "shipmentNumber",
      header: "Shipment #",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{row.getValue("shipmentNumber")}</span>
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
      accessorKey: "transportMode",
      header: "Transport",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getTransportIcon(row.getValue("transportMode"))}
          <span className="text-sm">{row.getValue("transportMode")}</span>
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
      accessorKey: "estimatedDelivery",
      header: "Est. Delivery",
      cell: ({ row }) => (
        <div className="text-sm">
          {new Date(row.getValue("estimatedDelivery")).toLocaleDateString()}
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
        const shipment = row.original;
        
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
                Edit Shipment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Package className="mr-2 h-4 w-4" />
                Track Shipment
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
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600">Track and manage active shipments</p>
        </div>
        <Button 
          onClick={() => setShowNewShipmentForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Shipment
        </Button>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
          <CardDescription>
            A list of all shipments with sorting and pagination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={shipments}
            searchKey="client"
            searchPlaceholder="Search by client, shipment number, or cargo type..."
            enableRowReordering={false}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            enablePagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* New Shipment Modal */}
      {showNewShipmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Shipment</CardTitle>
              <CardDescription>Enter shipment details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quotationNumber">Quotation Number</Label>
                  <Input id="quotationNumber" placeholder="QUO-2025-001" />
                </div>
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Input id="client" placeholder="Client company name" />
                </div>
                <div>
                  <Label htmlFor="cargoType">Cargo Type</Label>
                  <Input id="cargoType" placeholder="e.g., Copper Concentrate" />
                </div>
                <div>
                  <Label htmlFor="transportMode">Transport Mode</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select transport mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROAD">Road</SelectItem>
                      <SelectItem value="RAIL">Rail</SelectItem>
                      <SelectItem value="AIR">Air</SelectItem>
                      <SelectItem value="SEA">Sea</SelectItem>
                      <SelectItem value="MULTIMODAL">Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
                  <Input id="estimatedDelivery" type="date" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewShipmentForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setShowNewShipmentForm(false)}>
                  Create Shipment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
