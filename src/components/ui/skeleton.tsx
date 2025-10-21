import * as React from 'react';

import { cn } from '@/lib/utils';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('bg-muted/60 animate-pulse rounded-md', className)} {...props} />;
}
