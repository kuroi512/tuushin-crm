'use client';

import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function DashboardLoading() {
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-gray-700">{t('dashboard.loading.primary')}</p>
      </div>
      <p className="mt-4 text-xs text-gray-500">{t('dashboard.loading.secondary')}</p>
    </div>
  );
}
