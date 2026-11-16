import { Info } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getHolidays } from '@/lib/data';
import { daysBetween } from '@/lib/dates';
import type { Holiday } from '@/lib/types';
import type { TFn } from '@/lib/i18n';
import { Badge, Card, CardContent, CardHeader, Checkbox, Field, Input, PageHeader, Select } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { saveHoliday, deleteHoliday } from '@/app/actions/admin';

function HolidayFields({ h, t }: { h?: Holiday; t: TFn }) {
  return (
    <>
      {h && <input type="hidden" name="id" value={h.id} />}
      <Field label={`${t('admin.holidayName')} *`}><Input name="name" defaultValue={h?.name} required placeholder="Summer vacation" /></Field>
      <Field label={t('admin.holidayNameJa')}><Input name="name_ja" defaultValue={h?.name_ja ?? ''} placeholder="夏季休暇" /></Field>
      <Field label={t('admin.kind')}>
        <Select name="kind" defaultValue={h?.kind ?? 'long_vacation'}>
          <option value="long_vacation">{t('admin.kind.long_vacation')}</option>
          <option value="school_holiday">{t('admin.kind.school_holiday')}</option>
        </Select>
      </Field>
      <Field label={t('admin.season')}>
        <Select name="season" defaultValue={h?.season ?? 'summer'}>
          {['summer', 'winter', 'spring', 'other'].map((s) => <option key={s} value={s}>{t(`admin.season.${s}`)}</option>)}
        </Select>
      </Field>
      <Field label={`${t('c.from')} *`}><Input type="date" name="start_date" defaultValue={h?.start_date} required /></Field>
      <Field label={`${t('c.to')} *`}><Input type="date" name="end_date" defaultValue={h?.end_date} required /></Field>
      <div className="flex items-end pb-2"><Checkbox name="approved" defaultChecked={h ? h.approved : true} label={t('admin.approvedHoliday')} /></div>
    </>
  );
}

export default async function AdminHolidays() {
  await requireRole('admin');
  const { t } = await getT();
  const holidays = await getHolidays();
  return (
    <div className="space-y-5">
      <PageHeader title={t('admin.holidays')} />
      <Card className="flex gap-3 border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Info className="h-5 w-5 shrink-0" />{t('admin.holidayHelp')}</Card>
      <Card>
        <CardHeader title={t('c.add')} />
        <CardContent>
          <ActionForm action={saveHoliday} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HolidayFields t={t} />
            <div className="flex items-end"><SubmitButton>{t('c.add')}</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {[...holidays].reverse().map((h) => (
          <Card key={h.id}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-5 py-3 text-sm">
                <span className="font-semibold">{h.name}</span>
                {h.name_ja && <span className="text-slate-500">{h.name_ja}</span>}
                <Badge tone={h.kind === 'long_vacation' ? 'yellow' : 'slate'}>{t(`admin.kind.${h.kind}`)}</Badge>
                {!h.approved && <Badge tone="red">not approved</Badge>}
                <span className="ml-auto text-slate-600">{h.start_date} → {h.end_date} ({daysBetween(h.start_date, h.end_date) + 1}d)</span>
              </summary>
              <CardContent className="border-t border-slate-100">
                <ActionForm action={saveHoliday} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <HolidayFields h={h} t={t} />
                  <div className="flex items-end"><SubmitButton>{t('c.save')}</SubmitButton></div>
                </ActionForm>
                <ActionForm action={deleteHoliday} confirm={t('c.confirmDelete')} className="mt-2">
                  <input type="hidden" name="id" value={h.id} />
                  <SubmitButton variant="ghost" size="sm" className="text-red-600">{t('c.delete')}</SubmitButton>
                </ActionForm>
              </CardContent>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
