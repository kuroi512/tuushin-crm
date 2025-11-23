'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'SALES'];

export default function EditUserPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccess = hasPermission(role, 'viewUsers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: '',
    email: '',
    role: 'USER',
    isActive: true,
    password: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccess) {
      router.replace('/dashboard');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
        setForm((f: any) => ({ ...f, ...json.data, password: '' }));
      } catch (e: any) {
        toast.error(e.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, status, canAccess, router]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        role: form.role,
        isActive: !!form.isActive,
      };
      if (form.password && form.password.length >= 6) payload.password = form.password;
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      toast.success('User updated');
      router.push('/users');
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit User</h1>
        <p className="text-gray-600">
          Update user details. Leave password empty to keep unchanged.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Basic user info</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="isActive">Status</Label>
            <select
              id="isActive"
              className="h-10 w-full rounded-md border px-3"
              value={form.isActive ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
            >
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Leave blank to keep current password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
