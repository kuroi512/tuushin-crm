import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const categories: { slug: string; label: string; description: string }[] = [
  { slug: 'type', label: 'Type', description: 'Shipment types and related classifications.' },
  { slug: 'ownership', label: 'Ownership', description: 'Ownership groups and entities.' },
  { slug: 'customer', label: 'Customer', description: 'Customer master list and groups.' },
  { slug: 'agent', label: 'Agent', description: 'Agents and partners.' },
  { slug: 'country', label: 'Country', description: 'Countries and ISO-like codes.' },
  { slug: 'port', label: 'Port', description: 'Ports with associated country.' },
  { slug: 'area', label: 'Area', description: 'Areas/regions with type info.' },
  { slug: 'exchange', label: 'Exchange', description: 'Exchange codes and labels.' },
  { slug: 'sales', label: 'Sales', description: 'Sales users/personnel from upstream.' },
  { slug: 'manager', label: 'Manager', description: 'Manager users/personnel from upstream.' },
  {
    slug: 'rule-snippets',
    label: 'Include/Exclude Snippets',
    description: 'Maintain quotation include/exclude/remark templates by Incoterm & mode.',
  },
];

export default function MasterIndex() {
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
