'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Ship, 
  Building2, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus
} from 'lucide-react';
import { KpiStrip } from '@/components/dashboard/KpiStrip';

interface DashboardStats {
  quotations: {
    total: number;
    draft: number;
    approved: number;
    converted: number;
  };
  shipments: {
    total: number;
    inTransit: number;
    delivered: number;
    delayed: number;
  };
  customs: {
    pending: number;
    cleared: number;
    processing: number;
  };
  finance: {
    totalRevenue: number;
    pendingInvoices: number;
    paidInvoices: number;
    overduePayments: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    quotations: { total: 45, draft: 12, approved: 18, converted: 15 },
    shipments: { total: 32, inTransit: 14, delivered: 16, delayed: 2 },
    customs: { pending: 8, cleared: 24, processing: 5 },
    finance: { totalRevenue: 125000, pendingInvoices: 8, paidInvoices: 28, overduePayments: 3 }
  });

  const [recentActivities] = useState([
    {
      id: 1,
      type: 'quotation',
      title: 'New quotation created',
      description: 'QUO-2025-001 for Erdenet Mining Corp',
      time: '2 minutes ago',
      status: 'draft'
    },
    {
      id: 2,
      type: 'shipment',
      title: 'Shipment arrived',
      description: 'SHP-2025-005 arrived at Zamyn-Uud port',
      time: '1 hour ago',
      status: 'completed'
    },
    {
      id: 3,
      type: 'customs',
      title: 'Customs clearance completed',
      description: 'CUS-2025-012 cleared for delivery',
      time: '3 hours ago',
      status: 'cleared'
    },
    {
      id: 4,
      type: 'finance',
      title: 'Invoice payment received',
      description: 'INV-2025-028 payment of $15,000 received',
      time: '5 hours ago',
      status: 'paid'
    }
  ]);

  return (
    <div className="space-y-6">
      {/* KPI strip like the client's system (large) */}
      <div className="rounded-md border bg-white p-3 shadow-sm">
        <KpiStrip compact={false} />
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">ТУУШИН ХХК Freight Management System Overview</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quotations</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quotations.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.quotations.draft} draft, {stats.quotations.approved} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipments in Transit</CardTitle>
            <Ship className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shipments.inTransit}</div>
            <p className="text-xs text-muted-foreground">
              {stats.shipments.total} total shipments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customs Pending</CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customs.pending}</div>
            <p className="text-xs text-muted-foreground">
              {stats.customs.processing} in processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.finance.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.finance.pendingInvoices} pending invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Status</CardTitle>
            <CardDescription>Current status of operations workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Quotations</p>
                  <p className="text-sm text-gray-500">{stats.quotations.draft} awaiting approval</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{stats.quotations.draft}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Ship className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Shipments</p>
                  <p className="text-sm text-gray-500">{stats.shipments.inTransit} in transit</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{stats.shipments.inTransit}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-gray-900">Customs</p>
                  <p className="text-sm text-gray-500">{stats.customs.pending} pending clearance</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{stats.customs.pending}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Finance</p>
                  <p className="text-sm text-gray-500">{stats.finance.overduePayments} overdue payments</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{stats.finance.paidInvoices}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates from all modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <div className={`p-2 rounded-full ${
                    activity.type === 'quotation' ? 'bg-blue-100' :
                    activity.type === 'shipment' ? 'bg-green-100' :
                    activity.type === 'customs' ? 'bg-orange-100' :
                    'bg-purple-100'
                  }`}>
                    {activity.type === 'quotation' && <FileText className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'shipment' && <Ship className="h-4 w-4 text-green-600" />}
                    {activity.type === 'customs' && <Building2 className="h-4 w-4 text-orange-600" />}
                    {activity.type === 'finance' && <DollarSign className="h-4 w-4 text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                    activity.status === 'cleared' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {activity.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <FileText className="h-6 w-6" />
              <span>New Quotation</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Ship className="h-6 w-6" />
              <span>Track Shipment</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Building2 className="h-6 w-6" />
              <span>Customs Status</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <DollarSign className="h-6 w-6" />
              <span>Generate Invoice</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
