import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-[680px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <Skeleton className="h-9 w-40 mb-2" />
      <Skeleton className="h-5 w-72 mb-8" />
      <div className="flex flex-col gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
