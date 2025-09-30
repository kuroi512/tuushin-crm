'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Reset failed');
      toast.success('Password reset to default: test123');
    } catch (e: any) {
      toast.error(e.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>
      {loading ? 'Resetting…' : 'Reset Password'}
    </Button>
  );
}
