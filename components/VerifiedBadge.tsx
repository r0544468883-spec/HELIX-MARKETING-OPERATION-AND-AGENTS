import { BadgeCheck } from 'lucide-react';

export default function VerifiedBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand bg-brand/10 rounded-full px-2 py-0.5"
      title={label}
    >
      <BadgeCheck size={12} />
      {label}
    </span>
  );
}
