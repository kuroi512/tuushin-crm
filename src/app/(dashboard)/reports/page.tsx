'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download,
  FileText,
  Calendar,
  Filter,
  Eye,
  DollarSign,
  Ship,
  Building2,
  Users
} from 'lucide-react';

interface ReportData {
  period: string;
  quotations: number;
  shipments: number;
  revenue: number;
  costs: number;
  profit: number;
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState('2025');
  
  // Mock data for reports
  const monthlyData: ReportData[] = [
    { period: 'Jan 2025', quotations: 45, shipments: 32, revenue: 125000, costs: 85000, profit: 40000 },
    { period: 'Dec 2024', quotations: 38, shipments: 28, revenue: 115000, costs: 78000, profit: 37000 },
    { period: 'Nov 2024', quotations: 42, shipments: 35, revenue: 135000, costs: 92000, profit: 43000 },
    { period: 'Oct 2024', quotations: 51, shipments: 39, revenue: 145000, costs: 98000, profit: 47000 }
  ];

  const clientPerformance = [
    { client: 'Oyu Tolgoi LLC', shipments: 8, revenue: 45000, status: 'Active' },
    { client: 'Erdenet Mining Corporation', shipments: 12, revenue: 38000, status: 'Active' },
    { client: 'MAK LLC', shipments: 6, revenue: 22000, status: 'Active' },
    { client: 'TT Mining', shipments: 4, revenue: 15000, status: 'Inactive' },
    { client: 'Gobi Steel', shipments: 2, revenue: 8000, status: 'New' }
  ];

  const routePerformance = [
    { route: 'Mongolia → China', shipments: 24, revenue: 85000, avgTime: '7 days' },
    { route: 'China → Mongolia', shipments: 8, revenue: 28000, avgTime: '5 days' },
    { route: 'Domestic (Mongolia)', shipments: 6, revenue: 12000, avgTime: '2 days' }
  ];

  const reportTypes = [
    {
      id: 'operational',
      title: 'Operational Report',
      description: 'Quotations, shipments, and delivery performance',
      icon: <Ship className="h-8 w-8 text-blue-600" />,
      metrics: ['Total Quotations', 'Completed Shipments', 'On-time Delivery %', 'Avg Transit Time']
    },
    {
      id: 'financial',
      title: 'Financial Report',
      description: 'Revenue, costs, profit margins, and billing analysis',
      icon: <DollarSign className="h-8 w-8 text-green-600" />,
      metrics: ['Total Revenue', 'Operating Costs', 'Profit Margin', 'Outstanding Invoices']
    },
    {
      id: 'customs',
      title: 'Customs Report',
      description: 'Clearance times, document status, and compliance metrics',
      icon: <Building2 className="h-8 w-8 text-purple-600" />,
      metrics: ['Clearance Rate', 'Avg Clearance Time', 'Document Rejections', 'Compliance Score']
    },
    {
      id: 'client',
      title: 'Client Analysis',
      description: 'Client performance, satisfaction, and business insights',
      icon: <Users className="h-8 w-8 text-orange-600" />,
      metrics: ['Active Clients', 'Client Retention', 'Revenue per Client', 'Satisfaction Score']
    }
  ];

  const currentPeriodData = monthlyData[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Business intelligence and performance insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Button className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Period Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotations</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPeriodData.quotations}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipments</CardTitle>
            <Ship className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPeriodData.shipments}</div>
            <p className="text-xs text-muted-foreground">
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentPeriodData.revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +15% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentPeriodData.costs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${currentPeriodData.profit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +25% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reportTypes.map((reportType) => (
          <Card key={reportType.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                {reportType.icon}
                <div>
                  <CardTitle className="text-lg">{reportType.title}</CardTitle>
                  <CardDescription>{reportType.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {reportType.metrics.map((metric, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    • {metric}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  View Report
                </Button>
                <Button size="sm" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clients Performance
            </CardTitle>
            <CardDescription>Revenue and shipment analysis by client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientPerformance.map((client, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{client.client}</p>
                    <p className="text-sm text-gray-500">{client.shipments} shipments</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">${client.revenue.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      client.status === 'Active' ? 'bg-green-100 text-green-800' :
                      client.status === 'New' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {client.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Route Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Route Performance
            </CardTitle>
            <CardDescription>Traffic and revenue analysis by route</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {routePerformance.map((route, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{route.route}</p>
                    <p className="text-sm text-gray-500">
                      {route.shipments} shipments • Avg: {route.avgTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">${route.revenue.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">
                      ${(route.revenue / route.shipments).toLocaleString()} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Performance Trend
          </CardTitle>
          <CardDescription>Revenue, costs, and profit trends over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Interactive Chart Placeholder</p>
              <p className="text-sm">Chart.js or similar charting library would be integrated here</p>
              <div className="mt-4 text-sm">
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Costs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Profit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
            {monthlyData.map((period, index) => (
              <div key={index} className="text-center p-3 bg-gray-50 rounded">
                <p className="font-medium">{period.period}</p>
                <p className="text-green-600">${period.profit.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
