'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster richColors position="top-right" closeButton toastOptions={{ duration: 3500 }} />
    </SessionProvider>
  );
}
