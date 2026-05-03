import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SubjectCardSkeleton() {
  return (
    <div className="neumorphic-card p-6 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="neumorphic-card p-6 animate-pulse">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-10 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="neumorphic-card p-4 flex items-center gap-4 animate-pulse">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-3">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid auto-grid-md gap-6">
        {Array.from({ length: 6 }).map((_, i) => <SubjectCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
