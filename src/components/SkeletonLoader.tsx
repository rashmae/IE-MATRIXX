import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-foreground/10 rounded-lg", className)} />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("neumorphic-card p-6 space-y-4", className)}>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="neumorphic-card p-6 flex flex-col items-center justify-center text-center">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-10 w-24 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function ListSkeleton({ count = 5 }: SkeletonProps) {
  return (
    <div className="space-y-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: SkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="mb-12 space-y-4">
      <Skeleton className="h-16 w-3/4 sm:w-1/2" />
      <Skeleton className="h-6 w-full sm:w-2/3" />
    </div>
  );
}
