import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const categories: { slug: string; label: string; description: string }[] = [
  { slug: 'type', label: 'Type', description: 'Shipment types and related classifications.' },
  { slug: 'ownership', label: 'Ownership', description: 'Ownership groups and entities.' },
  { slug: 'customer', label: 'Customer', description: 'Customer master list and groups.' },
  { slug: 'agent', label: 'Agent', description: 'Agents and partners.' },
  { slug: 'country', label: 'Country', description: 'Countries and ISO-like codes.' },
  { slug: 'port', label: 'Port', description: 'Ports with associated country.' },
  { slug: 'area', label: 'Area', description: 'Areas/regions with type info.' },
  { slug: 'exchange', label: 'Exchange', description: 'Exchange codes and labels.' },
  { slug: 'incoterm', label: 'Incoterm', description: 'Incoterms for quotations and shipments.' },
  { slug: 'sales', label: 'Sales', description: 'Sales users/personnel from upstream.' },
  { slug: 'manager', label: 'Manager', description: 'Manager users/personnel from upstream.' },
  {
    slug: 'external-shipments',
    label: 'External Shipments',
    description: 'Sync inbound shipments from the upstream CRM APIs.',
  },
  {
    slug: 'sales-kpi',
    label: 'Sales KPI Measurements',
    description: 'Set monthly revenue and profit targets for each sales owner.',
  },
];

export default async function MasterIndex() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessMasterData')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Data</h1>
        <p className="text-gray-600">Choose a category to view master data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((c) => (
          <Link key={c.slug} href={`/master/${c.slug}`} className="block">
            <Card className="h-full transition hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{c.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
