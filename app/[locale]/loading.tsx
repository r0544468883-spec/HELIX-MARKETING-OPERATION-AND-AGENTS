import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-[1280px] mx-auto px-5 md:px-10 pt-16">
      <div className="flex flex-col items-center gap-4 pb-14">
        <Skeleton className="h-14 w-2/3 max-w-xl" />
        <Skeleton className="h-5 w-1/2 max-w-md" />
        <div className="flex gap-3 mt-4">
          <Skeleton className="h-12 w-36 rounded-[10px]" />
          <Skeleton className="h-12 w-36 rounded-[10px]" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="mb-16">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-[300px] w-full max-w-[420px] mx-auto" />
        </div>
      ))}
    </div>
  );
}
