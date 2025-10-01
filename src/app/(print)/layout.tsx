'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/login');
  }, [session, status, router]);

  if (status === 'loading') {
    return <div className="grid min-h-screen place-items-center">Loading…</div>;
  }
  if (!session) return null;

  return <div className="min-h-screen bg-white">{children}</div>;
}
