'use client';

import { useMemo, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export type ProfileSnapshot = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

const formatTimestamp = (value: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    console.error('Failed to format timestamp', error);
    return value;
  }
};

export function ProfileSettingsForm({ user }: { user: ProfileSnapshot }) {
  const { update: refreshSession } = useSession();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lastSaved, setLastSaved] = useState(user.updatedAt);
  const [initialEmail, setInitialEmail] = useState(user.email);
  const [isPending, startTransition] = useTransition();

  const disabled = isPending;

  const summary = useMemo(
    () => ({
      emailChanged: email.trim().toLowerCase() !== initialEmail.trim().toLowerCase(),
      passwordChanged: password.length > 0,
    }),
    [email, initialEmail, password],
  );

  const resetForm = () => {
    setEmail(initialEmail);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!summary.emailChanged && !summary.passwordChanged) {
      toast.info('Nothing to update yet.');
      return;
    }

    const payload: { email?: string; password?: string } = {};

    if (summary.emailChanged) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        toast.error('Email is required.');
        return;
      }
      payload.email = normalizedEmail;
    }

    if (summary.passwordChanged) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('New passwords do not match.');
        return;
      }
      payload.password = password;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/users/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json();

        if (!response.ok) {
          const detail =
            json?.details?.formErrors?.[0] ?? json?.error ?? 'Failed to update profile.';
          toast.error(detail);
          return;
        }

        const updatedEmail = json?.data?.email ?? payload.email ?? email;
        const updatedAt = json?.data?.updatedAt ?? new Date().toISOString();

        setEmail(updatedEmail);
        setInitialEmail(updatedEmail);
        setPassword('');
        setConfirmPassword('');
        setLastSaved(updatedAt);
        toast.success('Profile updated successfully.');

        await refreshSession?.();
      } catch (error) {
        console.error(error);
        toast.error('Unexpected error while updating profile.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account overview</CardTitle>
          <CardDescription>Review your identity, role, and account metadata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={user.name ?? ''} disabled />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <div className="flex items-center gap-2">
              <Input value={user.role} disabled />
              <Badge variant="secondary" className="uppercase">
                {user.role}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Created</Label>
            <Input value={formatTimestamp(user.createdAt)} disabled />
          </div>
          <div className="space-y-1">
            <Label>Last updated</Label>
            <Input value={formatTimestamp(lastSaved)} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login & security</CardTitle>
          <CardDescription>
            Update the email address and password you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                autoComplete="email"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="border-t border-dashed border-gray-200" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={disabled}
              />
              <p className="text-muted-foreground text-xs">
                Leave blank to keep your current password.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={disabled || !summary.passwordChanged}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <div className="text-muted-foreground text-xs">
            Passwords must be at least 8 characters. Use a mix of numbers, symbols, and letters for
            better security.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={resetForm} disabled={disabled}>
              Reset
            </Button>
            <Button type="submit" disabled={disabled}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
