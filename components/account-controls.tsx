import type { TFn } from '@/lib/i18n';
import { Card, CardContent, CardHeader, Input, StatusBadge } from './ui';
import { ActionForm, SubmitButton } from './action-form';
import { setAccountStatus, resetPassword, deleteAccount } from '@/app/actions/admin';

/** Admin controls for one account: activate / deactivate, reset password, delete. */
export function AccountControls({ id, status, t, backHref }: { id: string; status: string; t: TFn; backHref: string }) {
  return (
    <Card>
      <CardHeader title={t('admin.permissions')} action={<StatusBadge status={status} label={t(`status.${status}`)} />} />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {status !== 'active' && (
            <ActionForm action={setAccountStatus}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="active" />
              <SubmitButton variant="success" size="sm">{status === 'pending' ? t('admin.approveAccount') : t('admin.activate')}</SubmitButton>
            </ActionForm>
          )}
          {status === 'active' && (
            <ActionForm action={setAccountStatus}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="inactive" />
              <SubmitButton variant="outline" size="sm">{t('admin.deactivate')}</SubmitButton>
            </ActionForm>
          )}
        </div>
        <ActionForm action={resetPassword} resetOnSuccess className="flex flex-wrap items-start gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="password" type="text" minLength={8} required placeholder={t('admin.tempPassword')} className="h-8 max-w-[220px] text-xs" autoComplete="off" />
          <SubmitButton variant="outline" size="sm">{t('c.save')}</SubmitButton>
        </ActionForm>
        <ActionForm action={deleteAccount} confirm={t('admin.deleteConfirm')}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="redirect" value={backHref} />
          <SubmitButton variant="destructive" size="sm">{t('admin.deleteUser')}</SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
