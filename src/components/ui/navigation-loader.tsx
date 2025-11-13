import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavigationLoaderProps = {
  delayMs?: number;
  className?: string;
};

export function NavigationLoader({ delayMs = 150, className }: NavigationLoaderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsVisible(false);
    const timeout = setTimeout(() => setIsVisible(true), delayMs);
    return () => clearTimeout(timeout);
  }, [pathname, delayMs]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center',
        className,
      )}
    >
      <div className="flex items-center gap-2 rounded-b-md bg-black/70 px-4 py-2 text-xs text-white shadow-md">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span>Loading page…</span>
      </div>
    </div>
  );
}
