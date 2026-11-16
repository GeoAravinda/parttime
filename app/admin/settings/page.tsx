import { Scale } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getSettings } from '@/lib/data';
import { Card, CardContent, CardHeader, Checkbox, Field, Input, PageHeader } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { saveSettings } from '@/app/actions/admin';

export default async function SettingsPage() {
  await requireRole('admin');
  const { t } = await getT();
  const s = await getSettings();
  return (
    <div>
      <PageHeader title={t('nav.settings')} />
      <ActionForm action={saveSettings} className="space-y-5">
        <Card>
          <CardHeader title={t('admin.schoolInfo')} />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label={t('admin.schoolName')}><Input name="school_name" defaultValue={s.school_name} required /></Field>
            <Field label={t('admin.schoolNameJa')}><Input name="school_name_ja" defaultValue={s.school_name_ja} required /></Field>
            <Field label={t('admin.address')} className="sm:col-span-2"><Input name="address" defaultValue={s.address ?? ''} /></Field>
            <Field label={t('profile.phone')}><Input name="phone" defaultValue={s.phone ?? ''} /></Field>
            <Field label={t('c.email')}><Input name="email" type="email" defaultValue={s.email ?? ''} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('admin.rules')} />
          <CardContent className="space-y-4">
            <p className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><Scale className="h-5 w-5 shrink-0" />{t('admin.rulesHelp')}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t('admin.weeklyLimit')}><Input name="weekly_limit" type="number" step="0.5" min="1" defaultValue={s.weekly_limit} required /></Field>
              <Field label={t('admin.weeklyWarn')}><Input name="weekly_warn" type="number" step="0.5" min="1" defaultValue={s.weekly_warn} required /></Field>
              <Field label={t('admin.dailyLimit')}><Input name="holiday_daily_limit" type="number" step="0.5" min="1" defaultValue={s.holiday_daily_limit} required /></Field>
              <Field label={t('admin.dailyWarn')}><Input name="holiday_daily_warn" type="number" step="0.5" min="1" defaultValue={s.holiday_daily_warn} required /></Field>
              <Field label={t('admin.missingDays')}><Input name="missing_record_days" type="number" min="1" defaultValue={s.missing_record_days} /></Field>
              <Field label={t('admin.futureDays')}><Input name="allow_future_days" type="number" min="0" defaultValue={s.allow_future_days} /></Field>
              <div className="flex items-end pb-2 sm:col-span-2"><Checkbox name="allow_student_delete" defaultChecked={s.allow_student_delete} label={t('admin.allowDelete')} /></div>
            </div>
          </CardContent>
        </Card>
        <SubmitButton>{t('c.save')}</SubmitButton>
      </ActionForm>
    </div>
  );
}
