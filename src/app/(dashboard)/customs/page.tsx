'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  Building2, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Eye,
  Edit,
  Download,
  Upload,
  Flag,
  Search,
  MoreHorizontal,
  Calendar
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';

interface CustomsEntry {
  id: string;
  entryNumber: string;
  shipmentNumber: string;
  declarationType: 'EXPORT' | 'IMPORT' | 'TRANSIT';
  client: string;
  cargoDescription: string;
  hsCode: string;
  customsValue: number;
  currency: string;
  origin: string;
  destination: string;
  weight: number;
  status: 'PENDING' | 'PROCESSING' | 'EXAMINATION' | 'CLEARED' | 'REJECTED' | 'ON_HOLD';
  submittedDate: string;
  clearanceDate?: string;
  customsOffice: string;
  declarant: string;
  documents: {
    name: string;
    type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    uploadedDate: string;
  }[];
  fees: {
    type: string;
    amount: number;
    currency: string;
    paid: boolean;
  }[];
  createdAt: string;
  createdBy: string;
}

export default function CustomsPage() {
  const [customsEntries] = useState<CustomsEntry[]>([
    {
      id: '1',
      entryNumber: 'CUS-EX-2025-001',
      shipmentNumber: 'SHP-2025-001',
      declarationType: 'EXPORT',
      client: 'Oyu Tolgoi LLC',
      cargoDescription: 'Gold Concentrate in sealed containers',
      hsCode: '2616100000',
      customsValue: 850000,
      currency: 'USD',
      origin: 'South Gobi, Mongolia',
      destination: 'Shanghai Port, China',
      weight: 15000,
      status: 'CLEARED',
      submittedDate: '2025-01-06',
      clearanceDate: '2025-01-07',
      customsOffice: 'Zamyn-Uud Customs Office',
      declarant: 'ТУУШИН ХХК',
      documents: [
        {
          name: 'Commercial Invoice',
          type: 'INVOICE',
          status: 'APPROVED',
          uploadedDate: '2025-01-06T09:00:00Z'
        },
        {
          name: 'Packing List',
          type: 'PACKING_LIST',
          status: 'APPROVED',
          uploadedDate: '2025-01-06T09:05:00Z'
        },
        {
          name: 'Export License',
          type: 'LICENSE',
          status: 'APPROVED',
          uploadedDate: '2025-01-06T09:10:00Z'
        }
      ],
      fees: [
        {
          type: 'Export Declaration Fee',
          amount: 150,
          currency: 'USD',
          paid: true
        },
        {
          type: 'Inspection Fee',
          amount: 300,
          currency: 'USD',
          paid: true
        }
      ],
      createdAt: '2025-01-06',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '2',
      entryNumber: 'CUS-EX-2025-002',
      shipmentNumber: 'SHP-2025-002',
      declarationType: 'EXPORT',
      client: 'Erdenet Mining Corporation',
      cargoDescription: 'Copper Concentrate in bulk containers',
      hsCode: '2603000000',
      customsValue: 625000,
      currency: 'USD',
      origin: 'Ulaanbaatar, Mongolia',
      destination: 'Tianjin Port, China',
      weight: 25000,
      status: 'PROCESSING',
      submittedDate: '2025-01-09',
      customsOffice: 'Zamyn-Uud Customs Office',
      declarant: 'ТУУШИН ХХК',
      documents: [
        {
          name: 'Commercial Invoice',
          type: 'INVOICE',
          status: 'APPROVED',
          uploadedDate: '2025-01-09T10:00:00Z'
        },
        {
          name: 'Packing List',
          type: 'PACKING_LIST',
          status: 'PENDING',
          uploadedDate: '2025-01-09T10:15:00Z'
        },
        {
          name: 'Mining Certificate',
          type: 'CERTIFICATE',
          status: 'APPROVED',
          uploadedDate: '2025-01-09T10:30:00Z'
        }
      ],
      fees: [
        {
          type: 'Export Declaration Fee',
          amount: 200,
          currency: 'USD',
          paid: false
        }
      ],
      createdAt: '2025-01-09',
      createdBy: 'admin@freight.mn'
    },
    {
      id: '3',
      entryNumber: 'CUS-IM-2025-001',
      shipmentNumber: 'SHP-2024-089',
      declarationType: 'IMPORT',
      client: 'MAK LLC',
      cargoDescription: 'Machinery Parts and Equipment',
      hsCode: '8479899000',
      customsValue: 125000,
      currency: 'USD',
      origin: 'Tianjin, China',
      destination: 'Darkhan, Mongolia',
      weight: 5500,
      status: 'ON_HOLD',
      submittedDate: '2025-01-08',
      customsOffice: 'Zamyn-Uud Customs Office',
      declarant: 'ТУУШИН ХХК',
      documents: [
        {
          name: 'Commercial Invoice',
          type: 'INVOICE',
          status: 'APPROVED',
          uploadedDate: '2025-01-08T14:00:00Z'
        },
        {
          name: 'Bill of Lading',
          type: 'BOL',
          status: 'REJECTED',
          uploadedDate: '2025-01-08T14:05:00Z'
        }
      ],
      fees: [
        {
          type: 'Import Duty',
          amount: 12500,
          currency: 'USD',
          paid: false
        },
        {
          type: 'VAT',
          amount: 25000,
          currency: 'MNT',
          paid: false
        }
      ],
      createdAt: '2025-01-08',
      createdBy: 'admin@freight.mn'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSING':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'EXAMINATION':
        return <Eye className="h-4 w-4 text-orange-500" />;
      case 'CLEARED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECTED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'ON_HOLD':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Building2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'EXAMINATION':
        return 'bg-orange-100 text-orange-800';
      case 'CLEARED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'ON_HOLD':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeclarationTypeIcon = (type: string) => {
    switch (type) {
      case 'EXPORT':
        return <Flag className="h-4 w-4 text-green-600" />;
      case 'IMPORT':
        return <Flag className="h-4 w-4 text-blue-600" />;
      case 'TRANSIT':
        return <Flag className="h-4 w-4 text-purple-600" />;
      default:
        return <Building2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredEntries = customsEntries.filter(entry => {
    const matchesSearch = entry.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.cargoDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.hsCode.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || entry.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || entry.declarationType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const statusCounts = {
    ALL: customsEntries.length,
    PENDING: customsEntries.filter(e => e.status === 'PENDING').length,
    PROCESSING: customsEntries.filter(e => e.status === 'PROCESSING').length,
    EXAMINATION: customsEntries.filter(e => e.status === 'EXAMINATION').length,
    CLEARED: customsEntries.filter(e => e.status === 'CLEARED').length,
    REJECTED: customsEntries.filter(e => e.status === 'REJECTED').length,
    ON_HOLD: customsEntries.filter(e => e.status === 'ON_HOLD').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customs</h1>
          <p className="text-gray-600">Manage customs declarations and clearances</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Declaration
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card 
            key={status}
            className={`cursor-pointer transition-all ${
              statusFilter === status ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
            }`}
            onClick={() => setStatusFilter(status)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {status.toLowerCase().replace('_', ' ')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by entry number, client, cargo, or HS code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="EXAMINATION">Examination</SelectItem>
                <SelectItem value="CLEARED">Cleared</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
                <SelectItem value="IMPORT">Import</SelectItem>
                <SelectItem value="TRANSIT">Transit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customs Entries List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customs entries found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first customs declaration to get started'
                }
              </p>
              {!searchTerm && statusFilter === 'ALL' && typeFilter === 'ALL' && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Declaration
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {entry.entryNumber}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(entry.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                          {entry.status.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1">
                          {getDeclarationTypeIcon(entry.declarationType)}
                          <span className="text-xs text-gray-600">{entry.declarationType}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-600 font-medium">{entry.client}</p>
                    <p className="text-sm text-gray-500">Shipment: {entry.shipmentNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Cargo:</span>
                    <p className="font-medium">{entry.cargoDescription}</p>
                    <p className="text-xs text-gray-400">HS Code: {entry.hsCode}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Customs Value:</span>
                    <p className="font-medium text-green-600">
                      {entry.customsValue.toLocaleString()} {entry.currency}
                    </p>
                    <p className="text-xs text-gray-400">Weight: {entry.weight.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Route:</span>
                    <p className="font-medium">{entry.origin} → {entry.destination}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Customs Office:</span>
                    <p className="font-medium">{entry.customsOffice}</p>
                    <p className="text-xs text-gray-400">Declarant: {entry.declarant}</p>
                  </div>
                </div>

                {/* Documents Status */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documents ({entry.documents.length})
                    </h4>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {entry.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.type}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fees */}
                {entry.fees.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Customs Fees ({entry.fees.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {entry.fees.map((fee, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <p className="text-sm font-medium">{fee.type}</p>
                            <p className="text-sm font-medium text-blue-600">
                              {fee.amount.toLocaleString()} {fee.currency}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            fee.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {fee.paid ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>Submitted: {new Date(entry.submittedDate).toLocaleDateString()}</span>
                    {entry.clearanceDate && (
                      <span className="text-green-600">
                        Cleared: {new Date(entry.clearanceDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.status === 'PENDING' && (
                      <Button variant="outline" size="sm">
                        Submit to Customs
                      </Button>
                    )}
                    {entry.status === 'CLEARED' && (
                      <Button size="sm">
                        Generate Certificate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
