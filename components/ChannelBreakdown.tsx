type Row = { source: string; label: string; count: number };

export default function ChannelBreakdown({ rows, emptyLabel }: { rows: Row[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-ink-muted text-[14px]">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.source} className="flex items-center gap-3">
          <span className="w-24 text-[13px] text-ink-secondary shrink-0">{r.label}</span>
          <div className="flex-1 bg-bg border border-border rounded-lg h-7 relative overflow-hidden">
            <div
              className="h-full bg-brand/25"
              style={{ width: `${Math.max(Math.round((r.count / max) * 100), 3)}%` }}
            />
            <span className="absolute inset-0 flex items-center px-3 font-mono font-bold text-[13px]">
              {r.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
