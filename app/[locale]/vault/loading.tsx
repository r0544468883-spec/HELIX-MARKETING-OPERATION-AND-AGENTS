import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <Skeleton className="h-9 w-40 mb-2" />
      <Skeleton className="h-5 w-64 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}
