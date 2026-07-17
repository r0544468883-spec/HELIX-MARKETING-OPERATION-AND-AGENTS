type Step = { label: string; value: number };

export default function Funnel({ steps }: { steps: Step[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 100);
        const conv = i > 0 && steps[0].value > 0 ? Math.round((s.value / steps[0].value) * 100) : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 text-[13px] text-ink-secondary shrink-0">{s.label}</span>
            <div className="flex-1 bg-bg border border-border rounded-lg h-8 relative overflow-hidden">
              <div
                className="h-full bg-brand/20 border-e border-brand/40"
                style={{ width: `${Math.max(pct, 3)}%` }}
              />
              <span className="absolute inset-0 flex items-center px-3 font-mono font-bold text-[14px]">
                {s.value}
                {conv !== null && (
                  <span className="text-ink-muted font-normal text-[12px] ms-2">{conv}%</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
