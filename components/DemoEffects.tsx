'use client';

import { useToast } from '@/components/ui/Toast';
import { celebrate } from '@/lib/confetti';

export default function DemoEffects() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3 my-6">
      <button
        onClick={() => celebrate()}
        className="bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] active:scale-95 transition-transform"
      >
        🎉 קונפטי
      </button>
      <button
        onClick={() => toast('נשמר בהצלחה ✓', 'success')}
        className="border border-border hover:border-brand px-4 py-2 rounded-[10px] transition-colors active:scale-95"
      >
        Toast הצלחה
      </button>
      <button
        onClick={() => toast('משהו השתבש', 'error')}
        className="border border-border hover:border-brand px-4 py-2 rounded-[10px] transition-colors active:scale-95"
      >
        Toast שגיאה
      </button>
    </div>
  );
}
