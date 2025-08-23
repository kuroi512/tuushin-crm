'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [session, status, router]);

  // Loading state
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-32 w-32 animate-spin rounded-full border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">Loading ТУУШИН ХХК Freight CRM...</p>
      </div>
    </div>
  );
}
