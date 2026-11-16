'use client';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ActionForm, SubmitButton } from './action-form';
import { Button, Input } from './ui';
import { useI18n } from './i18n-provider';
import { reviewRecord, bulkApprove } from '@/app/actions/teacher';

/** Approve / reject (with mandatory reason) for one submitted record. */
export function ReviewControls({ id }: { id: string }) {
  const { t } = useI18n();
  const [rejecting, setRejecting] = useState(false);
  if (rejecting) {
    return (
      <ActionForm action={reviewRecord} onSuccess={() => setRejecting(false)} className="flex min-w-[240px] flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="rejected" />
        <Input name="comment" required placeholder={t('teacher.rejectReason')} className="h-8 flex-1 text-xs" autoFocus />
        <SubmitButton variant="destructive" size="sm">{t('c.reject')}</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>{t('c.cancel')}</Button>
      </ActionForm>
    );
  }
  return (
    <div className="flex items-start gap-1.5">
      <ActionForm action={reviewRecord}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="approved" />
        <SubmitButton variant="success" size="sm"><Check className="h-3.5 w-3.5" />{t('c.approve')}</SubmitButton>
      </ActionForm>
      <Button variant="outline" size="sm" className="text-red-600" onClick={() => setRejecting(true)}><X className="h-3.5 w-3.5" />{t('c.reject')}</Button>
    </div>
  );
}

export const BULK_FORM_ID = 'bulk-approve';

/** "Approve selected" bar. Row checkboxes live in the table and join this form via form="bulk-approve". */
export function BulkApproveBar() {
  const { t } = useI18n();
  return (
    <ActionForm action={bulkApprove} id={BULK_FORM_ID} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" className="h-4 w-4" onChange={(e) => {
          const on = e.currentTarget.checked;
          document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM_ID}"][name="ids"]`).forEach((c) => { c.checked = on; });
        }} />
        All
      </label>
      <SubmitButton variant="success" size="sm"><Check className="h-4 w-4" />{t('teacher.approveAll')}</SubmitButton>
    </ActionForm>
  );
}
