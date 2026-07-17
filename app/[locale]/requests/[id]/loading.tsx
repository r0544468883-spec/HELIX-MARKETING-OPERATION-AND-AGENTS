import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <Skeleton className="h-5 w-24 mb-4" />
      <Skeleton className="h-9 w-2/3 mb-3" />
      <Skeleton className="h-5 w-full max-w-[50ch] mb-8" />
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl mt-6" />
    </div>
  );
}
