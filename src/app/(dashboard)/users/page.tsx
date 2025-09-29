import { prisma } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type CombinedUser = {
  id?: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  source: 'User' | 'Master';
  provisioned: boolean;
};

function toEmail(name: string) {
  const parts = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s.]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const local = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'user';
  return `${local}@tuushin.local`;
}

async function getCombined(): Promise<CombinedUser[]> {
  const [users, staff] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.masterOption.findMany({
      where: { category: { in: ['SALES', 'MANAGER'] as any }, isActive: true },
      select: { id: true, name: true, meta: true, category: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const userByEmail = new Map<string, (typeof users)[number]>();
  users.forEach((u) => userByEmail.set(u.email, u));

  const rows: CombinedUser[] = [];

  // Include all staff from master options (provisioned or not)
  for (const s of staff) {
    const email = (s.meta as any)?.email || toEmail(s.name);
    const existing = userByEmail.get(email);
    const role = s.category === 'MANAGER' ? 'MANAGER' : 'SALES';
    if (existing) {
      rows.push({
        id: existing.id,
        name: existing.name || s.name,
        email: existing.email,
        role: existing.role,
        isActive: !!existing.isActive,
        createdAt: new Date(existing.createdAt).toISOString(),
        updatedAt: new Date(existing.updatedAt).toISOString(),
        source: 'User',
        provisioned: true,
      });
    } else {
      rows.push({
        name: s.name,
        email,
        role,
        isActive: false,
        source: 'Master',
        provisioned: false,
      });
    }
  }

  // Include non-staff users (like ADMIN) that are not present in staff list
  const staffEmails = new Set(rows.map((r) => r.email));
  for (const u of users) {
    if (!staffEmails.has(u.email)) {
      rows.push({
        id: u.id,
        name: u.name || '-',
        email: u.email,
        role: u.role,
        isActive: !!u.isActive,
        createdAt: new Date(u.createdAt).toISOString(),
        updatedAt: new Date(u.updatedAt).toISOString(),
        source: 'User',
        provisioned: true,
      });
    }
  }

  // Sort by role then name
  rows.sort((a, b) => `${a.role}-${a.name}`.localeCompare(`${b.role}-${b.name}`));
  return rows;
}

export default async function UsersPage() {
  const rows = await getCombined();
  const total = rows.length;
  const pending = rows.filter((r) => !r.provisioned).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-600">All users, including Sales/Managers from master data</p>
        </div>
        <form action="/api/master/provision-users" method="post">
          <Button type="submit" variant="outline">
            Provision Missing Accounts
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {total} total • {pending} pending provisioning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={`${u.email}-${u.id ?? 'pending'}`}>
                  <TableCell>{u.name || '-'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.provisioned ? (u.isActive ? 'default' : 'destructive') : 'outline'}
                    >
                      {u.provisioned ? (u.isActive ? 'Active' : 'Disabled') : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.source === 'User' ? 'default' : 'outline'}>{u.source}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    {u.updatedAt ? new Date(u.updatedAt).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
