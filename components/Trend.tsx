// ספרקליין ברים ל-30 יום
export default function Trend({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex items-end gap-[3px] h-24" dir="ltr">
      {days.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d.count}`}
          className="flex-1 bg-brand/30 hover:bg-brand/60 rounded-t transition-colors"
          style={{ height: `${Math.max(Math.round((d.count / max) * 100), 2)}%` }}
        />
      ))}
    </div>
  );
}
