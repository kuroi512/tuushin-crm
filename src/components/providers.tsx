'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useI18n, type Language } from '@/lib/i18n';

interface ProvidersProps {
  children: React.ReactNode;
}

// Single QueryClient instance per browser session.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep responses warm for short periods to avoid duplicate fetches while navigating.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export function Providers({ children }: ProvidersProps) {
  const setLang = useI18n((state) => state.setLang);

  useEffect(() => {
    // Hydrate language preference from localStorage on mount
    const stored = localStorage.getItem('lang') as Language | null;
    if (stored === 'en' || stored === 'mn') {
      setLang(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
        <Toaster richColors position="top-right" closeButton toastOptions={{ duration: 3500 }} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
