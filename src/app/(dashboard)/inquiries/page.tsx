'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  Building2, 
  Package, 
  Globe,
  Calendar,
  Users,
  MoreHorizontal,
  Eye,
  Edit,
  Archive,
  SendIcon,
  Flag
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Inquiry {
  id: string;
  code: string;
  name: string;
  status: string;
  transportMode: string;
  priority: string;
  customer: {
    id: string;
    companyName: string;
    contactPerson?: string;
  };
  salesPerson?: {
    id: string;
    name: string;
    email: string;
  };
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  commodityType: string;
  validityDate?: string;
  createdAt: string;
  _count: {
    communications: number;
    attachments: number;
    quotations: number;
  };
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInquiryForm, setShowNewInquiryForm] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inquiries');
      if (response.ok) {
        const data = await response.json();
        setInquiries(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
      QUOTED: 'bg-green-100 text-green-800',
      APPROVED: 'bg-green-500 text-white',
      CONVERTED: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-500',
      CLOSED: 'bg-gray-500 text-white',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const priorityColors: { [key: string]: string } = {
      LOW: 'bg-green-100 text-green-700',
      MEDIUM: 'bg-yellow-100 text-yellow-700',
      HIGH: 'bg-orange-100 text-orange-700',
      URGENT: 'bg-red-100 text-red-700',
    };
    return priorityColors[priority] || 'bg-gray-100 text-gray-700';
  };

  const getTransportIcon = (mode: string) => {
    switch (mode) {
      case 'AIR':
        return '✈️';
      case 'SEA':
        return '🚢';
      case 'ROAD':
        return '🚛';
      case 'RAIL':
        return '🚂';
      case 'MULTIMODAL':
        return '🔄';
      case 'COURIER':
        return '📦';
      default:
        return '🚛';
    }
  };

  const columns: ColumnDef<Inquiry>[] = [
    {
      accessorKey: "code",
      header: "Inquiry Code",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{row.getValue("code")}</span>
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Inquiry Name",
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <div className="font-medium truncate">{row.getValue("name")}</div>
          <div className="text-xs text-gray-500">{row.original.commodityType}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={getStatusColor(row.getValue("status"))}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <Badge variant="outline" className={getPriorityColor(row.getValue("priority"))}>
          {row.getValue("priority")}
        </Badge>
      ),
    },
    {
      accessorKey: "transportMode",
      header: "Transport",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{getTransportIcon(row.getValue("transportMode"))}</span>
          <span className="text-sm">{row.getValue("transportMode")}</span>
        </div>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <div>
            <div className="font-medium">{row.original.customer.companyName}</div>
            {row.original.customer.contactPerson && (
              <div className="text-xs text-gray-500">{row.original.customer.contactPerson}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "route",
      header: "Route",
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-green-600" />
            <span>{row.original.originCity}, {row.original.originCountry}</span>
          </div>
          <div className="text-gray-400 text-xs">↓</div>
          <div className="flex items-center gap-1">
            <Flag className="h-3 w-3 text-red-600" />
            <span>{row.original.destinationCity}, {row.original.destinationCountry}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "salesPerson",
      header: "Sales Person",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm">
            {row.original.salesPerson?.name || 'Unassigned'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "validityDate",
      header: "Valid Until",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm">
            {row.getValue("validityDate") 
              ? new Date(row.getValue("validityDate")).toLocaleDateString()
              : 'No limit'
            }
          </span>
        </div>
      ),
    },
    {
      accessorKey: "activity",
      header: "Activity",
      cell: ({ row }) => (
        <div className="flex gap-1 text-xs">
          <Badge variant="secondary">{row.original._count.communications} msgs</Badge>
          <Badge variant="secondary">{row.original._count.attachments} files</Badge>
          <Badge variant="secondary">{row.original._count.quotations} quotes</Badge>
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
        const inquiry = row.original;
        
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
                Edit Inquiry
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SendIcon className="mr-2 h-4 w-4" />
                Create Quote
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Archive className="mr-2 h-4 w-4" />
                Archive
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
          <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="text-gray-600">Manage customer freight inquiries and quotations</p>
        </div>
        <Dialog open={showNewInquiryForm} onOpenChange={setShowNewInquiryForm}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Inquiry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Inquiry</DialogTitle>
              <DialogDescription>
                Enter the details for a new freight inquiry.
              </DialogDescription>
            </DialogHeader>
            <NewInquiryForm onClose={() => setShowNewInquiryForm(false)} onSuccess={fetchInquiries} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Inquiries</p>
                <p className="text-2xl font-bold text-gray-900">{inquiries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Under Review</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inquiries.filter(i => i.status === 'UNDER_REVIEW').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <SendIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Quoted</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inquiries.filter(i => i.status === 'QUOTED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Flag className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Converted</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inquiries.filter(i => i.status === 'CONVERTED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Inquiries</CardTitle>
          <CardDescription>
            A list of all freight inquiries with advanced filtering and sorting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={inquiries}
            searchKey="name"
            searchPlaceholder="Search by inquiry name, customer, or commodity..."
            enableRowReordering={false}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            enablePagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// New Inquiry Form Component
function NewInquiryForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    customerId: '',
    commodityType: '',
    cargoDescription: '',
    transportMode: 'ROAD',
    incoterm: 'EXW',
    originCountry: '',
    originCity: '',
    destinationCountry: '',
    destinationCity: '',
    priority: 'MEDIUM',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        console.error('Error creating inquiry:', error);
        alert('Error creating inquiry: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating inquiry:', error);
      alert('Error creating inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Inquiry Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Mining Equipment to China"
            required
          />
        </div>

        <div>
          <Label htmlFor="customerId">Customer ID *</Label>
          <Input
            id="customerId"
            value={formData.customerId}
            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            placeholder="Enter customer ID"
            required
          />
        </div>

        <div>
          <Label htmlFor="commodityType">Commodity Type *</Label>
          <Input
            id="commodityType"
            value={formData.commodityType}
            onChange={(e) => setFormData({ ...formData, commodityType: e.target.value })}
            placeholder="e.g., Machinery, Electronics, Raw Materials"
            required
          />
        </div>

        <div>
          <Label htmlFor="transportMode">Transport Mode *</Label>
          <select
            id="transportMode"
            value={formData.transportMode}
            onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
            className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md"
            required
          >
            <option value="ROAD">Road</option>
            <option value="RAIL">Rail</option>
            <option value="AIR">Air</option>
            <option value="SEA">Sea</option>
            <option value="MULTIMODAL">Multimodal</option>
            <option value="COURIER">Courier</option>
          </select>
        </div>

        <div>
          <Label htmlFor="incoterm">Incoterm *</Label>
          <select
            id="incoterm"
            value={formData.incoterm}
            onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
            className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md"
            required
          >
            <option value="EXW">EXW - Ex Works</option>
            <option value="FCA">FCA - Free Carrier</option>
            <option value="CPT">CPT - Carriage Paid To</option>
            <option value="CIP">CIP - Carriage and Insurance Paid To</option>
            <option value="DAP">DAP - Delivered At Place</option>
            <option value="DPU">DPU - Delivered At Place Unloaded</option>
            <option value="DDP">DDP - Delivered Duty Paid</option>
            <option value="FAS">FAS - Free Alongside Ship</option>
            <option value="FOB">FOB - Free On Board</option>
            <option value="CFR">CFR - Cost and Freight</option>
            <option value="CIF">CIF - Cost, Insurance and Freight</option>
          </select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div>
          <Label htmlFor="originCountry">Origin Country *</Label>
          <Input
            id="originCountry"
            value={formData.originCountry}
            onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
            placeholder="e.g., Mongolia"
            required
          />
        </div>

        <div>
          <Label htmlFor="originCity">Origin City *</Label>
          <Input
            id="originCity"
            value={formData.originCity}
            onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
            placeholder="e.g., Ulaanbaatar"
            required
          />
        </div>

        <div>
          <Label htmlFor="destinationCountry">Destination Country *</Label>
          <Input
            id="destinationCountry"
            value={formData.destinationCountry}
            onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
            placeholder="e.g., China"
            required
          />
        </div>

        <div>
          <Label htmlFor="destinationCity">Destination City *</Label>
          <Input
            id="destinationCity"
            value={formData.destinationCity}
            onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
            placeholder="e.g., Beijing"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cargoDescription">Cargo Description</Label>
        <textarea
          id="cargoDescription"
          value={formData.cargoDescription}
          onChange={(e) => setFormData({ ...formData, cargoDescription: e.target.value })}
          placeholder="Detailed description of the cargo..."
          className="w-full min-h-[100px] px-3 py-2 text-sm bg-background border border-input rounded-md"
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Inquiry'}
        </Button>
      </div>
    </form>
  );
}
