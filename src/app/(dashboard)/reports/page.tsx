'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Download, FileText, Filter, Eye, Users } from 'lucide-react';

interface ReportData { period: string; quotations: number; offersSent: number; approved: number; }

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState('2025');
  
  // Mock data for reports
  const monthlyData: ReportData[] = [
    { period: 'Jan 2025', quotations: 45, offersSent: 28, approved: 16 },
    { period: 'Dec 2024', quotations: 38, offersSent: 25, approved: 14 },
    { period: 'Nov 2024', quotations: 42, offersSent: 31, approved: 18 },
    { period: 'Oct 2024', quotations: 51, offersSent: 40, approved: 20 }
  ];

  const clientPerformance = [
    { client: 'Oyu Tolgoi LLC', shipments: 8, revenue: 45000, status: 'Active' },
    { client: 'Erdenet Mining Corporation', shipments: 12, revenue: 38000, status: 'Active' },
    { client: 'MAK LLC', shipments: 6, revenue: 22000, status: 'Active' },
    { client: 'TT Mining', shipments: 4, revenue: 15000, status: 'Inactive' },
    { client: 'Gobi Steel', shipments: 2, revenue: 8000, status: 'New' }
  ];

  const salesLeaderboard = [
    { user: 'Bat-Erdene', quotations: 18, offersSent: 12, approved: 7 },
    { user: 'Enkhbayar', quotations: 15, offersSent: 10, approved: 6 },
    { user: 'Sarangerel', quotations: 12, offersSent: 8, approved: 5 }
  ];

  const reportTypes = [
    {
      id: 'sales-kpi',
      title: 'Sales KPIs',
      description: 'Quotations created, offers sent, approval rate',
      icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
      metrics: ['Total Quotations', 'Offers Sent', 'Approved', 'Approval Rate']
    },
    {
      id: 'client',
      title: 'Client Insights',
      description: 'Top clients by activity and approvals',
      icon: <Users className="h-8 w-8 text-orange-600" />,
      metrics: ['Active Clients', 'Approvals by Client', 'Avg Time to Approve']
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotations</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPeriodData.quotations}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offers Sent</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPeriodData.offersSent}</div>
            <p className="text-xs text-muted-foreground">+10% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentPeriodData.approved}</div>
            <p className="text-xs text-muted-foreground">+7% from last month</p>
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
              Top Clients by Approvals
            </CardTitle>
            <CardDescription>Approvals and activity by client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientPerformance.map((client, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{client.client}</p>
                    <p className="text-sm text-gray-500">{client.shipments} approvals</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sales Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Leaderboard
            </CardTitle>
            <CardDescription>Quotations, offers, approvals by salesperson</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesLeaderboard.map((row, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{row.user}</p>
                    <p className="text-sm text-gray-500">
                      {row.quotations} quotes • {row.offersSent} offers • {row.approved} approved
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
            Monthly Sales Trend
          </CardTitle>
          <CardDescription>Quotations, offers sent, approvals over time</CardDescription>
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
                    <span>Quotations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Offers Sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span>Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
            {monthlyData.map((period, index) => (
              <div key={index} className="text-center p-3 bg-gray-50 rounded">
                <p className="font-medium">{period.period}</p>
                <p className="text-blue-600">{period.quotations} / {period.offersSent} / {period.approved}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
