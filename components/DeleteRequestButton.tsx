'use client';

import { useTransition } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { deleteRequest } from '@/app/actions-ops';

export default function DeleteRequestButton({ id, locale }: { id: string; locale: string }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          const ok = await confirm({
            title: 'מחיקת בקשה',
            message: 'למחוק את הבקשה לצמיתות? כולל הנכסים והטיוטות שלה.',
            confirmLabel: 'מחק',
            danger: true,
          });
          if (ok) await deleteRequest(id, locale);
        })
      }
      disabled={pending}
      aria-label="מחק בקשה"
      className="text-[13px] text-red-400 hover:text-red-300 disabled:opacity-50 min-h-[44px]"
    >
      🗑 מחק בקשה
    </button>
  );
}
